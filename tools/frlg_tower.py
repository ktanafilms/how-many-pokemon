"""Reconstruye los metatiles de la Torre Pokémon de FireRed desde el desensamblado de pret/pokefirered
y los guarda en tools/tiles/frlg_tower.png (8 columnas de metatiles de 16 px).
Uso: python3 tools/frlg_tower.py   (descarga los datos de GitHub)"""
import io
import os
import ssl
import struct
import urllib.request
from PIL import Image

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = None
R = "https://raw.githubusercontent.com/pret/pokefirered/master/data/tilesets/"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def get(path):
    with urllib.request.urlopen(R + path, timeout=30, context=CTX) as r:
        return r.read()


def pal(text):
    return [tuple(map(int, line.split())) for line in text.decode().split("\n")[3:19]]


P = [pal(get(f"primary/building/palettes/{i:02d}.pal")) if i < 7 else pal(get(f"secondary/pokemon_tower/palettes/{i:02d}.pal")) for i in range(16)]
BIM = Image.open(io.BytesIO(get("primary/building/tiles.png")))
TIM = Image.open(io.BytesIO(get("secondary/pokemon_tower/tiles.png")))
META = get("secondary/pokemon_tower/metatiles.bin")


def tile(i, p, hf, vf):
    im = BIM if i < 640 else TIM
    i = i if i < 640 else i - 640
    w = im.width // 8
    t = im.crop(((i % w) * 8, (i // w) * 8, (i % w) * 8 + 8, (i // w) * 8 + 8)).load()
    out = Image.new("RGBA", (8, 8))
    o = out.load()
    for y in range(8):
        for x in range(8):
            if t[x, y]:
                o[x, y] = P[p][t[x, y]] + (255,)
    if hf:
        out = out.transpose(Image.FLIP_LEFT_RIGHT)
    if vf:
        out = out.transpose(Image.FLIP_TOP_BOTTOM)
    return out


n = len(META) // 16
sheet = Image.new("RGBA", (8 * 16, ((n + 7) // 8) * 16))
for m in range(n):
    ents = struct.unpack("<8H", META[m * 16:m * 16 + 16])
    img = Image.new("RGBA", (16, 16))
    for k, e in enumerate(ents):
        pos = k % 4
        img.alpha_composite(tile(e & 0x3FF, e >> 12, (e >> 10) & 1, (e >> 11) & 1), ((pos % 2) * 8, (pos // 2) * 8))
    sheet.alpha_composite(img, ((m % 8) * 16, (m // 8) * 16))
sheet.save(os.path.join(ROOT, "tools", "tiles", "frlg_tower.png"))
print(n, "metatiles")
