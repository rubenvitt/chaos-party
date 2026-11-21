"""
Nahbild einer Figur mit Blender als Python-Modul (CHAOS-162): ganze Figur aus der Nähe in der
ersten Idle-Pose, Dreiviertelansicht und Profil nebeneinander, zum Beurteilen von Form und
Detail ohne Mac und ohne Browser.

    .venv-blender/bin/python packages/assets/blender/nahbild.py sock <ziel.png> [--samples=64] [--atlas[=<rand>]]

Licht und Kamera wie die Porträts (`portrait.py`), Hintergrund neutral grau. Das Material
`akzent` behält die Vorgabefarbe aus dem Figurenskript.

`--atlas`: Farben wie im USDZ aus dem gebackenen Farbatlas statt aus den Vertexfarben
(`figurkit.bake_vertex_colors`); `--atlas=16` backt mit diesem Rand in Pixeln (CHAOS-234).
"""

from __future__ import annotations

import importlib
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import bpy  # noqa: E402

import figurkit as k  # noqa: E402
import portrait as p  # noqa: E402
import struktur  # noqa: E402

SIZE = 900
VIEWS = (("dreiviertel", 28.0, 6.0), ("profil", 90.0, 4.0), ("oben", 20.0, 38.0))


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
    atlas = "--atlas" in sys.argv[1:] or "atlas" in opts
    if len(args) != 2 or args[0] not in p.FRAMING:
        print(f"Aufruf: nahbild.py <{'|'.join(p.FRAMING)}> <ziel.png> [--samples=64] [--atlas[=<rand>]]")
        raise SystemExit(1)
    figure, target = args[0], Path(args[1]).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)

    importlib.import_module(figure).build()
    struktur.apply()  # Feinstruktur wie im Export (CHAOS-172)
    if atlas:
        margin = int(opts.get("atlas", k.ATLAS_BAKE_MARGIN))
        k.bake_vertex_colors(f"{figure}_farbe", bake_margin=margin)
    p.pose_idle()
    p.lights()
    p.render_settings(int(opts.get("samples", "64")), denoise=True)
    scene = bpy.context.scene
    scene.render.resolution_x = SIZE
    scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"

    paths = []
    for name, turn, tilt in VIEWS:
        for obj in [o for o in bpy.data.objects if o.type == "CAMERA"]:
            bpy.data.objects.remove(obj)
        p.camera(p.Framing(bottom=0.0, turn=turn, tilt=tilt, fill=1.15))
        out = target.with_name(f"{target.stem}-{name}.png")
        p.render(out)
        paths.append(out)

    # Nebeneinander in eine Datei.
    images = [bpy.data.images.load(str(path)) for path in paths]
    sheet = bpy.data.images.new("blatt", SIZE * len(images), SIZE, alpha=False)
    pixels = [0.0] * (SIZE * len(images) * SIZE * 4)
    for i, image in enumerate(images):
        src = list(image.pixels)
        for row in range(SIZE):
            a = row * SIZE * 4
            b = (row * SIZE * len(images) + i * SIZE) * 4
            pixels[b : b + SIZE * 4] = src[a : a + SIZE * 4]
    sheet.pixels = pixels
    sheet.filepath_raw = str(target)
    sheet.file_format = "PNG"
    sheet.save()
    for path in paths:
        path.unlink()
    print(f"Nahbild {figure} → {target} ({math.floor(len(images))} Ansichten)")


if __name__ == "__main__":
    main()
