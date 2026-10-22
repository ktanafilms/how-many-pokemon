"""Descarga sprites animados de PMD SpriteCollab (https://sprites.pmdcollab.org)
y genera assets/manifest.json con los datos de cada animación.

Uso:  python3 tools/fetch_sprites.py
"""
import json
import os
import sys
import ssl
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from struct import unpack

BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "assets", "pokemon")

# Toda la 1ª generación (151). Así añadir especies nuevas es sólo tocar datos.
DEX = list(range(1, 152))
WANTED = ["Walk", "Attack", "Hurt", "Idle", "Sleep"]


try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = None


def get(url):
    try:
        with urllib.request.urlopen(url, timeout=30, context=CTX) as r:
            return r.read()
    except Exception:
        return None


def png_size(data):
    w, h = unpack(">II", data[16:24])
    return w, h


def fetch(dex):
    did = f"{dex:04d}"
    folder = os.path.join(OUT, did)
    os.makedirs(folder, exist_ok=True)
    xml = get(f"{BASE}/sprite/{did}/AnimData.xml")
    if not xml:
        return dex, None
    root = ET.fromstring(xml)
    anims = {}
    for a in root.find("Anims"):
        anims[a.findtext("Name")] = a
    shadow = int(root.findtext("ShadowSize") or 1)

    def resolve(name, depth=0):
        a = anims.get(name)
        if a is None or depth > 4:
            return None, None
        copy = a.findtext("CopyOf")
        if copy:
            return resolve(copy, depth + 1)
        return name, a

    entry = {"shadow": shadow, "anims": {}}
    for want in WANTED:
        real, a = resolve(want)
        if a is None:
            continue
        fname = f"{real}-Anim.png"
        path = os.path.join(folder, fname)
        if not os.path.exists(path):
            data = get(f"{BASE}/sprite/{did}/{fname}")
            if not data:
                continue
            with open(path, "wb") as f:
                f.write(data)
        with open(path, "rb") as f:
            w, h = png_size(f.read(32))
        fw = int(a.findtext("FrameWidth"))
        fh = int(a.findtext("FrameHeight"))
        entry["anims"][want] = {
            "file": f"assets/pokemon/{did}/{fname}",
            "fw": fw,
            "fh": fh,
            "frames": w // fw,
            "rows": h // fh,
            "durations": [int(d.text) for d in a.find("Durations")],
            "hit": int(a.findtext("HitFrame") or -1),
        }
    portrait = os.path.join(folder, "portrait.png")
    if not os.path.exists(portrait):
        data = get(f"{BASE}/portrait/{did}/Normal.png")
        if data:
            with open(portrait, "wb") as f:
                f.write(data)
    if os.path.exists(portrait):
        entry["portrait"] = f"assets/pokemon/{did}/portrait.png"
    credits = get(f"{BASE}/sprite/{did}/credits.txt")
    if credits:
        entry["credits"] = credits.decode("utf-8", "replace").strip()
    return dex, entry


def main():
    manifest = {}
    with ThreadPoolExecutor(12) as ex:
        for dex, entry in ex.map(fetch, DEX):
            if entry and "Walk" in entry["anims"]:
                manifest[dex] = entry
                print(f"ok {dex:03d} {sorted(entry['anims'])}")
            else:
                print(f"FALTA {dex:03d}", file=sys.stderr)
    with open(os.path.join(ROOT, "assets", "manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    # Créditos legibles
    lines = ["# Créditos de sprites (PMD SpriteCollab)\n",
             "Sprites de https://sprites.pmdcollab.org — licencia CC BY-NC 4.0.\n",
             "Pokémon © Nintendo / Creatures / GAME FREAK. Proyecto fan sin ánimo de lucro.\n"]
    for dex in sorted(manifest):
        c = manifest[dex].get("credits", "")
        authors = sorted({l.split("\t")[1] for l in c.splitlines() if "\t" in l and len(l.split("\t")) > 1})
        lines.append(f"- #{dex:03d}: {', '.join(authors) or 'ver credits.txt del repositorio'}")
        manifest[dex].pop("credits", None)
    with open(os.path.join(ROOT, "CREDITS.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(ROOT, "assets", "manifest.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    print(len(manifest), "especies")
    print("Ahora ejecuta: python3 tools/feet.py")


if __name__ == "__main__":
    main()
