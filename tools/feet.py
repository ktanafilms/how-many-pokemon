"""Añade a assets/manifest.json la posición de los pies (`foot`) de cada sprite:
la fila más baja con píxeles en el primer frame de Walk. Requiere Pillow."""
import json
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
path = os.path.join(ROOT, "assets", "manifest.json")
m = json.load(open(path))
for dex, e in m.items():
    a = e["anims"]["Walk"]
    im = Image.open(os.path.join(ROOT, a["file"]))
    bottoms = []
    for row in range(a["rows"]):
        bb = im.crop((0, row * a["fh"], a["fw"], (row + 1) * a["fh"])).getbbox()
        if bb:
            bottoms.append(bb[3])
    e["foot"] = max(bottoms) if bottoms else a["fh"] // 2
json.dump(m, open(path, "w"), separators=(",", ":"))
print("ok", len(m))
