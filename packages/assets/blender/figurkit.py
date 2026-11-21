"""
Figuren-Baukasten für Blender als Python-Modul (bpy 5.3, CHAOS-58).

Figuren entstehen als reproduzierbare Skripte statt aus starren Grundkörpern:
- Körper, Glieder und Schwanz aus Skin-Modifier + Subdivision (weiche, organische Formen),
- Kopf aus einer verformten Kugel (Schnauze, Wangen), Augen als glänzende Kugeln,
- Farben als Vertexfarben, Fell über Sheen im PBR-Material, Feinstruktur (Strick, Fell, Lack,
  Kaktushaut) als kleine kachelbare Normal-Textur (`struktur.py`, CHAOS-172),
- Skelett (Armature) mit den Vertrags-Gelenken `huepfer` und `abzeichen`,
- Animationen mit den Namen aus `CHARACTER_ANIMATIONS`, Export als GLB.

Koordinaten in Blender: Z oben, Figur blickt nach -Y (der glTF-Export macht daraus +Z vorn,
Y oben). Füße bei z = 0.

Blender ist hier nur Werkzeug: Nichts davon wird mit dem Spiel ausgeliefert, die erzeugten
Modelle sind Eigenwerk.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Iterable, Sequence

import bpy  # zuerst: stellt bmesh und mathutils bereit
import bmesh  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import struktur  # noqa: E402

Vec = tuple[float, float, float]
Color = tuple[float, float, float]


def hex_color(value: str) -> Color:
    """sRGB-Hex → linear (Blender rechnet Vertexfarben linear)."""
    value = value.lstrip("#")
    srgb = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]

    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(srgb[0]), lin(srgb[1]), lin(srgb[2]))


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ---------------------------------------------------------------------------------------------
# Materialien
# ---------------------------------------------------------------------------------------------


def material(
    name: str,
    *,
    color: Color | None = None,
    vertex_colors: bool = False,
    roughness: float = 0.6,
    sheen: float = 0.0,
    coat: float = 0.0,
    emission: float = 0.0,
    subsurface: float = 0.0,
    structure: str | None = None,
) -> bpy.types.Material:
    """PBR-Material. `structure`: Muster aus `struktur.MUSTER` (Normal-Textur, CHAOS-172)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes.get("Principled BSDF")
    assert bsdf is not None
    bsdf.inputs["Roughness"].default_value = roughness
    if color is not None:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if vertex_colors:
        attr = tree.nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Farbe"
        tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    if sheen > 0:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Roughness"].default_value = 0.4
    if coat > 0:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emission > 0 and color is not None:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    if subsurface > 0:
        bsdf.inputs["Subsurface Weight"].default_value = subsurface
    if structure is not None:
        struktur.mark(mat, structure)
    return mat


# ---------------------------------------------------------------------------------------------
# Geometrie
# ---------------------------------------------------------------------------------------------


def _link(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _apply_modifiers(obj: bpy.types.Object) -> None:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated)
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    bpy.data.meshes.remove(old)


@dataclass
class SkinNode:
    """Knoten eines Skin-Skeletts: Position und Radius (x, y)."""

    at: Vec
    radius: float | tuple[float, float]
    parent: int | None = None


def skin_mesh(
    name: str,
    nodes: Sequence[SkinNode],
    *,
    subdivisions: int = 2,
    root: int = 0,
) -> bpy.types.Object:
    """Weicher Körper aus einem Skin-Skelett (Skin-Modifier + Subdivision, angewendet)."""
    mesh = bpy.data.meshes.new(name)
    verts = [Vector(n.at) for n in nodes]
    edges = [(n.parent, i) for i, n in enumerate(nodes) if n.parent is not None]
    mesh.from_pydata(verts, edges, [])
    obj = _link(bpy.data.objects.new(name, mesh))
    skin = obj.modifiers.new("skin", "SKIN")
    skin.use_smooth_shade = True
    skin.branch_smoothing = 0.6
    for i, node in enumerate(nodes):
        r = node.radius if isinstance(node.radius, tuple) else (node.radius, node.radius)
        obj.data.skin_vertices[0].data[i].radius = r
    obj.data.skin_vertices[0].data[root].use_root = True
    sub = obj.modifiers.new("weich", "SUBSURF")
    sub.levels = subdivisions
    sub.render_levels = subdivisions
    _apply_modifiers(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def sphere(
    name: str,
    at: Vec,
    radius: float,
    *,
    scale: Vec = (1, 1, 1),
    segments: int = 32,
    rings: int = 16,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    bm.to_mesh(mesh)
    bm.free()
    obj = _link(bpy.data.objects.new(name, mesh))
    obj.location = at
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def torus(
    name: str, at: Vec, major: float, minor: float, *, segments: int = 48, sides: int = 16
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    verts: list[Vector] = []
    faces: list[tuple[int, int, int, int]] = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        for j in range(sides):
            b = 2 * math.pi * j / sides
            r = major + minor * math.cos(b)
            verts.append(Vector((r * math.cos(a), r * math.sin(a), minor * math.sin(b))))
    for i in range(segments):
        for j in range(sides):
            a = i * sides + j
            b = ((i + 1) % segments) * sides + j
            c = ((i + 1) % segments) * sides + (j + 1) % sides
            d = i * sides + (j + 1) % sides
            faces.append((a, b, c, d))
    mesh.from_pydata(verts, [], faces)
    obj = _link(bpy.data.objects.new(name, mesh))
    obj.location = at
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def deform(obj: bpy.types.Object, fn: Callable[[Vector], Vector]) -> None:
    """Verformt alle Eckpunkte (lokale Koordinaten)."""
    for v in obj.data.vertices:
        v.co = fn(v.co.copy())
    obj.data.update()


def bump(center: Vector, direction: Vector, amount: float, width: float) -> Callable[[Vector], Vector]:
    """Weiche Ausbeulung: verschiebt Punkte nahe `center` entlang `direction`."""
    direction = direction.normalized()

    def fn(p: Vector) -> Vector:
        d = (p - center).length
        w = math.exp(-((d / width) ** 2))
        return p + direction * amount * w

    return fn


def paint(obj: bpy.types.Object, color_of: Callable[[Vector, Vector], Color]) -> None:
    """Vertexfarben je Ecke aus Position und Normale (Objekt-lokal)."""
    mesh = obj.data
    layer = mesh.color_attributes.new("Farbe", "BYTE_COLOR", "CORNER")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vi = mesh.loops[loop_index].vertex_index
            v = mesh.vertices[vi]
            c = color_of(v.co, v.normal)
            layer.data[loop_index].color = (*c, 1.0)


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def join(objects: Iterable[bpy.types.Object], name: str) -> bpy.types.Object:
    objects = list(objects)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    return joined


# ---------------------------------------------------------------------------------------------
# Skelett und Animation
# ---------------------------------------------------------------------------------------------


@dataclass
class Bone:
    name: str
    head: Vec
    tail: Vec
    parent: str | None = None
    deform: bool = True


def armature(name: str, bones: Sequence[Bone]) -> bpy.types.Object:
    data = bpy.data.armatures.new(name)
    obj = _link(bpy.data.objects.new(name, data))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    created: dict[str, bpy.types.EditBone] = {}
    for b in bones:
        eb = data.edit_bones.new(b.name)
        eb.head = b.head
        eb.tail = b.tail
        eb.use_deform = b.deform
        if b.parent:
            eb.parent = created[b.parent]
        created[b.name] = eb
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def skin_to(mesh: bpy.types.Object, rig: bpy.types.Object) -> None:
    """Automatische Gewichte (Wärmeverteilung) vom Skelett auf das Mesh."""
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def attach(obj: bpy.types.Object, rig: bpy.types.Object, bone: str) -> None:
    """Starres Teil an einen Knochen hängen (Augen, Nase, Halstuch)."""
    bpy.context.view_layer.update()  # sonst ist matrix_world nach `location =` noch veraltet
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world


Pose = dict[str, dict[str, Vec]]
"""Knochen → {"rot": Euler in Grad, "loc": Versatz, "scale": Faktor}."""


@dataclass
class Clip:
    name: str
    seconds: float
    keys: list[tuple[float, Pose]] = field(default_factory=list)
    loop: bool = False


FPS = 30


@dataclass
class _Baked:
    rig: bpy.types.Object
    clips: list[Clip]
    bones: list[str]


_baked: _Baked | None = None
"""Zuletzt gebackene Clips (für `export_usdz`, das sie auf eine Zeitleiste legt)."""


def _key_clip(rig: bpy.types.Object, clip: Clip, bones: Sequence[str], first_frame: int) -> None:
    for t, pose in clip.keys:
        frame = first_frame + round(t * FPS)
        for bone_name in bones:
            pb = rig.pose.bones[bone_name]
            spec = pose.get(bone_name, {})
            rot = spec.get("rot", (0.0, 0.0, 0.0))
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = Euler([math.radians(a) for a in rot], "XYZ")
            pb.location = spec.get("loc", (0.0, 0.0, 0.0))
            pb.scale = spec.get("scale", (1.0, 1.0, 1.0))
            pb.keyframe_insert("rotation_euler", frame=frame, group=bone_name)
            pb.keyframe_insert("location", frame=frame, group=bone_name)
            pb.keyframe_insert("scale", frame=frame, group=bone_name)


def _rest_pose(rig: bpy.types.Object) -> None:
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def bake_clips(rig: bpy.types.Object, clips: Sequence[Clip], bones: Sequence[str]) -> None:
    """Je Clip eine Action; alle beteiligten Knochen bekommen Schlüssel (Ruhepose ergänzt)."""
    global _baked
    scene = bpy.context.scene
    scene.render.fps = FPS
    rig.animation_data_create()
    for clip in clips:
        action = bpy.data.actions.new(clip.name)
        action.use_fake_user = True
        rig.animation_data.action = action
        _key_clip(rig, clip, bones, 1)
        track = rig.animation_data.nla_tracks.new()
        track.name = clip.name
        track.strips.new(clip.name, 1, action)
        rig.animation_data.action = None
    _rest_pose(rig)
    _baked = _Baked(rig, list(clips), list(bones))


def export_glb(path: str) -> None:
    struktur.apply()
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips_merged_animation_name="",
        export_skins=True,
        export_morph=False,
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_materials="EXPORT",
        # Nur die Normal-Textur der Feinstruktur (CHAOS-172); Farben bleiben Vertexfarben.
        export_image_format="WEBP",
        export_image_quality=90,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_force_sampling=True,
        export_optimize_animation_size=True,
    )


# ---------------------------------------------------------------------------------------------
# USDZ für den nativen Apple-Host (CHAOS-140, ADR-019 §5)
# ---------------------------------------------------------------------------------------------

ATLAS_SIZE = 1024
"""Kantenlänge der Farbtextur, in die die Vertexfarben gebacken werden (eine je Figur)."""

ATLAS_UV = "farbatlas"
"""UV-Map des Farbatlas (im USD als `st` exportiert, die Struktur-Map bleibt `struktur`)."""

CLIP_GAP_FRAMES = 6
"""Leere Bilder zwischen zwei Clips auf der Zeitleiste, damit beim Zuschneiden nichts überblendet."""


def timeline(clips: Sequence[Clip]) -> list[dict[str, object]]:
    """Lage der Clips auf der gemeinsamen USD-Zeitleiste (Bild 1 = 0 s).

    USD und RealityKit kennen je Datei nur eine Animation. Alle Clips liegen deshalb
    nacheinander auf einer Zeitleiste; der Host schneidet sie mit `start`/`end` (Sekunden ab
    Beginn) wieder heraus (`AnimationView(source:trimStart:trimEnd:)`).
    """
    out: list[dict[str, object]] = []
    frame = 1
    for clip in clips:
        frames = round(clip.seconds * FPS)
        out.append(
            {
                "name": clip.name,
                "startFrame": frame,
                "endFrame": frame + frames,
                "start": round((frame - 1) / FPS, 6),
                "end": round((frame - 1 + frames) / FPS, 6),
                "loop": clip.loop,
            }
        )
        frame += frames + CLIP_GAP_FRAMES
    return out


def _uses_vertex_colors(mat: bpy.types.Material | None) -> bool:
    return bool(
        mat
        and mat.node_tree
        and any(n.bl_idname == "ShaderNodeVertexColor" for n in mat.node_tree.nodes)
    )


def bake_vertex_colors(
    image_name: str,
    size: int = ATLAS_SIZE,
    *,
    pack_shape: str = "CONCAVE",
    island_margin: float = 0.008,
    bake_margin: int = 16,
) -> bpy.types.Image | None:
    """Vertexfarben aller Figurenteile in eine gemeinsame Farbtextur backen und die Materialien
    darauf umstellen (Base Color ← Textur statt ← Vertexfarbe).

    `pack_shape`: Form beim Neupacken der UV-Inseln. `CONCAVE` nutzt die Fläche am besten, braucht
    bei vielen kleinen Inseln aber bis zu einer Minute (Toaster: 60 s); die Requisiten nehmen
    `AABB` (Millisekunden, ebenfalls ohne Überlappung, CHAOS-221).

    `island_margin` (Anteil der Kantenlänge) und `bake_margin` (Pixel) gehören zusammen: Blender
    backt Teil für Teil und füllt den Rand eines Teils auch über Inseln anderer Teile. Der Rand
    muss deshalb kleiner als der Abstand der Inseln sein; bei kleinen Texturen (Requisiten, 256²)
    färbte der Standardrand von 16 px sonst Metall rot (Milchkanne, CHAOS-221).

    Warum: RealityKit ignoriert Vertexfarben im Material (`UsdPrimvarReader`) und zeigt sie nur
    ohne Material (EXP-017). Mit Textur bleiben Rauheit, Clearcoat, Metall und Leuchten als
    `UsdPreviewSurface` erhalten. Sheen und Subsurface kennt UsdPreviewSurface nicht.
    """
    scene = bpy.context.scene
    objects = [
        o
        for o in scene.objects
        if o.type == "MESH" and any(_uses_vertex_colors(m) for m in o.data.materials)
    ]
    if not objects:
        return None

    # Gemeinsame UV-Abwicklung: Smart UV Project im Mehrobjekt-Editmodus packt alle Inseln
    # zusammen in 0…1. Die Anordnung schwankt zwischen Läufen leicht (Packen über mehrere
    # Objekte); das Ergebnis ist gleichwertig, aber nicht bitgleich (docs/apple-assets.md).
    objects.sort(key=lambda o: o.name)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        # Eigene UV-Map für den Atlas; die Feinstruktur behält ihre Map `struktur` (CHAOS-172).
        # Aktiv (Projektion und Backen) und für das Rendern aktiv (USD: wird zur Primvar `st`).
        layer = obj.data.uv_layers.get(ATLAS_UV) or obj.data.uv_layers.new(name=ATLAS_UV)
        obj.data.uv_layers.active = layer
        layer.active_render = True
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
    # CHAOS-162: Smart UV Project packte bei den feiner unterteilten Figuren Inseln übereinander
    # (blaue Knopf-Flecken auf der Sockenspitze). Neu packen, mit Rand, ohne Überlappung.
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin_method="FRACTION", margin=island_margin, shape_method=pack_shape)
    bpy.ops.object.mode_set(mode="OBJECT")

    image = bpy.data.images.new(image_name, size, size, alpha=False)
    image.colorspace_settings.name = "sRGB"
    materials = sorted({m for o in objects for m in o.data.materials if m}, key=lambda m: m.name)
    for mat in materials:
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.name = "farbatlas"
        node.image = image
        node.interpolation = "Linear"
        mat.node_tree.nodes.active = node
        uv = mat.node_tree.nodes.new("ShaderNodeUVMap")
        uv.name = "farbatlas_uv"
        uv.uv_map = ATLAS_UV
        mat.node_tree.links.new(uv.outputs["UV"], node.inputs["Vector"])

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 1
    bake = scene.render.bake
    bake.margin = bake_margin
    bake.margin_type = "EXTEND"
    # Der Diffus-Farbpass ist Grundfarbe × (1 − Metallic) × (1 − Transmission) × Alpha: Messing
    # (Schraubi) und Metall- oder Glas-Requisiten kämen fast schwarz bzw. abgedunkelt in den Atlas
    # (CHAOS-221). Fürs Backen diese Eingänge neutral stellen, danach zurück.
    neutral = {"Metallic": 0.0, "Transmission Weight": 0.0, "Alpha": 1.0}
    saved: list[tuple[bpy.types.NodeSocket, float]] = []
    for mat in materials:
        for node in mat.node_tree.nodes:
            if node.bl_idname != "ShaderNodeBsdfPrincipled":
                continue
            for name, value in neutral.items():
                socket = node.inputs[name]
                if not socket.is_linked and socket.default_value != value:
                    saved.append((socket, socket.default_value))
                    socket.default_value = value
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, use_clear=True, margin=bake_margin)
    for socket, value in saved:
        socket.default_value = value

    for mat in materials:
        tree = mat.node_tree
        atlas = tree.nodes["farbatlas"]
        vertex_nodes = [n for n in tree.nodes if n.bl_idname == "ShaderNodeVertexColor"]
        if not vertex_nodes:
            tree.nodes.remove(atlas)  # Material ohne Vertexfarbe: Konstante bleibt
            tree.nodes.remove(tree.nodes["farbatlas_uv"])
            continue
        for vc in vertex_nodes:
            for link in list(vc.outputs["Color"].links):
                tree.links.new(atlas.outputs["Color"], link.to_socket)
            tree.nodes.remove(vc)
    return image


def add_badge_anchor(rig: bpy.types.Object, name: str = "abzeichen") -> bpy.types.Object:
    """Leeres Objekt am Knochen `abzeichen`: In USD sind Knochen keine Prims, der Host findet das
    Abzeichen so per `findEntity(named: "abzeichen")`."""
    bone = rig.data.bones[name]
    empty = _link(bpy.data.objects.new(name, None))
    empty.location = rig.matrix_world @ bone.head_local
    attach(empty, rig, name)
    return empty


def export_usdz(path: str, texture_dir: str) -> list[dict[str, object]]:
    """Figur als USDZ: Farbatlas statt Vertexfarben, alle Clips auf einer Zeitleiste.

    Gibt die Clip-Tabelle zurück (siehe `timeline`). `texture_dir`: Ablage für die gebackene
    PNG, bevor der Export sie ins USDZ packt.
    """
    assert _baked is not None, "erst bake_clips aufrufen"
    rig = _baked.rig
    add_badge_anchor(rig)
    struktur.apply()  # vor dem Atlas: die Struktur-Map entsteht in der Ruhepose

    image = bake_vertex_colors(f"{rig.name}_farbe")
    if image is not None:
        image.filepath_raw = f"{texture_dir}/{rig.name}_farbe.png"
        image.file_format = "PNG"
        image.save()

    # NLA-Spuren spielen alle ab Bild 1 gleichzeitig; für USD eine einzige Action mit allen
    # Clips nacheinander.
    for track in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(track)
    action = bpy.data.actions.new("zeitleiste")
    rig.animation_data.action = action
    table = timeline(_baked.clips)
    for clip, entry in zip(_baked.clips, table):
        _key_clip(rig, clip, _baked.bones, int(entry["startFrame"]))  # type: ignore[call-overload]
    _rest_pose(rig)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = int(table[-1]["endFrame"])  # type: ignore[call-overload]
    scene.render.fps = FPS

    skinned = any(m.type == "ARMATURE" for ob in scene.objects for m in ob.modifiers)
    bpy.ops.wm.usd_export(
        filepath=path,
        export_animation=True,
        # Robot: Teile hängen starr an Knochen, kein Mesh ist geskinnt. Ein Skeleton ohne SkelRoot
        # wäre ungültiges USD; die Knochenbewegung steckt dann in den Xform-Zeitreihen.
        export_armatures=skinned,
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
    return table


# ---------------------------------------------------------------------------------------------
# Harte Formen (Roboter, Topf, Knöpfe)
# ---------------------------------------------------------------------------------------------


def rounded_box(
    name: str, at: Vec, size: Vec, radius: float, *, segments: int = 4
) -> bpy.types.Object:
    """Kasten mit gerundeten Kanten (Bevel, angewendet) – wie lackiertes Blechspielzeug."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(mesh)
    bm.free()
    obj = _link(bpy.data.objects.new(name, mesh))
    obj.location = at
    bevel = obj.modifiers.new("kante", "BEVEL")
    bevel.width = radius
    bevel.segments = segments
    bevel.limit_method = "NONE"
    bevel.harden_normals = False
    _apply_modifiers(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def cylinder(
    name: str,
    at: Vec,
    radius: float,
    depth: float,
    *,
    radius_top: float | None = None,
    segments: int = 24,
    axis: str = "Z",
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius if radius_top is None else radius_top,
        depth=depth,
    )
    if axis != "Z":
        for v in bm.verts:
            x, y, z = v.co
            v.co = Vector((z, y, -x)) if axis == "X" else Vector((x, z, -y))
    bm.to_mesh(mesh)
    bm.free()
    obj = _link(bpy.data.objects.new(name, mesh))
    obj.location = at
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def lathe(name: str, profile: Sequence[tuple[float, float]], *, segments: int = 40) -> bpy.types.Object:
    """Drehkörper um Z aus (Radius, Höhe)-Punkten (Topf, Pokal, Knopf)."""
    verts: list[Vector] = []
    faces: list[tuple[int, ...]] = []
    rings = len(profile)
    for i in range(segments):
        a = 2 * math.pi * i / segments
        for r, z in profile:
            verts.append(Vector((r * math.cos(a), r * math.sin(a), z)))
    for i in range(segments):
        n = (i + 1) % segments
        for j in range(rings - 1):
            faces.append((i * rings + j, n * rings + j, n * rings + j + 1, i * rings + j + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = _link(bpy.data.objects.new(name, mesh))
    bpy.context.view_layer.objects.active = obj
    for poly in obj.data.polygons:
        poly.use_smooth = True
    # Normalen nach außen (Reihenfolge der Profilpunkte egal).
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def solid(obj: bpy.types.Object, color: Color) -> bpy.types.Object:
    """Einfarbig per Vertexfarbe (für Teile, die sich ein Material teilen)."""
    paint(obj, lambda p, n: color)
    return obj


# ---------------------------------------------------------------------------------------------
# Röhren und Ringflächen (CHAOS-162: Nahansicht)
# ---------------------------------------------------------------------------------------------


def rings_mesh(name: str, rings: Sequence[Sequence[Vector]], *, cap_start: bool = True, cap_end: bool = True) -> bpy.types.Object:
    """Fläche aus geschlossenen Ringen gleicher Punktzahl; Enden mit Mittelpunkt-Fächer zu.

    Grundlage für Formen, die Skin-Modifier plus Subdivision nicht sauber hergeben: Rippen
    brauchen genug Punkte rundum, Strick-Ringel genug Ringe entlang (docs/apple-assets.md,
    „Bekannte Grenzen“).
    """
    n = len(rings[0])
    verts: list[Vector] = [p for ring in rings for p in ring]
    faces: list[tuple[int, ...]] = []
    for r in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            faces.append((r * n + i, r * n + j, (r + 1) * n + j, (r + 1) * n + i))
    if cap_start:
        c = len(verts)
        verts.append(sum(rings[0], Vector()) / n)
        faces += [(c, (i + 1) % n, i) for i in range(n)]
    if cap_end:
        c = len(verts)
        last = (len(rings) - 1) * n
        verts.append(sum(rings[-1], Vector()) / n)
        faces += [(c, last + i, last + (i + 1) % n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = _link(bpy.data.objects.new(name, mesh))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def _catmull(points: Sequence[Vector], t: float) -> Vector:
    """Punkt auf einer Catmull-Rom-Kurve durch `points`, t in 0…1."""
    segs = len(points) - 1
    x = min(segs - 1e-9, max(0.0, t * segs))
    i = int(x)
    u = x - i
    p0 = points[max(0, i - 1)]
    p1, p2 = points[i], points[i + 1]
    p3 = points[min(segs, i + 2)]
    return 0.5 * (
        2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u
    )


@dataclass
class Frame:
    """Ort und Achsen eines Röhren-Querschnitts: `t` (0…1 nach Bogenlänge), Tangente, u, v."""

    t: float
    at: Vector
    tangent: Vector
    u: Vector
    v: Vector


def path_frames(points: Sequence[Vec], count: int, ref: Vec = (1, 0, 0)) -> list[Frame]:
    """`count` Querschnitte gleichmäßig nach Bogenlänge entlang einer glatten Kurve durch
    `points`, Achsen per Parallelverschiebung (kein Verdrehen). `u` startet bei `ref`."""
    pts = [Vector(p) for p in points]
    dense = [_catmull(pts, i / 400) for i in range(401)]
    lengths = [0.0]
    for a, b in zip(dense, dense[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    samples: list[Vector] = []
    j = 0
    for i in range(count):
        target = total * i / (count - 1)
        while j < len(lengths) - 2 and lengths[j + 1] < target:
            j += 1
        span = lengths[j + 1] - lengths[j]
        f = 0.0 if span < 1e-12 else (target - lengths[j]) / span
        samples.append(dense[j].lerp(dense[j + 1], f))
    frames: list[Frame] = []
    u = Vector(ref)
    for i, at in enumerate(samples):
        a, b = samples[max(0, i - 1)], samples[min(count - 1, i + 1)]
        tangent = (b - a).normalized()
        u = (u - tangent * u.dot(tangent)).normalized()
        frames.append(Frame(i / (count - 1), at, tangent, u, tangent.cross(u)))
    return frames


def tube(
    name: str,
    frames: Sequence[Frame],
    radius: Callable[[Frame, float], tuple[float, float]],
    *,
    around: int,
    dome_start: float = 0.0,
    dome_end: float = 0.0,
    dome_rings: int = 6,
) -> bpy.types.Object:
    """Röhre entlang `frames`. `radius(frame, winkel)` → (ru, rv): Halbachsen des Querschnitts
    beim Winkel (Rippen, Abflachung). `dome_*`: Kuppel am Ende (Höhe als Anteil des Radius,
    0 = flacher Deckel)."""

    def ring(fr: Frame, scale: float = 1.0, push: float = 0.0) -> list[Vector]:
        out = []
        for i in range(around):
            a = 2 * math.pi * i / around
            ru, rv = radius(fr, a)
            out.append(fr.at + fr.tangent * push + (fr.u * math.cos(a) * ru + fr.v * math.sin(a) * rv) * scale)
        return out

    def dome(fr: Frame, sign: float, height: float) -> list[list[Vector]]:
        r0 = sum(radius(fr, 2 * math.pi * i / 8)[0] for i in range(8)) / 8
        out = []
        for k in range(1, dome_rings):
            phi = math.pi / 2 * k / dome_rings
            out.append(ring(fr, math.cos(phi), sign * math.sin(phi) * height * r0))
        return out

    rings = [ring(fr) for fr in frames]
    if dome_start > 0:
        rings = list(reversed(dome(frames[0], -1, dome_start))) + rings
    if dome_end > 0:
        rings = rings + dome(frames[-1], 1, dome_end)
    obj = rings_mesh(name, rings)
    if dome_start > 0 or dome_end > 0:
        # Kuppelspitze: Mittelpunkt etwas vorziehen, sonst bleibt eine flache Delle.
        mesh = obj.data
        n_verts = len(mesh.vertices)
        if dome_start > 0:
            fr = frames[0]
            r0 = sum(radius(fr, 2 * math.pi * i / 8)[0] for i in range(8)) / 8
            mesh.vertices[n_verts - 2].co = fr.at - fr.tangent * dome_start * r0
        if dome_end > 0:
            fr = frames[-1]
            r0 = sum(radius(fr, 2 * math.pi * i / 8)[0] for i in range(8)) / 8
            mesh.vertices[n_verts - 1].co = fr.at + fr.tangent * dome_end * r0
        mesh.update()
    return obj


def weight(obj: bpy.types.Object, weights_of: Callable[[Vector], dict[str, float]]) -> None:
    """Skinning-Gewichte von Hand (statt Wärmeverteilung): je Punkt Knochen → Gewicht.
    Vor `join` aufrufen; `join` führt gleichnamige Gruppen zusammen. Danach `skin_named`."""
    for v in obj.data.vertices:
        ws = weights_of(v.co)
        total = sum(ws.values()) or 1.0
        for bone, w in ws.items():
            if w <= 0:
                continue
            group = obj.vertex_groups.get(bone) or obj.vertex_groups.new(name=bone)
            group.add([v.index], w / total, "REPLACE")


def skin_named(mesh: bpy.types.Object, rig: bpy.types.Object) -> None:
    """An das Skelett hängen und die vorhandenen Gruppen (aus `weight`) als Gewichte nutzen."""
    bpy.context.view_layer.update()
    world = mesh.matrix_world.copy()
    mesh.parent = rig
    mesh.matrix_world = world
    mod = mesh.modifiers.new("skelett", "ARMATURE")
    mod.object = rig
