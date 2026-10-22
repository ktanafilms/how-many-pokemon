"""Genera los escenarios (arenas y rancho) a partir del tileset de HeartGold/SoulSilver.

Uso: python3 tools/build_arenas.py
Crea assets/arenas/<nombre>_h.webp (1280x720) y <nombre>_v.webp (720x1280, móvil en vertical).
Tileset: tools/tiles/hgss_outside.png (ripeo de SirMaIo / jls-dchrn, tiles de 32 px).
"""
import os
import random
import zlib
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHEET = Image.open(os.path.join(ROOT, "tools", "tiles", "hgss_outside.png")).convert("RGBA")
OUT = os.path.join(ROOT, "assets", "arenas")
os.makedirs(OUT, exist_ok=True)
TS = 32


def tile(c, r, w=1, h=1):
    return SHEET.crop((c * TS, r * TS, (c + w) * TS, (r + h) * TS))


# ---------- Piezas del tileset ----------
GRASS = [tile(1, 0), tile(2, 0), tile(3, 0)]
GRASS_PLAIN = tile(1, 0)
TALL_GRASS = tile(7, 0)
FLOWERS = tile(7, 3)
NINE = {  # bloques 3x3 (esquinas, bordes y centro) de cada tipo de suelo sobre hierba
    "path": (1, 12), "sand": (1, 19), "gravel": (1, 26), "stone": (1, 33),
}
OBJ = {
    "yellowtree": tile(0, 65, 3, 5), "greentree": tile(0, 71, 3, 5), "bigpine": tile(0, 59, 3, 5),
    "pinepair": tile(0, 52, 2, 3), "pinepair2": tile(2, 52, 2, 3), "tallpine": tile(1, 55, 1, 3),
    "pine": tile(6, 58, 1, 3), "brownmound": tile(0, 98, 2, 3), "brownmound2": tile(3, 98, 2, 3),
    "brownstal": tile(4, 104, 2, 4), "greymound": tile(0, 108, 2, 3), "greystal": tile(4, 114, 2, 4),
    "smallrock": tile(7, 104, 1, 2), "greyrock": tile(7, 114, 1, 2), "boulder": tile(7, 117),
    "rocksmash": tile(0, 118), "strength": tile(1, 118), "bush": tile(3, 65), "pokeball": tile(4, 118),
    "redflowers": tile(5, 119), "flowerbed": tile(6, 119), "sign": tile(1, 119), "house": tile(0, 167, 5, 4),
    "fountain": tile(5, 140, 3, 4), "crystal": tile(0, 122),
}


def _grass_palette():
    cols = set()
    for c in range(1, 6):
        t = tile(c, 0)
        cols.update(t.getpixel((x, y))[:3] for x in range(TS) for y in range(TS))
    return cols


GRASS_PAL = _grass_palette()


def clear_bg(img, tol=26):
    """Quita el fondo de hierba de un objeto: relleno por inundación desde los bordes
    sobre los colores de la hierba (y el color de fondo de las esquinas), sin agujerear el objeto."""
    img = img.copy()
    px = img.load()
    W, H = img.size
    pal = set(GRASS_PAL)
    for x, y in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        pal.add(px[x, y][:3])
    pal = list(pal)

    def bg(c):
        if c[3] == 0:
            return True
        return any(abs(c[0] - p[0]) + abs(c[1] - p[1]) + abs(c[2] - p[2]) <= tol for p in pal)

    seen = set()
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H):
            continue
        seen.add((x, y))
        if not bg(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return img


for _k in ("yellowtree", "greentree", "bigpine", "pinepair", "pinepair2", "tallpine", "pine", "bush", "house", "fountain", "sign", "redflowers", "flowerbed", "pokeball", "strength", "rocksmash"):
    OBJ[_k] = clear_bg(OBJ[_k])


def nine(kind):
    c, r = NINE[kind]
    return [[tile(c + i, r + j) for i in range(3)] for j in range(3)]


def fill(img, t):
    if LAYERED is not None and LAYERED["base"] is None:
        LAYERED["base"] = t[0] if isinstance(t, list) else t
    for y in range(0, img.height, TS):
        for x in range(0, img.width, TS):
            img.alpha_composite(t if not isinstance(t, list) else random.choice(t), (x, y))


def patch(img, kind, x0, y0, w, h):
    """Rectángulo de suelo (en tiles) con bordes redondeados del tileset."""
    p = nine(kind)
    for j in range(h):
        for i in range(w):
            pi = 0 if i == 0 else 2 if i == w - 1 else 1
            pj = 0 if j == 0 else 2 if j == h - 1 else 1
            img.alpha_composite(p[pj][pi], ((x0 + i) * TS, (y0 + j) * TS))


def pond(img, x0, y0, w, h, clean=False):
    p = [[(clear_bg if clean else (lambda t: t))(tile(5 + i, 86 + j)) for i in range(3)] for j in range(3)]
    for j in range(h):
        for i in range(w):
            pi = 0 if i == 0 else 2 if i == w - 1 else 1
            pj = 0 if j == 0 else 2 if j == h - 1 else 1
            img.alpha_composite(p[pj][pi], ((x0 + i) * TS, (y0 + j) * TS))


def grave():
    """Lápida dibujada a mano al estilo HGSS (no está en el tileset)."""
    g = Image.new("RGBA", (16, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    d.ellipse((1, 15, 15, 19), fill=(40, 30, 60, 90))
    d.rounded_rectangle((3, 2, 12, 17), radius=4, fill=(150, 150, 170), outline=(52, 48, 70))
    d.rectangle((4, 9, 11, 16), fill=(130, 130, 150))
    d.line((6, 7, 9, 7), fill=(90, 88, 110))
    d.line((7, 5, 7, 12), fill=(90, 88, 110))
    d.point((4, 4), fill=(200, 200, 215))
    return g.resize((44, 56), Image.NEAREST)


def starfish(color):
    g = Image.new("RGBA", (11, 11), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    import math
    pts = []
    for i in range(10):
        r = 5 if i % 2 == 0 else 2.2
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((5 + r * math.cos(a), 5 + r * math.sin(a)))
    d.polygon(pts, fill=color, outline=(110, 60, 40))
    d.point((5, 5), fill=(255, 230, 120))
    return g.resize((22, 22), Image.NEAREST)


def shell():
    g = Image.new("RGBA", (9, 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    d.pieslice((0, 0, 8, 12), 180, 360, fill=(250, 220, 220), outline=(150, 100, 110))
    d.line((4, 1, 4, 6), fill=(200, 150, 160))
    d.line((2, 2, 1, 6), fill=(200, 150, 160))
    d.line((6, 2, 7, 6), fill=(200, 150, 160))
    return g.resize((18, 16), Image.NEAREST)


def candle():
    g = Image.new("RGBA", (10, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    d.ellipse((2, 0, 7, 6), fill=(255, 200, 90))
    d.ellipse((3, 2, 6, 6), fill=(255, 245, 200))
    d.rectangle((3, 6, 6, 14), fill=(235, 230, 245), outline=(80, 70, 100))
    return g.resize((20, 32), Image.NEAREST)


# Modo por capas (2.5D): los objetos de pie no se pintan en el suelo sino que se guardan
# con su posición para levantarlos en 3D. LAYERED = {"props": [...], "tint": None, "base": None}
LAYERED = None


def place(img, o, x, y, items):
    items.append((y + o.height, o, x, y))


def flush(img, items):
    for _, o, x, y in sorted(items, key=lambda t: t[0]):
        if LAYERED is not None and o.height > 24:
            LAYERED["props"].append((o, x, y))
        else:
            img.alpha_composite(o, (int(x), int(y)))
    items.clear()


def border(img, objs, top=120, bottom=60, side=70, hstep=0.55, vstep=0.3):
    """Rellena una franja alrededor de la arena con objetos grandes, en capas (los de delante tapan a los de atrás)."""
    W, H = img.size
    items = []
    ow = max(o.width for o in objs)
    oh = max(o.height for o in objs)
    dx, dy = int(ow * hstep), max(16, int(oh * vstep))
    # arriba: el pie de cada objeto entre -oh/2 y `top`
    for yb in range(top - dy * ((top + oh // 2) // dy), top + 1, dy):
        off = random.randint(0, dx)
        for x in range(-ow - off, W + ow, dx):
            o = random.choice(objs)
            place(img, o, x + random.randint(-6, 6), yb - o.height + random.randint(-4, 4), items)
    # abajo
    for yb in range(H - bottom + o.height // 2 if False else H - bottom + 20, H + oh, dy):
        off = random.randint(0, dx)
        for x in range(-ow - off, W + ow, dx):
            o = random.choice(objs)
            place(img, o, x + random.randint(-6, 6), yb - o.height * 0.45, items)
    # lados
    for yb in range(top, H, dy):
        for x in range(-ow // 2 - 10, side - ow // 2 + 1, max(12, dx // 2)):
            o = random.choice(objs)
            place(img, o, x + random.randint(-6, 6), yb - o.height + random.randint(-6, 6), items)
            o = random.choice(objs)
            place(img, o, W - x - o.width + random.randint(-6, 6), yb - o.height + random.randint(-6, 6), items)
    flush(img, items)


def noise(img, color, n, rmin, rmax, alpha):
    W, H = img.size
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(n):
        x, y, r = random.randint(0, W), random.randint(0, H), random.randint(rmin, rmax)
        d.ellipse((x - r, y - r * 0.6, x + r, y + r * 0.6), fill=color + (alpha,))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(rmin)))


def ocean(img, rows):
    W = img.width
    water = tile(6, 87)
    for y in range(0, rows * TS, TS):
        for x in range(0, W, TS):
            img.alpha_composite(water, (x, y))
    d = ImageDraw.Draw(img)
    base = rows * TS
    # orilla: arena mojada + espuma ondulada
    for x in range(0, W, 2):
        import math
        h = 6 + 4 * math.sin(x / 23) + 2 * math.sin(x / 7)
        d.line((x, base - 2, x, base + h + 10), fill=(214, 196, 140))
        d.line((x, base - 6, x, base + h), fill=(236, 248, 255))
        d.line((x, base - 10, x, base - 6), fill=(150, 200, 240))
    for _ in range(W // 40):
        x, y = random.randint(0, W), random.randint(10, base - 30)
        d.line((x, y, x + 14, y), fill=(170, 215, 250), width=2)


def scatter(img, objs, n, margin=90, items=None, avoid=None):
    W, H = img.size
    own = items is None
    items = items if items is not None else []
    for _ in range(n):
        o = random.choice(objs)
        for _try in range(20):
            x = random.randint(margin, W - margin - o.width)
            y = random.randint(margin, H - margin - o.height)
            if not avoid or not avoid(x, y, o):
                break
        place(img, o, x, y, items)
    if own:
        flush(img, items)


def tall_patches(img, n, size=(3, 6)):
    W, H = img.size
    for _ in range(n):
        w, h = random.randint(*size), random.randint(2, 4)
        x0 = random.randint(3, W // TS - w - 3)
        y0 = random.randint(3, H // TS - h - 3)
        for j in range(h):
            for i in range(w):
                if (i in (0, w - 1) and j in (0, h - 1)) and random.random() < 0.6:
                    continue
                img.alpha_composite(TALL_GRASS, ((x0 + i) * TS, (y0 + j) * TS))
                if LAYERED is not None:
                    LAYERED["grass"].append(((x0 + i) * TS, (y0 + j) * TS))


def sprinkle(img, t, n, margin=64):
    W, H = img.size
    for _ in range(n):
        x = random.randint(margin // TS, (W - margin) // TS - 1)
        y = random.randint(margin // TS, (H - margin) // TS - 1)
        img.alpha_composite(t, (x * TS, y * TS))


def vignette(img, strength=0.55, color=(10, 12, 24)):
    if LAYERED is not None:
        LAYERED["fog"] = color
        return
    W, H = img.size
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    steps = 40
    for i in range(steps):
        a = int(255 * strength * (1 - i / steps) ** 2.2)
        inset = int(i * min(W, H) / (steps * 3.2))
        d.rectangle((inset, inset, W - inset, H - inset), outline=a, width=int(min(W, H) / (steps * 3.2)) + 1)
    m = m.filter(ImageFilter.GaussianBlur(18))
    dark = Image.new("RGBA", (W, H), color + (255,))
    img.paste(dark, (0, 0), m)


def tint(img, rgb, amount):
    if LAYERED is not None:
        LAYERED["tint"] = (rgb, amount)
    over = Image.new("RGBA", img.size, rgb + (255,))
    m = ImageChops.multiply(img, over)
    return Image.blend(img, m, amount)


# ---------- Escenarios ----------
def act_forest(W, H):
    img = Image.new("RGBA", (W, H))
    fill(img, GRASS)
    cx, cy = W // TS // 2, H // TS // 2
    sprinkle(img, FLOWERS, 16)
    tall_patches(img, 6)
    if W > H:
        patch(img, "path", 2, cy, W // TS - 4, 3)
    else:
        patch(img, "path", cx - 1, 3, 3, H // TS - 5)
    scatter(img, [OBJ["bush"], OBJ["redflowers"], OBJ["rocksmash"]], 6, margin=130)
    border(img, [OBJ["greentree"], OBJ["bigpine"], OBJ["greentree"], OBJ["pinepair"]], top=130, bottom=50, side=60)
    vignette(img, 0.4)
    return img


def act_moon(W, H):
    img = Image.new("RGBA", (W, H))
    p = nine("gravel")
    fill(img, p[1][1])
    noise(img, (60, 55, 70), 60, 30, 90, 60)
    noise(img, (200, 200, 220), 25, 20, 50, 35)
    small = [clear_bg(OBJ["boulder"]), clear_bg(OBJ["crystal"]), clear_bg(OBJ["rocksmash"])]
    scatter(img, small, 16, margin=120)
    rocks = [clear_bg(OBJ["greymound"]), clear_bg(OBJ["greystal"]), clear_bg(OBJ["greymound"]), clear_bg(OBJ["brownmound"])]
    border(img, rocks, top=120, bottom=50, side=56, hstep=0.6, vstep=0.25)
    img = tint(img, (150, 150, 200), 0.35)
    vignette(img, 0.8)
    return img


def act_coast(W, H):
    img = Image.new("RGBA", (W, H))
    p = nine("sand")
    fill(img, p[1][1])
    noise(img, (190, 160, 90), 50, 30, 80, 50)
    noise(img, (255, 250, 220), 30, 20, 50, 40)
    ocean(img, 4 if W > H else 5)
    items = []
    rocks = [clear_bg(OBJ["boulder"]), clear_bg(OBJ["rocksmash"])]
    scatter(img, rocks, 8, margin=150, items=items)
    scatter(img, [starfish((240, 120, 80)), starfish((250, 170, 70)), shell(), shell()], 14, margin=140, items=items)
    flush(img, items)
    palm = clear_bg(OBJ["yellowtree"])
    items = []
    top = (4 if W > H else 5) * TS + 30
    for y in range(top + 60, H + 40, 70):
        place(img, palm, -60 + random.randint(-8, 8), y - palm.height, items)
        place(img, palm, W - 40 + random.randint(-8, 8), y - palm.height, items)
    for x in range(-40, W, 70):
        place(img, palm, x + random.randint(-6, 6), H - 60 - palm.height * 0.3 + random.randint(0, 14), items)
    flush(img, items)
    vignette(img, 0.3)
    return img


TOWER = Image.open(os.path.join(ROOT, "tools", "tiles", "frlg_tower.png")).convert("RGBA")


def tmeta(i, w=1, h=1):
    """Metatile(s) de la Torre Pokémon de FireRed, escalados a 32 px."""
    out = Image.new("RGBA", (w * 16, h * 16))
    for j in range(h):
        for k in range(w):
            m = i + j * 8 + k
            out.alpha_composite(TOWER.crop(((m % 8) * 16, (m // 8) * 16, (m % 8) * 16 + 16, (m // 8) * 16 + 16)), (k * 16, j * 16))
    return out.resize((w * 32, h * 32), Image.NEAREST)


def act_tower(W, H):
    img = Image.new("RGBA", (W, H))
    fill(img, tmeta(2))
    # muro del fondo con su sombra
    for x in range(0, W, TS):
        img.alpha_composite(tmeta(8), (x, 0))
        img.alpha_composite(tmeta(16), (x, TS))
        img.alpha_composite(tmeta(3), (x, 2 * TS))
    # círculo de purificación en el centro
    circle = tmeta(25, 3, 3)
    circle = circle.resize((circle.width * 3 // 2, circle.height * 3 // 2), Image.NEAREST)
    img.alpha_composite(circle, (W // 2 - circle.width // 2, (H + 3 * TS) // 2 - circle.height // 2))
    big = lambda t: t.resize((48, 48), Image.NEAREST)
    graves = [big(tmeta(17)), big(tmeta(19)), big(tmeta(17)), big(tmeta(9))]
    items = []
    rnd = lambda: random.choice(graves)
    for x in range(8, W - 40, 52):
        place(img, rnd(), x, 3 * TS - 6, items)
        place(img, rnd(), x + 26, 3 * TS + 34, items)
        place(img, rnd(), x, H - 56, items)
    for y in range(5 * TS + 40, H - 70, 52):
        for dx in (4, 46):
            place(img, rnd(), dx, y, items)
            place(img, rnd(), W - 48 - dx, y, items)
    flush(img, items)
    # alfombra roja hacia el círculo
    for y in range(H - TS, H, TS):
        for x in range(W // 2 - TS, W // 2 + TS, TS):
            img.alpha_composite(tmeta(6), (x, y))
    noise(img, (60, 20, 90), 40, 50, 140, 70)
    noise(img, (200, 180, 255), 12, 40, 90, 25)
    img = tint(img, (170, 140, 220), 0.55)
    vignette(img, 0.95, (24, 6, 40))
    return img


def act_safari(W, H):
    img = Image.new("RGBA", (W, H))
    fill(img, GRASS)
    sprinkle(img, FLOWERS, 10)
    tall_patches(img, 14, size=(3, 8))
    if W > H:
        patch(img, "path", 5, 5, 7, 4)
        pond(img, W // TS - 10, H // TS - 7, 6, 3)
    else:
        patch(img, "path", 3, 6, 5, 6)
        pond(img, W // TS - 9, H // TS - 10, 5, 4)
    scatter(img, [OBJ["bush"], OBJ["strength"]], 5, margin=140)
    border(img, [OBJ["yellowtree"], OBJ["greentree"], OBJ["yellowtree"]], top=130, bottom=50, side=60)
    img = tint(img, (255, 236, 170), 0.25)
    vignette(img, 0.4)
    return img


def act_cerulean(W, H):
    img = Image.new("RGBA", (W, H))
    p = nine("gravel")
    fill(img, p[1][1])
    noise(img, (30, 30, 60), 60, 30, 90, 70)
    for _ in range(3):
        pond(img, random.randint(4, W // TS - 9), random.randint(5, H // TS - 8), random.randint(3, 5), 3, clean=True)
    small = [clear_bg(OBJ["crystal"]), clear_bg(OBJ["boulder"]), clear_bg(OBJ["rocksmash"])]
    scatter(img, small, 16, margin=120)
    rocks = [clear_bg(OBJ["brownmound"]), clear_bg(OBJ["brownstal"]), clear_bg(OBJ["brownmound2"])]
    border(img, rocks, top=120, bottom=50, side=56, hstep=0.6, vstep=0.25)
    img = tint(img, (120, 150, 255), 0.5)
    vignette(img, 0.85, (6, 10, 30))
    return img


def ranch(W, H):
    img = Image.new("RGBA", (W, H))
    fill(img, GRASS)
    cx = W // TS // 2
    house = OBJ["house"]
    hx = W // 2 - house.width // 2
    hy = 70 if W > H else 110
    sprinkle(img, FLOWERS, 18)
    tall_patches(img, 4)
    patch(img, "path", cx - 1, (hy + house.height) // TS - 1, 3, H // TS)
    if W > H:
        patch(img, "path", 2, H // TS - 6, W // TS - 4, 2)
    border(img, [OBJ["greentree"], OBJ["yellowtree"], OBJ["pinepair"]], top=hy + 40, bottom=50, side=60)
    items = []
    place(img, house, hx, hy, items)
    place(img, OBJ["sign"], hx + house.width + 10, hy + 92, items)
    place(img, OBJ["flowerbed"], hx - 40, hy + 96, items)
    place(img, OBJ["redflowers"], hx - 72, hy + 96, items)
    place(img, OBJ["fountain"], W - 230 if W > H else W - 160, H - 270, items)
    flush(img, items)
    scatter(img, [OBJ["bush"], OBJ["pokeball"]], 5, margin=140)
    vignette(img, 0.3)
    return img


SCENES = {
    "act0": act_forest, "act1": act_moon, "act2": act_coast,
    "act3": act_tower, "act4": act_safari, "act5": act_cerulean, "ranch": ranch,
}

def build_layered(name, fn, W, H, suffix):
    """Versión 2.5D: suelo + atlas de objetos de pie + JSON con sus posiciones."""
    global LAYERED
    import json
    LAYERED = {"props": [], "tint": None, "base": None, "fog": (10, 12, 24), "grass": []}
    ground = fn(W, H)
    L = LAYERED
    LAYERED = None
    out3d = os.path.join(ROOT, "assets", "arenas3d")
    os.makedirs(out3d, exist_ok=True)
    # objetos únicos (el mismo árbol se repite muchas veces)
    uniq, index = [], {}
    for o, x, y in L["props"]:
        if id(o) not in index:
            index[id(o)] = len(uniq)
            uniq.append(o)
    if L["tint"]:
        uniq = [tint(o, *L["tint"]) for o in uniq]
    # empaquetado en estanterías
    AW, x, y, rowh, rects = 1024, 0, 0, 0, []
    for o in uniq:
        if x + o.width > AW:
            x, y, rowh = 0, y + rowh + 2, 0
        rects.append((x, y, o.width, o.height))
        x += o.width + 2
        rowh = max(rowh, o.height)
    atlas = Image.new("RGBA", (AW, max(4, y + rowh)))
    for o, (ax, ay, _, _) in zip(uniq, rects):
        atlas.alpha_composite(o, (ax, ay))
    base = L["base"] if L["base"] is not None else Image.new("RGBA", (32, 32), (60, 60, 60, 255))
    if L["tint"]:
        base = tint(base, *L["tint"])
    prefix = f"{name}_{suffix}"
    ground.convert("RGB").save(os.path.join(out3d, f"{prefix}_ground.webp"), lossless=True, method=6)
    atlas.save(os.path.join(out3d, f"{prefix}_props.png"), optimize=True)
    base.convert("RGB").save(os.path.join(out3d, f"{prefix}_base.png"))
    data = {
        "w": W, "h": H, "fog": "#%02x%02x%02x" % L["fog"],
        "sprites": [list(r) for r in rects],
        # x, y = pie del objeto (centro abajo) en píxeles de la arena
        "props": [[index[id(o)], round(x + o.width / 2), round(y + o.height)] for o, x, y in L["props"]],
        # casillas de hierba alta (esquina superior izquierda, 32 px)
        "grass": L["grass"],
    }
    json.dump(data, open(os.path.join(out3d, f"{prefix}.json"), "w"), separators=(",", ":"))
    return len(data["props"]), len(uniq)


if __name__ == "__main__":
    import sys
    only3d = "--3d" in sys.argv
    for name, fn in SCENES.items():
        for suffix, (W, H) in (("h", (1280, 720)), ("v", (720, 1280))):
            if not only3d:
                random.seed(zlib.crc32((name + suffix).encode()))
                img = fn(W, H)
                img.convert("RGB").save(os.path.join(OUT, f"{name}_{suffix}.webp"), lossless=True, method=6)
            random.seed(zlib.crc32((name + suffix).encode()))
            n, u = build_layered(name, fn, W, H, suffix)
            print("ok", name, suffix, f"3D: {n} objetos ({u} distintos)")
