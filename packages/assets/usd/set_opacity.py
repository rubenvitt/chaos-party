"""Setzt die Deckkraft (`opacity`) von Materialien in fertigen USDZ (CHAOS-221).

    .venv-blender/bin/python -I packages/assets/usd/set_opacity.py '<json>'

`<json>`: `{"<pfad.usdz>": {"<material>": <alpha>, …}, …}`. Ruft `packages/assets/blender/props.py
--usdz` nach dem Export selbst auf.

Warum: Blenders USD-Export (5.3) schreibt `inputs:opacity` der `UsdPreviewSurface` immer als 1,
egal ob das Alpha der Principled BSDF als Wert, über einen Knoten oder mit einem anderen
Blend-Modus gesetzt ist. Ohne diesen Schritt wäre das Glas der Requisiten (Limoglas, Eiswürfel,
Honigglas, Bienenflügel) im Apple-Host undurchsichtig. Eigener Prozess mit usd-core, damit sich
dessen USD-Bibliotheken nicht mit den in `bpy` eingebauten mischen.
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

from pxr import Sdf, Usd, UsdShade, UsdUtils


def set_opacity(usdz: Path, alphas: dict[str, float]) -> None:
    with tempfile.TemporaryDirectory(prefix="set-opacity-") as tmp:
        work = Path(tmp)
        with zipfile.ZipFile(usdz) as package:
            names = package.namelist()
            package.extractall(work)
        layer = next(n for n in names if n.endswith((".usdc", ".usda", ".usd")))
        stage = Usd.Stage.Open(str(work / layer))
        materials = {p.GetName(): p for p in stage.Traverse() if p.IsA(UsdShade.Material)}
        for name, alpha in alphas.items():
            material = materials.get(name)
            if material is None:
                raise SystemExit(f"{usdz.name}: Material „{name}“ fehlt")
            surfaces = [
                UsdShade.Shader(p)
                for p in Usd.PrimRange(material)
                if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetIdAttr().Get() == "UsdPreviewSurface"
            ]
            if len(surfaces) != 1:
                raise SystemExit(f"{usdz.name}: Material „{name}“ hat {len(surfaces)} UsdPreviewSurface")
            surfaces[0].CreateInput("opacity", Sdf.ValueTypeNames.Float).Set(float(alpha))
        stage.GetRootLayer().Save()
        target = work / "neu.usdz"
        if not UsdUtils.CreateNewUsdzPackage(Sdf.AssetPath(str(work / layer)), str(target)):
            raise SystemExit(f"{usdz.name}: USDZ lässt sich nicht neu packen")
        shutil.move(target, usdz)


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    for path, alphas in json.loads(sys.argv[1]).items():
        set_opacity(Path(path), alphas)
        print(f"Deckkraft {Path(path).name}: {alphas}")


if __name__ == "__main__":
    main()
