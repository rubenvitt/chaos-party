"""
Baut die Requisiten der Minispiele als GLB (CHAOS-88) oder USDZ (CHAOS-221) und rendert einen
Kontaktbogen.

    .venv-blender/bin/python packages/assets/blender/props.py <id|all> <zielordner>
    .venv-blender/bin/python packages/assets/blender/props.py --usdz <id|all> <zielordner>
    .venv-blender/bin/python packages/assets/blender/props.py --vorschau <bild.jpg|bild.png>

GLB: je Requisit `<zielordner>/<id>.glb`, statisch (kein Skelett, keine Animation), ein Mesh je
Material, Wurzelknoten mit dem Namen des Requisits.

USDZ (nativer Apple-Host, ADR-019): je Requisit `<zielordner>/<id>.usdz` aus demselben Modell.
RealityKit ignoriert Vertexfarben im Material (EXP-017), deshalb backt der Export sie wie bei den
Figuren in eine Farbtextur (`figurkit.bake_vertex_colors`, `PROP_ATLAS_SIZE`²). Die
Laufzeit-Materialien `akzent` und `zustand` bleiben weiß und ohne Textur, damit der Host sie
färben kann. Prims: `/root/<id>/<id>_<material>` (Bindestriche werden in USD zu `_`). Die
Deckkraft durchscheinender Materialien (`glas`) setzt danach `packages/assets/usd/set_opacity.py`
mit usd-core, weil Blenders USD-Export das Alpha nicht überträgt.

Kontaktbogen: alle Requisiten in einer Reihe nach Sets mit Figur-Maßstab (1,5-m-Stab), Cycles,
Natur-Licht.
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import figurkit as k  # noqa: E402  (importiert bpy zuerst)
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import requisiten  # noqa: E402


def build(prop_id: str) -> list[bpy.types.Object]:
    k.reset()
    prop = requisiten.PROPS[prop_id]()
    return prop.finish()


def export(prop_id: str, target: Path) -> None:
    build(prop_id)
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
    )
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for p in o.data.polygons)
    print(f"Requisit {prop_id} → {target} ({tris} Dreiecke)")


PROP_ATLAS_SIZE = 256
"""Kantenlänge der Farbtextur je Requisit. Vertexfarben sind flächig (wenige Farbwechsel je
Teil), 256² reicht dafür (CHAOS-221)."""
PROP_ISLAND_MARGIN = 0.02
"""Abstand der UV-Inseln (≈ 5 px bei 256²)."""
PROP_BAKE_MARGIN = 2
"""Bake-Rand in Pixeln, kleiner als der Inselabstand (siehe `figurkit.bake_vertex_colors`)."""


def export_usdz(prop_id: str, target: Path) -> dict[str, float]:
    """Requisit als USDZ: Vertexfarben als Farbtextur, `UsdPreviewSurface` je Material.

    Gibt das Alpha der durchscheinenden Materialien zurück (für `set_opacity.py`).
    """
    meshes = build(prop_id)
    alphas: dict[str, float] = {}
    for obj in meshes:
        for mat in obj.data.materials:
            alpha = mat.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value
            if alpha < 1.0:
                alphas[mat.name] = round(float(alpha), 4)
    with tempfile.TemporaryDirectory() as tmp:
        image = k.bake_vertex_colors(
            f"{prop_id}_farbe",
            size=PROP_ATLAS_SIZE,
            pack_shape="AABB",
            island_margin=PROP_ISLAND_MARGIN,
            bake_margin=PROP_BAKE_MARGIN,
        )
        # Die Vertexfarbe steckt jetzt in der Textur; als Primvar `Farbe` wäre sie nur Ballast
        # (`export_mesh_colors=False` lässt sie im USD-Export von Blender 5.3 nicht weg).
        for obj in meshes:
            for attribute in list(obj.data.color_attributes):
                obj.data.color_attributes.remove(attribute)
        if image is not None:
            image.filepath_raw = f"{tmp}/{prop_id}_farbe.png"
            image.file_format = "PNG"
            image.save()
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.wm.usd_export(
            filepath=str(target),
            export_animation=False,
            export_armatures=False,
            export_materials=True,
            generate_preview_surface=True,
            export_textures_mode="NEW",
            convert_orientation=True,
            export_global_forward_selection="NEGATIVE_Z",
            export_global_up_selection="Y",
            export_lights=False,
            export_cameras=False,
            export_custom_properties=False,
            root_prim_path="/root",
        )
    tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    print(f"Requisit {prop_id} → {target} ({tris} Dreiecke, {target.stat().st_size / 1024:.0f} KiB)")
    return alphas


def set_opacity(alphas: dict[str, dict[str, float]]) -> None:
    """Deckkraft in den fertigen USDZ nachtragen (eigener Prozess mit usd-core)."""
    if not alphas:
        return
    script = Path(__file__).parents[1] / "usd" / "set_opacity.py"
    subprocess.run([sys.executable, "-I", str(script), json.dumps(alphas)], check=True)


# ---------------------------------------------------------------------------------------------
# Kontaktbogen
# ---------------------------------------------------------------------------------------------

ROWS = [
    ["eichel", "eichel-faul", "kescher", "sammelkorb", "rasensprenger", "schlauchtrommel", "toaster", "toast", "mausefalle", "kaese"],
    ["bienenstock", "honigtopf", "biene", "tuerschild", "matscheimer", "zitronenscheibe", "zaunfeld", "blumentopf", "giesskanne", "kochtopf", "milchkanne", "holzloeffel"],
    ["tuer", "regenwolke", "eiswuerfel", "strohhalm", "limoglas"],
]
"""Reihen des Kontaktbogens nach Größe (große Kulissen hinten)."""

SLOT_PREVIEW = k.hex_color("#E69F00")
"""Laufzeit-Material `akzent` im Bild in einer Slot-Farbe, `zustand` in Goldbraun."""
STATE_PREVIEW = k.hex_color("#d9a25a")


def contact_sheet(target: Path) -> None:
    k.reset()
    placed: list[tuple[str, list[bpy.types.Object], float]] = []
    for row_index, row in enumerate(ROWS):
        x = 0.0
        y = [0.0, 1.6, 5.0][row_index]
        for prop_id in row:
            prop = requisiten.PROPS[prop_id]()
            meshes = prop.finish()
            root = meshes[0].parent
            pts = [v.co for o in meshes for v in o.data.vertices]
            width = max(p.x for p in pts) - min(p.x for p in pts)
            x += width / 2 + 0.25
            root.location = (x, y, 0)
            # Gefallene Requisiten schräg zur Kamera drehen (Dreiviertelansicht).
            root.rotation_euler = (0, 0, math.radians(-20))
            x += width / 2 + 0.25
            placed.append((prop_id, meshes, x))
        if row_index == 0:
            stab = k.cylinder("massstab", (-0.3, y, 0.75), 0.03, 1.5, segments=12)
            k.solid(stab, k.hex_color("#1b1530"))
    for mat in bpy.data.materials:
        if mat.name in ("akzent", "zustand"):
            bsdf = mat.node_tree.nodes["Principled BSDF"]
            bsdf.inputs["Base Color"].default_value = (*(SLOT_PREVIEW if mat.name == "akzent" else STATE_PREVIEW), 1.0)
    width = max(x for _, _, x in placed)
    ground = k.cylinder("boden", (width / 2, 3.0, -0.02), width * 0.8, 0.04, segments=64)
    k.assign(ground, k.material("boden", color=k.hex_color("#9ec27a"), roughness=0.9))
    stab_obj = bpy.data.objects.get("massstab")
    if stab_obj is not None:
        k.assign(stab_obj, k.material("tinte", color=k.hex_color("#1b1530"), roughness=0.6))

    scene = bpy.context.scene
    bpy.context.view_layer.update()
    corners = [
        o.matrix_world @ v.co
        for _, meshes, _ in placed
        for o in meshes
        for v in o.data.vertices
    ]
    view = Vector((0, -20, 11)).normalized()
    right = Vector((1, 0, 0))
    up = view.cross(right).normalized() * -1
    xs = [c.dot(right) for c in corners]
    ys = [c.dot(up) for c in corners]
    center = right * (min(xs) + max(xs)) / 2 + up * (min(ys) + max(ys)) / 2
    cam_data = bpy.data.cameras.new("kamera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * 16 / 9) * 1.06
    cam = bpy.data.objects.new("kamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = center + view * 40
    cam.rotation_euler = (-view).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    sun_data = bpy.data.lights.new("sonne", "SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.95, 0.86)
    sun_data.angle = math.radians(6)
    sun = bpy.data.objects.new("sonne", sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(-25), math.radians(-35))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("himmel")
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.62, 0.74, 0.88, 1.0)
    bg.inputs["Strength"].default_value = 0.9
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    if target.suffix.lower() in (".jpg", ".jpeg"):
        scene.render.image_settings.file_format = "JPEG"
        scene.render.image_settings.quality = 85
    else:
        scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
    print(f"Kontaktbogen → {target}")


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--vorschau":
        contact_sheet(Path(args[1]).resolve())
        return
    usdz = bool(args) and args[0] == "--usdz"
    if usdz:
        args = args[1:]
    if len(args) != 2 or (args[0] != "all" and args[0] not in requisiten.PROPS):
        print(
            f"Aufruf: props.py [--usdz] <all|{'|'.join(requisiten.PROPS)}> <zielordner>"
            "  oder  props.py --vorschau <bild.jpg|bild.png>"
        )
        raise SystemExit(1)
    out = Path(args[1]).resolve()
    out.mkdir(parents=True, exist_ok=True)
    ids = list(requisiten.PROPS) if args[0] == "all" else [args[0]]
    alphas: dict[str, dict[str, float]] = {}
    for prop_id in ids:
        if usdz:
            target = out / f"{prop_id}.usdz"
            transparent = export_usdz(prop_id, target)
            if transparent:
                alphas[str(target)] = transparent
        else:
            export(prop_id, out / f"{prop_id}.glb")
    set_opacity(alphas)


if __name__ == "__main__":
    main()
