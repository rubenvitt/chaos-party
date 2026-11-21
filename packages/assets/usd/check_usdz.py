"""Prüft die USDZ-Artefakte für den nativen Apple-Host (CHAOS-140) ohne Blender und ohne Mac.

    .venv-blender/bin/python -I packages/assets/usd/check_usdz.py build/apple-assets

Braucht nur `usd-core` (Pixars USD als Python-Paket, `packages/assets/blender/requirements.txt`).
Exit-Code 1 bei Fehlern. Geprüft wird:

- jede USDZ mit allen Validatoren von usd-core (`UsdValidation`, u. a. Paket-Kapselung,
  Materialbindung, Skelett, Texturen);
- Figuren (`figuren/<id>.usdz`): Clip-Tabelle `<id>.clips.json` passt zur Zeitleiste und zu den
  Animationsnamen im Manifest; Material `akzent` vorhanden und gebunden; jedes Mesh hat ein
  Material (RealityKit zeigt Vertexfarben nur ohne Material, die Farbe muss also aus der
  Textur kommen); `UsdPreviewSurface` liest keine Vertexfarbe; jede gelesene UV-Primvar liegt am
  Mesh, mindestens ein Material hat eine Normal-Textur (raw, scale 2, bias -1; CHAOS-172);
  Knoten `abzeichen` vorne (+z);
  mit gebackenem Skinning Füße bei y = 0 und Höhe wie im Manifest; aufgesetzte Teile
  (`AUFLAGE`, z. B. Socken-Bündchen, Kaktus-Blüte) liegen in Ruhepose und in jedem Clip auf
  ihrem Träger auf, statt darüber zu schweben (CHAOS-161);
- Bretter (`bretter/<brett-id>/brett.usdz`, CHAOS-212): jeder Feld-Anker aus `brett.szene.json`
  daneben genau einmal und am richtigen Ort, alle Grundmeshes der Instanz-Gruppen vorhanden,
  Texturen eingebettet, `board` in `brett.szene.json` gleich dem Ordnernamen;
- Requisiten (`requisiten/<id>.usdz`, CHAOS-221): Manifest-Eintrag `requisit-<id>`, Wurzel-Prim
  `<id>`, Boden bei y = 0, Grundfläche mittig, Höhe wie im Manifest; Materialien dieselben wie im
  GLB aus CHAOS-88 (`PROP_MATERIALS`); jedes Mesh hat ein Material, keine Vertexfarbe im Shader,
  die Farbe kommt aus einer eingebetteten Textur; Laufzeit-Materialien (`akzent`, `zustand`)
  weiß und ohne Textur, damit der Host sie färben kann; `glas` durchscheinend;
- mit `--vollstaendig`: jedes Artefakt aus `builds.apple-host` im Manifest liegt vor (so prüft
  der volle Build, dass alle Bretter des Registers erzeugt wurden).

RealityKit selbst prüft das nicht: Laden und Aussehen bleiben eine Prüfung am Mac
(`packages/assets/usd/check_realitykit.swift`, Gerätecheckliste).
"""

from __future__ import annotations

import json
import math
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np
from pxr import Gf, Usd, UsdGeom, UsdShade, UsdSkel, UsdValidation

HEIGHT_TOLERANCE = 0.1
"""Meter. Die Manifest-Höhe gilt für die Ruhepose, gemessen wird im ersten Bild von `idle`."""
FEET_TOLERANCE = 0.02
ANCHOR_TOLERANCE = 1e-3

AUFLAGE: dict[str, list[tuple[str, str]]] = {
    "sock": [("buendchen", "socke")],
    "cactus": [("bluete", "kaktus"), ("kaktus", "topf")],
}
"""CHAOS-161: Teil → Träger je Figur (Namen der Blender-Objekte = Xform-Prims im USD).

Die Unterseite des Teils (unterste `AUFLAGE_BAND` Meter) muss den Träger berühren oder in ihm
stecken. Gemessen wird je Punkt der Unterseite der Abstand zur Trägeroberfläche (Punkte im
Träger zählen 0); der Median dieser Abstände darf `AUFLAGE_LUECKE` nicht übersteigen. Der Median
lässt einen Überstand am Rand zu (das Bündchen ist dicker als der Schaft), aber keine Lücke.
Alter Export: Bündchen 10,2 cm, Blüte 9,4 cm, obwohl die Bounds stimmten (die Kuppel aus
Skin-Modifier und Subdivision endet weit unter der Knotenhöhe). Neuer: 1,5 cm und 0,7 cm.
Der Waschbär-Kopf steht bewusst über (großer Kopf auf schmalem Hals) und ist nicht in der Liste.
"""
AUFLAGE_BAND = 0.02
AUFLAGE_LUECKE = 0.03

PROP_MATERIALS = ("lack", "matt", "glas", "metall", "akzent", "zustand")
"""Wie `PROP_MATERIALS` in `packages/assets/src/props.ts`."""
PROP_RUNTIME = ("akzent", "zustand")
"""Laufzeit-Materialien: weiß, ohne Textur; der Host färbt sie (Slot-Farbe, Spielzustand)."""
PROP_GROUND_TOLERANCE = 0.005
"""Meter. `requisitkit.Prop.finish` stellt das Requisit exakt auf den Boden und mittig."""
PROP_HEIGHT_TOLERANCE = 0.01

errors: list[str] = []
notes: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def validate(path: Path) -> None:
    stage = Usd.Stage.Open(str(path))
    validators = UsdValidation.ValidationRegistry().GetOrLoadAllValidators()
    found = UsdValidation.ValidationContext(validators).Validate(stage)
    for error in found:
        if error.GetType() == UsdValidation.ValidationErrorType.Error:
            fail(f"{path.name}: {error.GetName()}: {error.GetMessage()}")


def world_bounds(stage: Usd.Stage, time: float) -> Gf.Range3d:
    cache = UsdGeom.BBoxCache(time, [UsdGeom.Tokens.default_])
    return cache.ComputeWorldBound(stage.GetPseudoRoot()).ComputeAlignedRange()


def baked(path: Path, tmp: Path, end: float) -> Usd.Stage:
    """Kopie der Figur mit gebackenem Skinning (Punkte je Bild statt Skelett)."""
    flat = tmp / f"{path.stem}_flat.usdc"
    Usd.Stage.Open(str(path)).Export(str(flat))
    stage = Usd.Stage.Open(str(flat))
    if any(p.IsA(UsdSkel.Root) for p in stage.Traverse()):
        if not UsdSkel.BakeSkinning(stage.Traverse(), Gf.Interval(stage.GetStartTimeCode(), end)):
            fail(f"{path.name}: Skinning lässt sich nicht backen")
    return stage


def _mesh_world(stage: Usd.Stage, part: str, time: float) -> tuple[np.ndarray, np.ndarray] | None:
    """Punkte (Welt) und Dreiecke aller Meshes unter dem Prim `part` zum Zeitpunkt `time`."""
    xf = UsdGeom.XformCache(time)
    points: list[np.ndarray] = []
    tris: list[np.ndarray] = []
    offset = 0
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh) or part not in (prim.GetName(), prim.GetParent().GetName()):
            continue
        mesh = UsdGeom.Mesh(prim)
        local = np.array(mesh.GetPointsAttr().Get(time), dtype=np.float64)
        m = np.array(xf.GetLocalToWorldTransform(prim), dtype=np.float64)
        world = local @ m[:3, :3] + m[3, :3]
        counts = mesh.GetFaceVertexCountsAttr().Get()
        indices = np.array(mesh.GetFaceVertexIndicesAttr().Get())
        flip = mesh.GetOrientationAttr().Get() == UsdGeom.Tokens.leftHanded
        at = 0
        for n in counts:
            face = indices[at : at + n]
            for i in range(1, n - 1):
                tri = [face[0], face[i + 1], face[i]] if flip else [face[0], face[i], face[i + 1]]
                tris.append(np.array(tri) + offset)
            at += n
        points.append(world)
        offset += len(world)
    if not points:
        return None
    return np.concatenate(points), np.array(tris)


def _surface_samples(points: np.ndarray, tris: np.ndarray, steps: int = 6) -> tuple[np.ndarray, np.ndarray]:
    """Dichte Stichprobe der Oberfläche (baryzentrisches Raster je Dreieck) mit Flächennormalen."""
    a, b, c = points[tris[:, 0]], points[tris[:, 1]], points[tris[:, 2]]
    normals = np.cross(b - a, c - a)
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)
    samples, sample_normals = [], []
    for i in range(steps + 1):
        for j in range(steps + 1 - i):
            u, v = i / steps, j / steps
            samples.append(a + (b - a) * u + (c - a) * v)
            sample_normals.append(normals)
    return np.concatenate(samples), np.concatenate(sample_normals)


def contact_gap(stage: Usd.Stage, part: str, host: str, time: float, rest: float) -> float | None:
    """Lücke zwischen der Unterseite von `part` und der Oberfläche von `host` (Meter).

    Die Unterseite wird in der Ruhepose (`rest`) bestimmt und als dieselben Punkte verfolgt;
    sonst wäre bei `fall` (Figur kippt) eine Seite die „Unterseite“.
    """
    p = _mesh_world(stage, part, time)
    h = _mesh_world(stage, host, time)
    p_rest = _mesh_world(stage, part, rest)
    if p is None or h is None or p_rest is None:
        return None
    rest_y = p_rest[0][:, 1]
    bottom = p[0][rest_y <= rest_y.min() + AUFLAGE_BAND]
    surface, normals = _surface_samples(*h)
    gaps = []
    for chunk in np.array_split(bottom, max(1, math.ceil(len(bottom) / 256))):
        d = np.linalg.norm(chunk[:, None, :] - surface[None, :, :], axis=2)
        nearest = d.argmin(axis=1)
        dist = d[np.arange(len(chunk)), nearest]
        # Im Träger (hinter der nächsten Fläche) zählt als Auflage.
        inside = np.einsum("ij,ij->i", chunk - surface[nearest], normals[nearest]) < 0
        gaps.append(np.where(inside, 0.0, dist))
    return float(np.median(np.concatenate(gaps)))


def check_contacts(path: Path, stage: Usd.Stage, clips: list[dict]) -> None:
    """Aufgesetzte Teile schweben nicht (CHAOS-161): Ruhepose und Anfang/Mitte jedes Clips."""
    times = [float(clips[0]["startFrame"])]
    for clip in clips:
        times += [float(clip["startFrame"]), (clip["startFrame"] + clip["endFrame"]) / 2]
    for part, host in AUFLAGE.get(path.stem, []):
        worst = (0.0, times[0])
        for time in sorted(set(times)):
            gap = contact_gap(stage, part, host, time, times[0])
            if gap is None:
                fail(f"{path.name}: Teil „{part}“ oder Träger „{host}“ fehlt")
                return
            worst = max(worst, (gap, time))
        if worst[0] > AUFLAGE_LUECKE:
            fail(
                f"{path.name}: „{part}“ schwebt über „{host}“ ({worst[0] * 100:.1f} cm Lücke bei Bild "
                f"{worst[1]:g}, erlaubt {AUFLAGE_LUECKE * 100:.0f} cm)"
            )
        else:
            notes.append(f"{path.name}: „{part}“ liegt auf „{host}“ (höchstens {worst[0] * 100:.1f} cm)")


def check_figure(path: Path, manifest: dict, tmp: Path) -> None:
    figure = path.stem
    entry = next((a for a in manifest["assets"] if a["id"] == f"figur-{figure}"), None)
    if entry is None:
        fail(f"{path.name}: kein Manifest-Eintrag figur-{figure}")
        return
    clips_path = path.with_suffix(".clips.json")
    if not clips_path.exists():
        fail(f"{path.name}: {clips_path.name} fehlt")
        return
    table = json.loads(clips_path.read_text())
    clips = table["clips"]
    stage = Usd.Stage.Open(str(path))

    names = [c["name"] for c in clips]
    if sorted(names) != sorted(entry["animations"]):
        fail(f"{path.name}: Clips {names} ≠ Manifest {entry['animations']}")
    if stage.GetTimeCodesPerSecond() != table["fps"]:
        fail(f"{path.name}: {stage.GetTimeCodesPerSecond()} Bilder/s in USD, {table['fps']} in der Tabelle")
    if stage.GetStartTimeCode() != clips[0]["startFrame"] or stage.GetEndTimeCode() != clips[-1]["endFrame"]:
        fail(
            f"{path.name}: Zeitleiste {stage.GetStartTimeCode()}–{stage.GetEndTimeCode()} passt nicht "
            f"zur Tabelle {clips[0]['startFrame']}–{clips[-1]['endFrame']}"
        )
    for a, b in zip(clips, clips[1:]):
        if b["startFrame"] <= a["endFrame"]:
            fail(f"{path.name}: Clips {a['name']} und {b['name']} überlappen")

    materials = {p.GetName(): p for p in stage.Traverse() if p.IsA(UsdShade.Material)}
    if "akzent" not in materials:
        fail(f"{path.name}: Material „akzent“ fehlt (Slot-Farbe), vorhanden: {sorted(materials)}")
    bound: set[str] = set()
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        material, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
        if not material:
            fail(f"{path.name}: Mesh {prim.GetPath()} ohne Material")
            continue
        bound.add(material.GetPrim().GetName())
        # CHAOS-172: Farbatlas (`st`) und Feinstruktur (`struktur`) lesen verschiedene UV-Maps;
        # jede gelesene Primvar muss am Mesh liegen, sonst zeigt RealityKit Unsinn.
        primvars = {pv.GetPrimvarName() for pv in UsdGeom.PrimvarsAPI(prim).GetPrimvars()}
        for shader in Usd.PrimRange(material.GetPrim()):
            if shader.IsA(UsdShade.Shader) and UsdShade.Shader(shader).GetIdAttr().Get() == "UsdPrimvarReader_float2":
                varname = UsdShade.Shader(shader).GetInput("varname").Get()
                if varname not in primvars:
                    fail(f"{path.name}: {prim.GetPath()} hat keine UV-Primvar „{varname}“ ({shader.GetPath()})")
    if "akzent" in materials and "akzent" not in bound:
        fail(f"{path.name}: Material „akzent“ an keinem Mesh")
    structured: list[str] = []
    for prim in stage.Traverse():
        if prim.IsA(UsdShade.Shader):
            shader_id = UsdShade.Shader(prim).GetIdAttr().Get()
            if shader_id == "UsdPrimvarReader_float3":
                fail(f"{path.name}: {prim.GetPath()} liest eine Vertexfarbe (RealityKit ignoriert das)")
            if shader_id == "UsdPreviewSurface":
                normal = UsdShade.Shader(prim).GetInput("normal")
                sources = normal.GetConnectedSources()[0] if normal else []
                if not sources:
                    continue
                texture = UsdShade.Shader(sources[0].source.GetPrim())
                space = texture.GetInput("sourceColorSpace")
                if not space or space.Get() != "raw":
                    fail(f"{path.name}: Normal-Textur an {prim.GetPath()} nicht als „raw“ gelesen")
                scale, bias = texture.GetInput("scale"), texture.GetInput("bias")
                if not scale or not bias or tuple(scale.Get())[:3] != (2, 2, 2) or tuple(bias.Get())[:3] != (-1, -1, -1):
                    fail(f"{path.name}: Normal-Textur an {prim.GetPath()} ohne scale 2 / bias -1")
                structured.append(prim.GetParent().GetName())
    if not structured:
        fail(f"{path.name}: keine Feinstruktur (Normal-Textur) gefunden (CHAOS-172)")
    else:
        notes.append(f"{path.name}: Feinstruktur an {sorted(structured)}")

    badge = [p for p in stage.Traverse() if p.GetName() == "abzeichen"]
    if len(badge) != 1:
        fail(f"{path.name}: {len(badge)} Knoten „abzeichen“ statt genau einem")
    else:
        at = UsdGeom.Xformable(badge[0]).ComputeLocalToWorldTransform(stage.GetStartTimeCode())
        z = at.ExtractTranslation()[2]
        if z <= 0:
            fail(f"{path.name}: „abzeichen“ hinter der Figur (z = {z:.3f}); Vorderseite muss +z sein")

    skinned = baked(path, tmp, float(clips[-1]["endFrame"]))
    idle = next((c for c in clips if c["name"] == "idle"), clips[0])
    box = world_bounds(skinned, float(idle["startFrame"]))
    feet, top = box.GetMin()[1], box.GetMax()[1]
    if abs(feet) > FEET_TOLERANCE:
        fail(f"{path.name}: Füße bei y = {feet:.3f} statt 0")
    if "height" in entry and abs(top - feet - entry["height"]) > HEIGHT_TOLERANCE:
        fail(f"{path.name}: Höhe {top - feet:.3f} m, Manifest {entry['height']} m")
    check_contacts(path, skinned, clips)
    notes.append(
        f"{path.name}: {path.stat().st_size / 1024:.0f} KiB, {len(clips)} Clips bis "
        f"{clips[-1]['end']:.2f} s, Höhe {top - feet:.3f} m, Materialien {sorted(materials)}"
    )


def check_board(path: Path) -> None:
    label = f"{path.parent.name}/{path.name}"
    scene_path = path.parent / "brett.szene.json"
    if not scene_path.exists():
        fail(f"{label}: brett.szene.json fehlt")
        return
    meta = json.loads(scene_path.read_text())
    stage = Usd.Stage.Open(str(path))
    by_name: dict[str, list[Usd.Prim]] = {}
    for prim in stage.Traverse():
        by_name.setdefault(prim.GetName(), []).append(prim)

    if path.parent.parent.name == "bretter" and meta.get("board") != path.parent.name:
        fail(f"{path.parent.name}/brett.szene.json: board = {meta.get('board')!r} statt {path.parent.name!r}")

    fields = meta.get("fields", [])
    if not fields:
        fail("brett.szene.json: keine Felder (`fields`)")
    for field in fields:
        prims = by_name.get(field["anchor"], [])
        if len(prims) != 1:
            fail(f"{label}: Feld-Anker {field['anchor']} {len(prims)}× statt genau einmal")
            continue
        at = UsdGeom.Xformable(prims[0]).ComputeLocalToWorldTransform(Usd.TimeCode.Default())
        got = at.ExtractTranslation()
        want = Gf.Vec3d(*field["position"])
        if (got - want).GetLength() > ANCHOR_TOLERANCE:
            fail(f"{label}: Feld-Anker {field['anchor']} bei {tuple(round(v, 3) for v in got)}, erwartet {tuple(want)}")

    for group in meta.get("instanced", []):
        name = group["mesh"].replace("-", "_")
        if name not in by_name:
            fail(f"{label}: Grundmesh {name} der Instanz-Gruppe {group['mesh']} fehlt")

    with zipfile.ZipFile(path) as package:
        textures = [n for n in package.namelist() if n.lower().endswith((".png", ".jpg", ".jpeg"))]
    if not textures:
        fail(f"{label}: keine Texturen eingebettet")
    notes.append(
        f"{label}: {path.stat().st_size / 1024 / 1024:.1f} MiB, {len(fields)} Feld-Anker, "
        f"{len(meta.get('instanced', []))} Instanz-Gruppen, {len(textures)} Texturen"
    )


def glb_materials(path: Path) -> dict[str, float]:
    """Materialnamen und Alpha (`baseColorFactor[3]`) aus dem JSON-Teil einer GLB-Datei."""
    data = path.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    doc = json.loads(data[20 : 20 + length])
    return {
        m.get("name", ""): float(m.get("pbrMetallicRoughness", {}).get("baseColorFactor", [1, 1, 1, 1])[3])
        for m in doc.get("materials", [])
    }


def check_prop(path: Path, manifest: dict, repo: Path) -> None:
    """Requisit (CHAOS-221): Vertrag wie das GLB aus CHAOS-88, Farbe aus der Textur."""
    prop = path.stem
    label = f"requisiten/{path.name}"
    entry = next((a for a in manifest["assets"] if a["id"] == f"requisit-{prop}"), None)
    if entry is None:
        fail(f"{label}: kein Manifest-Eintrag requisit-{prop}")
        return
    stage = Usd.Stage.Open(str(path))
    if UsdGeom.GetStageUpAxis(stage) != UsdGeom.Tokens.y:
        fail(f"{label}: Achse oben ist {UsdGeom.GetStageUpAxis(stage)} statt Y")
    root_name = prop.replace("-", "_")
    if not [p for p in stage.Traverse() if p.GetName() == root_name and p.IsA(UsdGeom.Xform)]:
        fail(f"{label}: Wurzelknoten „{root_name}“ fehlt")

    materials = {p.GetName(): p for p in stage.Traverse() if p.IsA(UsdShade.Material)}
    unknown = sorted(set(materials) - set(PROP_MATERIALS))
    if unknown:
        fail(f"{label}: unbekannte Materialien {unknown} (erlaubt: {list(PROP_MATERIALS)})")
    glb = repo / entry["path"]
    expected: dict[str, float] = {}
    if glb.exists():
        expected = glb_materials(glb)
        if set(expected) != set(materials):
            fail(f"{label}: Materialien {sorted(materials)} ≠ GLB {sorted(expected)}")
    else:
        fail(f"{label}: GLB {entry['path']} fehlt zum Vergleich")

    bound: set[str] = set()
    for prim in stage.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        material, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
        if not material:
            fail(f"{label}: Mesh {prim.GetPath()} ohne Material")
            continue
        name = material.GetPrim().GetName()
        bound.add(name)
        if prim.GetName() != f"{root_name}_{name}":
            fail(f"{label}: Mesh {prim.GetName()} statt {root_name}_{name} (ein Mesh je Material)")
        primvars = {pv.GetPrimvarName() for pv in UsdGeom.PrimvarsAPI(prim).GetPrimvars()}
        for shader in Usd.PrimRange(material.GetPrim()):
            if shader.IsA(UsdShade.Shader) and UsdShade.Shader(shader).GetIdAttr().Get() == "UsdPrimvarReader_float2":
                varname = UsdShade.Shader(shader).GetInput("varname").Get()
                if varname not in primvars:
                    fail(f"{label}: {prim.GetPath()} hat keine UV-Primvar „{varname}“")
    for name in sorted(set(materials) - bound):
        fail(f"{label}: Material „{name}“ an keinem Mesh")

    for name, mat in materials.items():
        surfaces = [
            UsdShade.Shader(p)
            for p in Usd.PrimRange(mat)
            if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetIdAttr().Get() == "UsdPreviewSurface"
        ]
        for p in Usd.PrimRange(mat):
            if p.IsA(UsdShade.Shader) and UsdShade.Shader(p).GetIdAttr().Get() == "UsdPrimvarReader_float3":
                fail(f"{label}: {p.GetPath()} liest eine Vertexfarbe (RealityKit ignoriert das)")
        if len(surfaces) != 1:
            fail(f"{label}: Material „{name}“ hat {len(surfaces)} UsdPreviewSurface statt einer")
            continue
        diffuse = surfaces[0].GetInput("diffuseColor")
        sources = diffuse.GetConnectedSources()[0] if diffuse else []
        if name in PROP_RUNTIME:
            color = diffuse.Get() if diffuse else None
            if sources or color is None or any(abs(c - 1.0) > 1e-3 for c in color):
                fail(f"{label}: Laufzeit-Material „{name}“ nicht weiß und ohne Textur (färbt der Host)")
        elif not sources or UsdShade.Shader(sources[0].source.GetPrim()).GetIdAttr().Get() != "UsdUVTexture":
            fail(f"{label}: Material „{name}“ ohne Farbtextur (Vertexfarben gebacken?)")
        # Deckkraft wie im GLB (Glas 0,55); Blenders USD-Export lässt sie sonst bei 1 (set_opacity.py).
        opacity_input = surfaces[0].GetInput("opacity")
        opacity = opacity_input.Get() if opacity_input else None
        opacity = 1.0 if opacity is None else float(opacity)
        want = expected.get(name, 1.0)
        if abs(opacity - want) > 1e-3:
            fail(f"{label}: Deckkraft von „{name}“ {opacity:.2f}, im GLB {want:.2f}")

    with zipfile.ZipFile(path) as package:
        textures = [n for n in package.namelist() if n.lower().endswith(".png")]
    if set(materials) - set(PROP_RUNTIME) and not textures:
        fail(f"{label}: keine Farbtextur eingebettet")

    box = world_bounds(stage, Usd.TimeCode.Default().GetValue())
    lo, hi = box.GetMin(), box.GetMax()
    if abs(lo[1]) > PROP_GROUND_TOLERANCE:
        fail(f"{label}: Boden bei y = {lo[1]:.3f} statt 0")
    for axis, name in ((0, "x"), (2, "z")):
        middle = (lo[axis] + hi[axis]) / 2
        if abs(middle) > PROP_GROUND_TOLERANCE:
            fail(f"{label}: Grundfläche nicht mittig ({name} = {middle:.3f})")
    height = hi[1] - lo[1]
    if "height" in entry and abs(height - entry["height"]) > PROP_HEIGHT_TOLERANCE:
        fail(f"{label}: Höhe {height:.3f} m, Manifest {entry['height']} m")
    notes.append(
        f"{label}: {path.stat().st_size / 1024:.0f} KiB, Höhe {height:.3f} m, "
        f"Materialien {sorted(materials)}, {len(textures)} Textur(en)"
    )


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print("Aufruf: check_usdz.py <ordner> [--manifest=<packages/assets/manifest.json>] [--vollstaendig]")
        raise SystemExit(2)
    root = Path(args[0])
    manifest_arg = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--manifest=")), None)
    manifest_path = Path(manifest_arg) if manifest_arg else Path(__file__).parents[1] / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    files = (
        sorted(root.glob("*.usdz"))
        + sorted((root / "figuren").glob("*.usdz"))
        + sorted((root / "bretter").glob("*/brett.usdz"))
        + sorted((root / "requisiten").glob("*.usdz"))
    )
    if not files:
        fail(f"{root}: keine USDZ-Dateien")
    if "--vollstaendig" in sys.argv[1:]:
        for artifact in manifest.get("builds", {}).get("apple-host", {}).get("artifacts", []):
            if not (root / artifact["path"]).exists():
                fail(f"{artifact['path']} fehlt (Artefakt {artifact['id']} im Manifest)")
    tmp = Path(tempfile.mkdtemp(prefix="check-usdz-"))
    try:
        for path in files:
            validate(path)
            if path.parent.name == "figuren":
                check_figure(path, manifest, tmp)
            elif path.name == "brett.usdz":
                check_board(path)
            elif path.parent.name == "requisiten":
                check_prop(path, manifest, manifest_path.resolve().parents[2])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if errors:
        print(f"USDZ-Prüfung fehlgeschlagen ({len(errors)} Fehler):")
        for e in errors:
            print(f"  ✗ {e}")
        raise SystemExit(1)
    for n in notes:
        print(f"  ✓ {n}")
    print(f"USDZ ok: {len(files)} Dateien geprüft.")


if __name__ == "__main__":
    main()
