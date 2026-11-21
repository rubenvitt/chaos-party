"""
Requisiten-Baukasten für Minispiele (CHAOS-88, ADR-013): parametrische Grundformen auf Basis
von `figurkit`, statische GLBs ohne Skelett.

Ein Requisit entsteht aus Teilen, die je **Material** gesammelt und am Ende zu einem Mesh je
Material zusammengefügt werden (wenig Draw-Calls). Farben sind Vertexfarben wie bei den
Figuren; Texturen gibt es nicht (Budget `prop.maxImages` = 0).

Materialien (Name im GLB = Schlüssel):
- `lack`   glänzender Spielzeuglack (Klarlack), Standard,
- `matt`   Holz, Brot, Stoff, Erde,
- `glas`   durchscheinend (Alpha), für Limo, Eis, Honigglas,
- `metall` Blech, Draht, Klinke,
- `akzent` Laufzeit-Farbe: der Host färbt es in die **Slot-Farbe** (immer mit Slot-Symbol),
- `zustand` Laufzeit-Farbe: das Minispiel färbt es nach Spielzustand (Bräunung, Türfarbe).
Die zwei Laufzeit-Materialien sind im GLB weiß und ohne Vertexfarben.

Grundformen (Familien des Art-Kits): Obst & Nüsse (`obst`, `nuss`), Gefäße (`gefaess`,
`henkel`, `tuelle`), Möbel & Kästen (`kasten`, `brett`, `prisma`), Spielzeug (`kugel`, `wolke`,
`fluegel`), Gartengeräte (`stab`, `ring`, `netz`), Pflanzen (`blatt`). Helfer: `move`, `rotate`,
`streck` (gebacken), `flaechen` (Vertexfarbe je Fläche für harte Farbgrenzen).

Maßstab wie bei den Figuren: Meter, Boden bei z = 0, Mitte über dem Ursprung, vorn = -Y
(nach dem glTF-Export +Z vorn, Y oben). Eine Figur ist 1,4–1,8 m hoch; Requisiten sind
„Spielzeug-groß“ übertrieben, damit sie aus 3 m Sofa-Abstand lesbar bleiben.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Sequence

import figurkit as k  # importiert bpy zuerst
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

Vec = k.Vec
Color = k.Color

RUNTIME_MATERIALS = ("akzent", "zustand")
"""Materialien, die zur Laufzeit gefärbt werden (weiß im GLB)."""


# ---------------------------------------------------------------------------------------------
# Palette: Natur-Look, Spielzeug-Lack. Meidet die vier Slot-Farbtöne als Flächenfarbe.
# ---------------------------------------------------------------------------------------------

P = {
    "tinte": k.hex_color("#1b1530"),
    "creme": k.hex_color("#f6efe2"),
    "holz": k.hex_color("#b8834f"),
    "holz_dunkel": k.hex_color("#7a5233"),
    "holz_hell": k.hex_color("#e0b98a"),
    "rinde": k.hex_color("#6b4a32"),
    "laub": k.hex_color("#6a9a3e"),
    "laub_dunkel": k.hex_color("#41692a"),
    "nuss": k.hex_color("#a8683a"),
    "nuss_kappe": k.hex_color("#6e4a2c"),
    "faul": k.hex_color("#7d7a3a"),
    "faul_fleck": k.hex_color("#4d5a2a"),
    "blech": k.hex_color("#c9d2da"),
    "blech_dunkel": k.hex_color("#5a6070"),
    "chrom": k.hex_color("#e8ecf0"),
    "rot": k.hex_color("#d9483b"),
    "gelb": k.hex_color("#f2c53d"),
    "zitrone": k.hex_color("#f4dc4a"),
    "zitrone_hell": k.hex_color("#fbf3b8"),
    "limo": k.hex_color("#f6e27a"),
    "eis": k.hex_color("#dff3fb"),
    "kaese": k.hex_color("#f5c542"),
    "kaese_loch": k.hex_color("#d9a22b"),
    "brot": k.hex_color("#f2d7a6"),
    "kruste": k.hex_color("#c98b4a"),
    "honig": k.hex_color("#f0a422"),
    "honig_dunkel": k.hex_color("#b8701a"),
    "biene_gelb": k.hex_color("#f6c43a"),
    "fluegel": k.hex_color("#eef6fb"),
    "matsch": k.hex_color("#7a5636"),
    "wolke": k.hex_color("#eef1f6"),
    "wolke_dunkel": k.hex_color("#9aa3b5"),
    "ton": k.hex_color("#d9774a"),
    "stroh": k.hex_color("#e8c56f"),
    "schlauch": k.hex_color("#4e9a5a"),
    # Kulissen nach Ort (CHAOS-222), abgestimmt auf die Farbwelten `PLACES` der Arena-Vorlagen.
    "wasser": k.hex_color("#8fd3f0"),
    "fliese": k.hex_color("#eef8fb"),
    "seife": k.hex_color("#a8e0c8"),
    "ente": k.hex_color("#ffd43b"),
    "schnabel": k.hex_color("#f2793a"),
    "seerose": k.hex_color("#fbf4f7"),
    "seerose_spitze": k.hex_color("#f7b8d0"),
    "schilf": k.hex_color("#8aa34a"),
    "kolben": k.hex_color("#6a4128"),
    "hellblau": k.hex_color("#7cc6ef"),
    "lila": k.hex_color("#b48ae0"),
    "pilz_rot": k.hex_color("#e0233d"),
    "moos": k.hex_color("#7fa83e"),
    "leder": k.hex_color("#8a4b2f"),
    "leder_hell": k.hex_color("#c58a5a"),
    "messing": k.hex_color("#c9a44a"),
    "flamme": k.hex_color("#ffe14d"),
    "weiss": (1.0, 1.0, 1.0),
}


def mix(a: Color, b: Color, t: float) -> Color:
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))  # type: ignore[return-value]


# ---------------------------------------------------------------------------------------------
# Materialien
# ---------------------------------------------------------------------------------------------


def _material(key: str) -> bpy.types.Material:
    existing = bpy.data.materials.get(key)
    if existing is not None:
        return existing
    if key == "lack":
        return k.material(key, vertex_colors=True, roughness=0.35, coat=0.35)
    if key == "matt":
        return k.material(key, vertex_colors=True, roughness=0.8)
    if key == "metall":
        mat = k.material(key, vertex_colors=True, roughness=0.3)
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Metallic"].default_value = 0.85
        return mat
    if key == "glas":
        mat = k.material(key, vertex_colors=True, roughness=0.08, coat=0.5)
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Alpha"].default_value = 0.55
        mat.surface_render_method = "BLENDED"
        return mat
    if key in RUNTIME_MATERIALS:
        return k.material(key, color=P["weiss"], roughness=0.45, coat=0.25)
    raise ValueError(f"unbekanntes Material „{key}“")


# ---------------------------------------------------------------------------------------------
# Requisit: Teile sammeln, je Material zusammenfügen, auf den Boden stellen
# ---------------------------------------------------------------------------------------------


@dataclass
class Prop:
    name: str
    parts: dict[str, list[bpy.types.Object]] = field(default_factory=dict)

    def add(self, obj: bpy.types.Object, color: Color | None = None, mat: str = "lack") -> bpy.types.Object:
        """Teil aufnehmen. `color`: einfarbig (sonst muss das Teil schon bemalt sein)."""
        if mat in RUNTIME_MATERIALS:
            color = P["weiss"]
        if color is not None:
            k.solid(obj, color)
        elif "Farbe" not in obj.data.color_attributes:
            raise ValueError(f"{self.name}: Teil {obj.name} ohne Farbe")
        self.parts.setdefault(mat, []).append(obj)
        return obj

    def finish(self, *, ground: bool = True, center: bool = True) -> list[bpy.types.Object]:
        """Ein Mesh je Material; Boden auf z = 0, Mitte der Grundfläche über dem Ursprung."""
        meshes: list[bpy.types.Object] = []
        for key, objs in self.parts.items():
            obj = objs[0] if len(objs) == 1 else k.join(objs, f"{self.name}-{key}")
            obj.name = f"{self.name}-{key}"
            obj.data.name = obj.name
            _bake_transform(obj)
            k.assign(obj, _material(key))
            meshes.append(obj)
        pts = [v.co for o in meshes for v in o.data.vertices]
        shift = Vector((0, 0, 0))
        if center:
            shift.x = -(min(p.x for p in pts) + max(p.x for p in pts)) / 2
            shift.y = -(min(p.y for p in pts) + max(p.y for p in pts)) / 2
        if ground:
            shift.z = -min(p.z for p in pts)
        for obj in meshes:
            for v in obj.data.vertices:
                v.co += shift
            obj.data.update()
        # Ein Wurzelknoten mit dem Namen des Requisits (Ankerpunkt im GLB).
        root = bpy.data.objects.new(self.name, None)
        bpy.context.scene.collection.objects.link(root)
        for obj in meshes:
            obj.parent = root
        return meshes


def _bake_transform(obj: bpy.types.Object) -> None:
    """Ort, Drehung und Größe in die Eckpunkte übernehmen (Teile liegen dann im Requisit-Raum)."""
    mat = obj.matrix_world.copy()
    obj.data.transform(mat)
    obj.matrix_world.identity()
    obj.data.update()


def rotate(obj: bpy.types.Object, euler_deg: Vec, pivot: Vec = (0, 0, 0)) -> bpy.types.Object:
    """Teil um `pivot` drehen (Grad, XYZ)."""
    from mathutils import Euler, Matrix

    _bake_transform(obj)
    rot = Euler(tuple(math.radians(a) for a in euler_deg), "XYZ").to_matrix().to_4x4()
    t = Matrix.Translation(Vector(pivot))
    obj.data.transform(t @ rot @ t.inverted())
    obj.data.update()
    return obj


def move(obj: bpy.types.Object, offset: Vec) -> bpy.types.Object:
    _bake_transform(obj)
    for v in obj.data.vertices:
        v.co += Vector(offset)
    obj.data.update()
    return obj


def flaechen(obj: bpy.types.Object, color_of: Callable[[Vector], Color]) -> bpy.types.Object:
    """Vertexfarben je Fläche aus ihrer Mitte (harte Farbgrenzen: Ballbahnen, Streifen). Die Ecken
    einer Fläche bekommen alle dieselbe Farbe, Grenzen verlaufen also nicht."""
    mesh = obj.data
    layer = mesh.color_attributes.new("Farbe", "BYTE_COLOR", "CORNER")
    for poly in mesh.polygons:
        c = color_of(poly.center)
        for loop_index in poly.loop_indices:
            layer.data[loop_index].color = (*c, 1.0)
    return obj


def streck(obj: bpy.types.Object, factor: Vec, pivot: Vec = (0, 0, 0)) -> bpy.types.Object:
    """Teil um `pivot` strecken oder stauchen (je Achse; ovale Wanne, halbe Rolle)."""
    _bake_transform(obj)
    for v in obj.data.vertices:
        v.co = Vector(tuple(pivot[i] + (v.co[i] - pivot[i]) * factor[i] for i in range(3)))
    obj.data.update()
    return obj


# ---------------------------------------------------------------------------------------------
# Grundformen: Obst & Nüsse
# ---------------------------------------------------------------------------------------------


def obst(
    prop: Prop,
    at: Vec,
    radius: float,
    color: Color,
    *,
    squash: float = 1.0,
    stem: Color | None = P["rinde"],
    leaf: Color | None = P["laub"],
    spots: Color | None = None,
    segments: int = 24,
) -> None:
    """Runde Frucht (Apfel, Beere, Melone, Zitrone): Kugel mit Delle, Stiel, Blatt."""
    body = k.sphere(f"{prop.name}-frucht", (0, 0, 0), radius, scale=(1, 1, squash), segments=segments, rings=segments // 2)
    top = Vector((0, 0, radius * squash))
    k.deform(body, k.bump(top, Vector((0, 0, -1)), radius * 0.18, radius * 0.35))
    if spots is not None:
        def paint(p: Vector, n: Vector) -> Color:
            s = math.sin(p.x * 31) * math.sin(p.y * 27) * math.sin(p.z * 23)
            return spots if s > 0.35 else color

        k.paint(body, paint)
        prop.add(move(body, at))
    else:
        prop.add(move(body, at), color)
    if stem is not None:
        s = k.cylinder(f"{prop.name}-stiel", (0, 0, 0), radius * 0.07, radius * 0.4, radius_top=radius * 0.05, segments=8)
        prop.add(move(rotate(s, (12, 0, 0)), (at[0], at[1], at[2] + radius * squash * 0.95)), stem, "matt")
    if leaf is not None:
        l = k.sphere(f"{prop.name}-blatt", (0, 0, 0), radius * 0.32, scale=(1, 0.45, 0.12), segments=12, rings=6)
        prop.add(move(rotate(l, (0, -25, 30)), (at[0] + radius * 0.25, at[1], at[2] + radius * squash * 1.05)), leaf, "matt")


def nuss(prop: Prop, at: Vec, size: float, body: Color, cap: Color, *, spots: Color | None = None) -> None:
    """Eichel: Ei-Körper mit Spitze, raue Kappe (Napf), kurzer Stiel."""
    prof = []
    for i in range(13):
        t = i / 12
        z = t * size * 1.25
        r = size * 0.5 * math.sin(math.pi * min(1.0, 0.08 + t * 0.95)) ** 0.75
        prof.append((max(r, 0.002), z))
    prof[0] = (0.0, 0.0)
    b = k.lathe(f"{prop.name}-kern", prof, segments=20)
    if spots is not None:
        def paint(p: Vector, n: Vector) -> Color:
            s = math.sin(p.x * 70 + 1) * math.sin(p.y * 64) * math.sin(p.z * 58 + 2)
            return spots if s > 0.25 else body

        k.paint(b, paint)
        prop.add(move(b, at))
    else:
        prop.add(move(b, at), body)
    c_prof = [(0.0, size * 1.32), (size * 0.32, size * 1.3), (size * 0.53, size * 1.18), (size * 0.56, size * 1.02), (size * 0.5, size * 0.92), (size * 0.4, size * 0.98), (0.0, size * 1.05)]
    c = k.lathe(f"{prop.name}-kappe", c_prof, segments=20)

    def rough(p: Vector, n: Vector) -> Color:
        s = math.sin(math.atan2(p.y, p.x) * 10) * math.sin(p.z * 120)
        return mix(cap, P["tinte"], 0.25) if s > 0.3 else cap

    k.paint(c, rough)
    prop.add(move(c, at), mat="matt")
    s = k.cylinder(f"{prop.name}-stiel", (0, 0, 0), size * 0.06, size * 0.3, segments=8)
    prop.add(move(rotate(s, (15, 0, 0)), (at[0], at[1], at[2] + size * 1.43)), cap, "matt")


# ---------------------------------------------------------------------------------------------
# Grundformen: Gefäße
# ---------------------------------------------------------------------------------------------


def gefaess(
    prop: Prop,
    profile: Sequence[tuple[float, float]],
    color: Color,
    *,
    wall: float = 0.03,
    mat: str = "lack",
    at: Vec = (0, 0, 0),
    inner: Color | None = None,
    segments: int = 32,
    rim_color: Color | None = None,
) -> bpy.types.Object:
    """Offenes Gefäß (Topf, Glas, Eimer, Kanne) aus einem Außenprofil (Radius, Höhe) von unten
    nach oben; Innenwand um `wall` versetzt, Boden geschlossen, Rand gerundet."""
    outer = [(0.0, 0.0)] + list(profile)
    top_r, top_z = profile[-1]
    rim = [(top_r - wall * 0.5, top_z + wall * 0.35)]
    inside = [(max(r - wall, 0.001), z) for r, z in reversed(profile[1:])]
    floor_z = profile[0][1] + wall
    inside.append((0.0, floor_z))
    full = outer + rim + inside
    obj = k.lathe(f"{prop.name}-gefaess", full, segments=segments)
    if inner is not None or rim_color is not None:
        def paint(p: Vector, n: Vector) -> Color:
            r = math.hypot(p.x, p.y)
            if rim_color is not None and p.z > top_z - wall * 1.5:
                return rim_color
            # Innenwand: Punkte innerhalb des Außenprofils.
            if inner is not None and _inside(profile, r, p.z, wall):
                return inner
            return color

        k.paint(obj, paint)
        prop.add(move(obj, at), mat=mat)
    else:
        prop.add(move(obj, at), color, mat)
    return obj


def drehkoerper(
    prop: Prop,
    profile: Sequence[tuple[float, float]],
    color: Color,
    *,
    mat: str = "lack",
    at: Vec = (0, 0, 0),
    segments: int = 32,
) -> bpy.types.Object:
    """Geschlossener Drehkörper (Füllung, Fuß, Deckel) aus einem Außenprofil (Radius, Höhe) von
    unten nach oben; Boden und Deckel flach zu."""
    full = [(0.0, profile[0][1])] + list(profile) + [(0.0, profile[-1][1])]
    obj = k.lathe(f"{prop.name}-dreh", full, segments=segments)
    prop.add(move(obj, at), color, mat)
    return obj


def _inside(profile: Sequence[tuple[float, float]], r: float, z: float, wall: float) -> bool:
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1 and z1 > z0:
            rr = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
            return r < rr - wall * 0.5
    return False


def henkel(prop: Prop, points: Sequence[Vec], radius: float, color: Color, mat: str = "lack") -> None:
    """Griff/Henkel als Röhre entlang Punkten (Gießkanne, Tasse, Korb)."""
    stab(prop, points, radius, color, mat)


def tuelle(prop: Prop, start: Vec, end: Vec, r0: float, r1: float, color: Color, mat: str = "lack") -> None:
    """Ausguss/Tülle: kegelige Röhre (Gießkanne, Kanne)."""
    frames = k.path_frames([start, end], 8)
    obj = k.tube(f"{prop.name}-tuelle", frames, lambda fr, a: (r0 + (r1 - r0) * fr.t,) * 2, around=12)
    prop.add(obj, color, mat)


# ---------------------------------------------------------------------------------------------
# Grundformen: Möbel & Kästen
# ---------------------------------------------------------------------------------------------


def kasten(prop: Prop, at: Vec, size: Vec, color: Color, *, radius: float = 0.03, mat: str = "lack", segments: int = 3) -> bpy.types.Object:
    """Gerundeter Kasten (Toaster, Bienenstock-Zarge, Kiste, Brett, Tür)."""
    obj = k.rounded_box(f"{prop.name}-kasten", (0, 0, 0), size, radius, segments=segments)
    return prop.add(move(obj, at), color, mat)


def brett(prop: Prop, at: Vec, size: Vec, color: Color, *, grain: Color | None = None, mat: str = "matt") -> bpy.types.Object:
    """Holzbrett mit Maserung als Vertexfarbe (Zaunlatte, Rahmen, Schneidebrett)."""
    obj = k.rounded_box(f"{prop.name}-brett", (0, 0, 0), size, min(size) * 0.25, segments=2)
    if grain is not None:
        def paint(p: Vector, n: Vector) -> Color:
            s = math.sin(p.x * 9 + p.z * 40 + math.sin(p.z * 13) * 2)
            return mix(color, grain, 0.5 + 0.5 * s)

        k.paint(obj, paint)
        return prop.add(move(obj, at), mat=mat)
    return prop.add(move(obj, at), color, mat)


# ---------------------------------------------------------------------------------------------
# Grundformen: Spielzeug
# ---------------------------------------------------------------------------------------------


def kugel(prop: Prop, at: Vec, radius: float, color: Color, *, scale: Vec = (1, 1, 1), mat: str = "lack", segments: int = 20) -> bpy.types.Object:
    obj = k.sphere(f"{prop.name}-kugel", (0, 0, 0), radius, scale=scale, segments=segments, rings=max(6, segments // 2))
    return prop.add(move(obj, at), color, mat)


def wolke(prop: Prop, at: Vec, radius: float, color: Color, *, under: Color | None = None, puffs: int = 6, mat: str = "matt") -> None:
    """Bauschige Wolke aus überlappenden Kugeln, unten flacher und dunkler."""
    rng = [(0.0, 0.0, 0.25, 1.0)]
    for i in range(puffs):
        a = 2 * math.pi * i / puffs
        rng.append((math.cos(a) * 0.95, math.sin(a) * 0.45, 0.05 + 0.25 * ((i * 7) % 3) / 2, 0.62 + 0.12 * ((i * 5) % 3)))
    objs = []
    for x, y, z, s in rng:
        o = k.sphere(f"{prop.name}-bausch", (0, 0, 0), radius * s, scale=(1, 1, 0.82), segments=16, rings=8)
        o = move(o, (at[0] + x * radius, at[1] + y * radius, at[2] + z * radius))
        if under is not None:
            base = at[2]

            def paint(p: Vector, n: Vector, base: float = base) -> Color:
                t = max(0.0, min(1.0, (p.z - base + radius * 0.2) / (radius * 0.7)))
                return mix(under, color, t)

            k.paint(o, paint)
            prop.add(o, mat=mat)
        else:
            prop.add(o, color, mat)
        objs.append(o)


def prisma(prop: Prop, at: Vec, size: Vec, color: Color, *, mat: str = "lack", bevel: float = 0.02) -> bpy.types.Object:
    """Dreiseitiges Prisma (Dachklotz, Keil): Grundfläche `size` x × y, Spitze oben, Kanten leicht
    gerundet. `at` = Mitte der Grundfläche."""
    import bmesh  # noqa: PLC0415

    sx, sy, sz = size
    mesh = bpy.data.meshes.new(f"{prop.name}-prisma")
    bm = bmesh.new()
    tri = [(-sx / 2, 0.0), (sx / 2, 0.0), (0.0, sz)]
    front = [bm.verts.new((x, -sy / 2, z)) for x, z in tri]
    back = [bm.verts.new((x, sy / 2, z)) for x, z in tri]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((front[j], front[i], back[i], back[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(f"{prop.name}-prisma", mesh)
    bpy.context.scene.collection.objects.link(obj)
    if bevel > 0:
        mod = obj.modifiers.new("kante", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "NONE"
        k._apply_modifiers(obj)
    return prop.add(move(obj, at), color, mat)


def blatt(prop: Prop, at: Vec, length: float, color: Color, *, width: float = 0.35, turn: Vec = (0, 0, 0), mat: str = "matt") -> bpy.types.Object:
    """Flaches, spitzovales Blatt (Laub, Schilfhalm, Blütenblatt): liegt entlang +X ab `at`,
    `turn` dreht es um seinen Ansatz (Grad, XYZ)."""
    o = k.sphere(f"{prop.name}-blatt", (0, 0, 0), length * 0.5, scale=(1, width, 0.08), segments=12, rings=6)
    move(o, (length * 0.5, 0, 0))
    rotate(o, turn)
    return prop.add(move(o, at), color, mat)


def fluegel(prop: Prop, root: Vec, length: float, color: Color, *, angle: float = 0.0, mat: str = "glas") -> None:
    """Flacher, ovaler Flügel (Biene, Fliege, Schmetterling)."""
    o = k.sphere(f"{prop.name}-fluegel", (0, 0, 0), length * 0.5, scale=(1, 0.55, 0.06), segments=14, rings=6)
    o = move(o, (length * 0.5, 0, 0))
    rotate(o, (0, -20, angle))
    prop.add(move(o, root), color, mat)


# ---------------------------------------------------------------------------------------------
# Grundformen: Gartengeräte
# ---------------------------------------------------------------------------------------------


def stab(prop: Prop, points: Sequence[Vec], radius: float, color: Color, mat: str = "lack", *, around: int = 10, rings: int | None = None) -> bpy.types.Object:
    """Stiel, Rohr oder Draht entlang Punkten (glatte Kurve), Enden gewölbt."""
    count = rings if rings is not None else max(2, 6 * (len(points) - 1))
    frames = k.path_frames(points, count)
    obj = k.tube(f"{prop.name}-stab", frames, lambda fr, a: (radius, radius), around=around, dome_start=0.6, dome_end=0.6, dome_rings=3)
    return prop.add(obj, color, mat)


def ring(prop: Prop, at: Vec, major: float, minor: float, color: Color, *, tilt: Vec = (0, 0, 0), mat: str = "lack", segments: int = 32) -> bpy.types.Object:
    obj = k.torus(f"{prop.name}-ring", (0, 0, 0), major, minor, segments=segments, sides=8)
    rotate(obj, tilt)
    return prop.add(move(obj, at), color, mat)


def netz(prop: Prop, at: Vec, radius: float, depth: float, color: Color, *, tilt: Vec = (0, 0, 0), mat: str = "matt") -> None:
    """Kescher-Netz: Beutel als dünne Schale mit Rautenmuster (Vertexfarbe)."""
    prof = []
    for i in range(9):
        t = i / 8
        prof.append((radius * math.sin(math.pi / 2 * (1 - t)) ** 0.8 + 0.002, -depth * math.cos(math.pi / 2 * (1 - t)) ** 1.4))
    prof = list(reversed(prof))  # von unten (Beutelspitze) nach oben (Ring)
    obj = k.lathe(f"{prop.name}-netz", prof, segments=24)

    def paint(p: Vector, n: Vector) -> Color:
        a = math.atan2(p.y, p.x)
        s = abs(math.sin(a * 9 + p.z * 40)) < 0.25 or abs(math.sin(a * 9 - p.z * 40)) < 0.25
        return color if s else mix(color, P["creme"], 0.6)

    k.paint(obj, paint)
    rotate(obj, tilt)
    prop.add(move(obj, at), mat=mat)
