"""Junta las animaciones de cada Pokémon en una sola imagen (assets/packed/XXXX.png)
para que el juego cargue ~5 veces menos archivos. Añade `sheet` e `y` al manifest.
Uso: python3 tools/pack_sprites.py   (después de fetch_sprites.py y feet.py)"""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
path = os.path.join(ROOT, "assets", "manifest.json")
out_dir = os.path.join(ROOT, "assets", "packed")
os.makedirs(out_dir, exist_ok=True)
m = json.load(open(path))
total = 0
for dex, e in m.items():
    imgs = {name: Image.open(os.path.join(ROOT, a["file"])).convert("RGBA") for name, a in e["anims"].items()}
    W = max(i.width for i in imgs.values())
    H = sum(i.height for i in imgs.values())
    sheet = Image.new("RGBA", (W, H))
    y = 0
    for name, im in imgs.items():
        sheet.paste(im, (0, y))
        e["anims"][name]["y"] = y
        y += im.height
    f = f"assets/packed/{int(dex):04d}.png"
    sheet.save(os.path.join(ROOT, f), optimize=True)
    e["sheet"] = f
    total += os.path.getsize(os.path.join(ROOT, f))
json.dump(m, open(path, "w"), separators=(",", ":"))
print(len(m), "hojas,", total // 1024, "KB")
