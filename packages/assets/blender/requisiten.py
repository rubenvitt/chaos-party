"""
Requisiten der Minispiele (CHAOS-88): je Familie ein Set, erste Sets für die Pilotwelle.

Jede Funktion baut genau ein Requisit in die leere Szene; `props.py` exportiert es als GLB.
Die Liste `PROPS` muss zu `PROP_CATALOG` in `packages/assets/src/props.ts` passen (geprüft
von `pnpm check:assets`).

Sets (Familie aus `docs/minigames/katalog.md`):
- fangen (1, Fangen & Sammeln): eichel, eichel-faul, kescher, sammelkorb – MG-001 Nussregen-Netz
- ausweichen (2): rasensprenger, schlauchtrommel – MG-011 Rasensprenger-Rodeo
- rempeln (3): eiswuerfel, limoglas, zitronenscheibe, strohhalm – MG-023 Eiswürfel-Sumo
- timing (4): toaster, toast – MG-033 Toaster-Timing
- reflex (5): mausefalle, kaese – MG-045 Schnapp den Käse
- zocken (11): bienenstock, honigtopf, biene – MG-101 Bienenstock-Honig
- bluff (12): tuer, tuerschild – MG-111 Drei Türen
- revier (13): matscheimer, regenwolke – MG-121 Matschmaler
Kulissen nach Ort (für die Arena-Vorlagen aus CHAOS-83):
- kulisse-garten: zaunfeld, blumentopf, giesskanne
- kulisse-kueche: kochtopf, milchkanne, holzloeffel
- kulisse-bad: badewanne, quietscheente, seifenstueck (CHAOS-222)
- kulisse-teich: seerose, schilf, steg (CHAOS-222)
- kulisse-spielzimmer: bauklotz, spielball, spielkiste (CHAOS-222)
- kulisse-wald: baumstumpf, fliegenpilz, ast (CHAOS-222)
- kulisse-dachboden: truhe, koffer, lampe (CHAOS-222)
"""

from __future__ import annotations

import math
from typing import Callable

import requisitkit as r
from requisitkit import P, Prop
import figurkit as k
from mathutils import Vector  # noqa: E402


# ---------------------------------------------------------------------------------------------
# fangen: Fangen & Sammeln
# ---------------------------------------------------------------------------------------------


def eichel() -> Prop:
    """Dicke Eichel, ≈ 0,32 m (Figur fängt sie mit dem Kescher)."""
    p = Prop("eichel")
    r.nuss(p, (0, 0, 0), 0.24, P["nuss"], P["nuss_kappe"])
    return p


def eichel_faul() -> Prop:
    """Faule Eichel: grünlich-braun mit Flecken, Kappe schief (stinkt: kurz langsamer)."""
    p = Prop("eichel-faul")
    r.nuss(p, (0, 0, 0), 0.24, P["faul"], r.mix(P["nuss_kappe"], P["faul_fleck"], 0.5), spots=P["faul_fleck"])
    return p


def kescher() -> Prop:
    """Kescher: Holzstiel, Metallring, Netzbeutel; liegt mit dem Stiel nach hinten (+Y)."""
    p = Prop("kescher")
    r.stab(p, [(0, 0.95, 0.06), (0, 0.15, 0.18)], 0.03, P["holz"], "matt")
    r.stab(p, [(0, 0.98, 0.055), (0, 0.84, 0.075)], 0.036, P["rot"])  # Griffkappe
    r.ring(p, (0, -0.14, 0.2), 0.3, 0.022, P["blech"], tilt=(-10, 0, 0), mat="metall")
    r.netz(p, (0, -0.14, 0.2), 0.3, 0.32, P["creme"], tilt=(-10, 0, 0))
    return p


def sammelkorb() -> Prop:
    """Weidenkorb mit Henkel (Abgabe der Nüsse am eigenen Nest); Band in Slot-Farbe."""
    p = Prop("sammelkorb")
    prof = [(0.24, 0.0), (0.3, 0.06), (0.36, 0.3)]
    obj = r.gefaess(p, prof, P["stroh"], wall=0.035, mat="matt", inner=r.mix(P["stroh"], P["holz_dunkel"], 0.35))
    # Flechtmuster in die Vertexfarbe
    layer = obj.data.color_attributes["Farbe"]
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            v = obj.data.vertices[obj.data.loops[li].vertex_index].co
            a = math.atan2(v.y, v.x)
            s = math.sin(a * 14) * math.sin(v.z * 60)
            if s > 0.2:
                c = layer.data[li].color
                layer.data[li].color = (c[0] * 0.78, c[1] * 0.78, c[2] * 0.78, 1.0)
    r.ring(p, (0, 0, 0.2), 0.335, 0.025, P["weiss"], mat="akzent")
    r.henkel(p, [(-0.33, 0, 0.3), (-0.22, 0, 0.6), (0, 0, 0.68), (0.22, 0, 0.6), (0.33, 0, 0.3)], 0.022, P["holz"], "matt")
    return p


# ---------------------------------------------------------------------------------------------
# ausweichen: Ausweichen & Überleben
# ---------------------------------------------------------------------------------------------


def rasensprenger() -> Prop:
    """Kreisregner: runder Fuß, Säule, zwei Drehdüsen-Arme mit Düsenköpfen (der Arm dreht sich
    im Spiel um Y; Wasserstrahl kommt als Effekt)."""
    p = Prop("rasensprenger")
    r.drehkoerper(p, [(0.26, 0.0), (0.26, 0.04), (0.2, 0.09)], P["schlauch"], segments=28)
    r.stab(p, [(0, 0, 0.08), (0, 0, 0.36)], 0.045, P["blech"], "metall")
    r.kugel(p, (0, 0, 0.38), 0.07, P["gelb"])
    for sign in (-1, 1):
        r.stab(p, [(0, 0, 0.38), (sign * 0.22, 0, 0.42), (sign * 0.36, 0.06 * sign, 0.4)], 0.025, P["gelb"])
        r.kugel(p, (sign * 0.37, 0.06 * sign, 0.4), 0.045, P["blech_dunkel"], mat="metall")
    return p


def schlauchtrommel() -> Prop:
    """Schlauchtrommel: zwei Räder, aufgewickelter grüner Schlauch, Bügel."""
    p = Prop("schlauchtrommel")
    for x in (-0.22, 0.22):
        r.ring(p, (x, 0, 0.3), 0.26, 0.03, P["rot"], tilt=(0, 90, 0))
        r.kugel(p, (x, 0, 0.3), 0.05, P["blech"], mat="metall")
    for i in range(7):
        x = -0.16 + i * 0.053
        r.ring(p, (x, 0, 0.3), 0.16, 0.03, r.mix(P["schlauch"], P["laub_dunkel"], (i % 2) * 0.35), tilt=(0, 90, 0), segments=20)
    r.stab(p, [(0.24, 0, 0.3), (0.24, 0.1, 0.62), (-0.24, 0.1, 0.62), (-0.24, 0, 0.3)], 0.02, P["blech_dunkel"], "metall")
    for x in (-0.24, 0.24):
        r.stab(p, [(x, -0.12, 0.0), (x, 0, 0.3), (x, 0.14, 0.0)], 0.018, P["blech_dunkel"], "metall")
    return p


# ---------------------------------------------------------------------------------------------
# rempeln: Rempeln & Runterschubsen
# ---------------------------------------------------------------------------------------------


def eiswuerfel() -> Prop:
    """Eiswürfel als Spielfläche (1 m Kante, Spiel skaliert ihn beim Schmelzen kleiner)."""
    p = Prop("eiswuerfel")
    obj = k.rounded_box("eiswuerfel-eis", (0, 0, 0), (1.0, 1.0, 0.5), 0.09, segments=3)

    def paint(pt: Vector, n: Vector) -> k.Color:
        return r.mix(P["eis"], P["weiss"], 0.6) if n.z > 0.7 else r.mix(P["eis"], k.hex_color("#9fd3ec"), 0.35)

    k.paint(obj, paint)
    p.add(obj, mat="glas")
    return p


def limoglas() -> Prop:
    """Riesiges Limoglas als Kulisse (die Arena schwimmt darin): Glas, Limo-Pegel innen."""
    p = Prop("limoglas")
    r.gefaess(p, [(1.55, 0.0), (1.6, 0.1), (1.8, 1.1)], P["eis"], wall=0.05, mat="glas", segments=40)
    r.drehkoerper(p, [(1.52, 0.06), (1.66, 0.82)], P["limo"], mat="glas", segments=40)
    return p


def zitronenscheibe() -> Prop:
    """Zitronenscheibe (schwimmt in der Limo): Schale, helles Fruchtfleisch mit Segmenten."""
    p = Prop("zitronenscheibe")
    disc = k.cylinder("zitrone-scheibe", (0, 0, 0), 0.32, 0.06, segments=28)

    def paint(pt: Vector, n: Vector) -> k.Color:
        rr = math.hypot(pt.x, pt.y)
        if rr > 0.29:
            return P["zitrone"]
        a = math.atan2(pt.y, pt.x)
        seg = abs(math.sin(a * 5)) < 0.12 or rr < 0.04
        return P["zitrone_hell"] if seg else r.mix(P["zitrone"], P["zitrone_hell"], 0.45)

    k.paint(disc, paint)
    p.add(disc, mat="lack")
    return p


def strohhalm() -> Prop:
    """Knick-Strohhalm mit Ringeln (Kulisse am Glasrand)."""
    p = Prop("strohhalm")
    pts = [(0, 0, 0), (0, 0, 1.6), (0, -0.08, 1.75), (0, -0.4, 1.95)]
    frames = k.path_frames(pts, 40)
    obj = k.tube("strohhalm-rohr", frames, lambda fr, a: (0.05, 0.05), around=12)

    def paint(pt: Vector, n: Vector) -> k.Color:
        return P["rot"] if math.sin(pt.z * 14 + pt.y * 14) > 0 else P["creme"]

    k.paint(obj, paint)
    p.add(obj)
    return p


# ---------------------------------------------------------------------------------------------
# timing: Timing & Rhythmus
# ---------------------------------------------------------------------------------------------


def toaster() -> Prop:
    """Retro-Toaster mit zwei Schlitzen, Hebel, Drehknopf; Zierstreifen in Slot-Farbe."""
    p = Prop("toaster")
    r.kasten(p, (0, 0, 0.3), (0.8, 0.5, 0.6), P["blech"], radius=0.14, mat="metall")
    for y in (-0.1, 0.1):  # Schlitze quer, passend zur Toastscheibe (0,37 breit, 0,11 dick)
        r.kasten(p, (0, y, 0.6), (0.5, 0.11, 0.03), P["tinte"], radius=0.012, mat="matt")
    r.kasten(p, (0, -0.255, 0.22), (0.62, 0.02, 0.08), P["weiss"], radius=0.01, mat="akzent")
    r.kasten(p, (0.42, 0.0, 0.42), (0.06, 0.1, 0.05), P["tinte"], radius=0.015)
    r.kugel(p, (-0.25, -0.26, 0.4), 0.05, P["rot"], scale=(1, 0.5, 1))
    for x in (-0.3, 0.3):
        for y in (-0.16, 0.16):
            r.kugel(p, (x, y, 0.0), 0.04, P["tinte"], scale=(1, 1, 0.5), mat="matt")
    return p


def toast() -> Prop:
    """Toastscheibe: Kruste als Vertexfarbe, Krume im Material `zustand` (das Spiel färbt die
    Bräunung von hell über goldbraun nach verkohlt)."""
    p = Prop("toast")
    crumb = k.rounded_box("toast-krume", (0, 0, 0), (0.28, 0.05, 0.3), 0.02, segments=2)
    r.move(crumb, (0, 0, 0.15))
    p.add(crumb, mat="zustand")
    top = k.sphere("toast-kuppe", (0, 0, 0), 0.16, scale=(1, 0.33, 0.55), segments=16, rings=8)
    p.add(r.move(top, (0, 0, 0.3)), mat="zustand")
    # Kruste: Rahmen um die Krume
    pts = [(-0.15, 0, 0.0), (-0.155, 0, 0.3), (-0.08, 0, 0.39), (0, 0, 0.395), (0.08, 0, 0.39), (0.155, 0, 0.3), (0.15, 0, 0.0)]
    r.stab(p, pts, 0.028, P["kruste"], "matt", rings=36)
    r.stab(p, [(-0.15, 0, 0.0), (0.15, 0, 0.0)], 0.028, P["kruste"], "matt")
    return p


# ---------------------------------------------------------------------------------------------
# reflex: Reflex & Reaktion
# ---------------------------------------------------------------------------------------------


def mausefalle() -> Prop:
    """Mausefalle: Holzbrett, Bügel (dreht im Spiel um X am Gelenk vorn), Feder, Köderplatte."""
    p = Prop("mausefalle")
    r.brett(p, (0, 0, 0.03), (0.42, 0.8, 0.06), P["holz_hell"], grain=P["holz"])
    r.stab(p, [(-0.17, -0.02, 0.07), (-0.17, -0.34, 0.07), (0.17, -0.34, 0.07), (0.17, -0.02, 0.07)], 0.014, P["blech"], "metall")
    for x in (-0.06, 0.06):
        r.ring(p, (x, 0.0, 0.1), 0.035, 0.012, P["blech_dunkel"], tilt=(0, 90, 0), mat="metall", segments=16)
    r.kasten(p, (0, 0.22, 0.075), (0.12, 0.14, 0.02), P["gelb"], radius=0.006, mat="metall")
    return p


def kaese() -> Prop:
    """Käsestück (Keil) mit Löchern als dunkle Flecken (Köder in der Falle)."""
    p = Prop("kaese")
    import bmesh  # noqa: PLC0415
    import bpy  # noqa: PLC0415

    mesh = bpy.data.meshes.new("kaese-keil")
    bm = bmesh.new()
    pts = [(0, 0), (0.34, -0.12), (0.34, 0.12)]
    vs_lo = [bm.verts.new((x - 0.17, y, 0.0)) for x, y in pts]
    vs_hi = [bm.verts.new((x - 0.17, y, 0.2)) for x, y in pts]
    bm.faces.new(list(reversed(vs_lo)))
    bm.faces.new(vs_hi)
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((vs_lo[i], vs_lo[j], vs_hi[j], vs_hi[i]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("kaese-keil", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bev = obj.modifiers.new("kante", "BEVEL")
    bev.width = 0.025
    bev.segments = 3
    sub = obj.modifiers.new("teile", "SUBSURF")
    sub.levels = 1
    sub.subdivision_type = "SIMPLE"
    k._apply_modifiers(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = False

    holes = [Vector(h) for h in [(0.05, -0.05, 0.2), (0.1, 0.06, 0.08), (-0.06, 0.03, 0.2), (0.12, -0.11, 0.12), (0.15, 0.04, 0.2), (0.17, 0.0, 0.1)]]

    def paint(pt: Vector, n: Vector) -> k.Color:
        for h in holes:
            if (pt - h).length < 0.035:
                return P["kaese_loch"]
        return P["kaese"]

    k.paint(obj, paint)
    p.add(obj, mat="matt")
    return p


# ---------------------------------------------------------------------------------------------
# zocken: Zocken & Push-your-luck
# ---------------------------------------------------------------------------------------------


def bienenstock() -> Prop:
    """Korb-Bienenstock (Strohkuppel aus Wülsten) auf einem Holzbock, Flugloch vorn."""
    p = Prop("bienenstock")
    r.brett(p, (0, 0, 0.12), (0.9, 0.9, 0.08), P["holz"], grain=P["holz_dunkel"])
    for x in (-0.35, 0.35):
        for y in (-0.35, 0.35):
            r.stab(p, [(x, y, 0.0), (x, y, 0.1)], 0.04, P["holz_dunkel"], "matt")
    rings = 7
    for i in range(rings):
        t = i / rings
        z = 0.2 + i * 0.11
        rad = 0.42 * math.cos(t * math.pi / 2 * 0.92) + 0.03
        r.ring(p, (0, 0, z), rad, 0.07, r.mix(P["stroh"], P["holz"], 0.15 * (i % 2)), mat="matt", segments=28)
    r.kugel(p, (0, 0, 0.2 + rings * 0.11 - 0.04), 0.1, P["stroh"], scale=(1, 1, 0.6), mat="matt")
    r.kugel(p, (0, -0.42, 0.28), 0.09, P["tinte"], scale=(1, 0.5, 0.7), mat="matt")
    return p


def honigtopf() -> Prop:
    """Honigtopf (Glas, Deckel mit Stoffhaube) – gesicherter Honig; Band in Slot-Farbe."""
    p = Prop("honigtopf")
    r.drehkoerper(p, [(0.16, 0.0), (0.2, 0.05), (0.21, 0.26), (0.15, 0.36)], P["honig"], mat="glas", segments=28)
    r.kugel(p, (0, 0, 0.38), 0.21, P["creme"], scale=(1, 1, 0.3), mat="matt")
    r.ring(p, (0, 0, 0.35), 0.16, 0.022, P["weiss"], mat="akzent")
    r.kugel(p, (0, -0.17, 0.42), 0.05, P["honig_dunkel"], scale=(0.6, 0.5, 1.2))  # Tropfen
    return p


def biene() -> Prop:
    """Pummelige Biene mit Streifen, Glasflügeln, Fühlern und Stachel (fliegt, Blick -Y)."""
    p = Prop("biene")
    body = k.sphere("biene-koerper", (0, 0, 0), 0.16, scale=(0.9, 1.25, 0.9), segments=20, rings=10)

    def paint(pt: Vector, n: Vector) -> k.Color:
        return P["tinte"] if math.sin(pt.y * 34 + 1.2) > 0.35 and pt.y > -0.12 else P["biene_gelb"]

    k.paint(body, paint)
    p.add(r.move(body, (0, 0, 0.18)))
    for sx in (-0.05, 0.05):
        r.kugel(p, (sx, -0.19, 0.24), 0.028, P["weiss"], segments=10)
        r.kugel(p, (sx, -0.21, 0.24), 0.014, P["tinte"], segments=8)
        r.stab(p, [(sx * 0.8, -0.17, 0.3), (sx * 1.6, -0.22, 0.42)], 0.008, P["tinte"], around=6)
    r.fluegel(p, (0.06, 0.02, 0.3), 0.2, P["fluegel"], angle=20)
    r.fluegel(p, (-0.06, 0.02, 0.3), 0.2, P["fluegel"], angle=160)
    r.stab(p, [(0, 0.19, 0.17), (0, 0.26, 0.15)], 0.012, P["tinte"], around=6)
    return p


# ---------------------------------------------------------------------------------------------
# bluff: Bluff & geheime Wahl
# ---------------------------------------------------------------------------------------------


def tuer() -> Prop:
    """Freistehende Tür im Holzrahmen: Türblatt im Material `zustand` (das Spiel gibt jeder Tür
    eine eigene Farbe, nie allein als Information), Füllungen, Messingklinke, Stufe."""
    p = Prop("tuer")
    r.brett(p, (0, 0, 0.04), (1.3, 0.5, 0.08), P["holz_dunkel"], grain=P["rinde"])
    for x in (-0.58, 0.58):
        r.brett(p, (x, 0, 1.13), (0.14, 0.18, 2.1), P["holz"], grain=P["holz_dunkel"])
    r.brett(p, (0, 0, 2.22), (1.3, 0.2, 0.14), P["holz"], grain=P["holz_dunkel"])
    r.kasten(p, (0, 0, 1.12), (1.02, 0.08, 2.08), P["weiss"], radius=0.02, mat="zustand")
    for z in (0.62, 1.55):
        r.kasten(p, (0, -0.045, z), (0.74, 0.02, 0.7), r.mix(P["tinte"], P["creme"], 0.75), radius=0.03, mat="matt")
    r.kugel(p, (0.38, -0.08, 1.1), 0.045, P["gelb"], mat="metall")
    r.stab(p, [(0.38, -0.1, 1.1), (0.26, -0.1, 1.1)], 0.02, P["gelb"], "metall")
    return p


def tuerschild() -> Prop:
    """Rundes Schild über der Tür für Zahl oder Symbol (Rand Holz, Fläche Creme)."""
    p = Prop("tuerschild")
    r.ring(p, (0, 0, 0.24), 0.2, 0.035, P["holz"], tilt=(90, 0, 0), mat="matt")
    disc = k.cylinder("schild-flaeche", (0, 0, 0), 0.2, 0.03, segments=28, axis="Y")
    p.add(r.move(disc, (0, 0, 0.24)), P["creme"], "matt")
    return p


# ---------------------------------------------------------------------------------------------
# revier: Revier & Malen
# ---------------------------------------------------------------------------------------------


def matscheimer() -> Prop:
    """Zinkeimer voll Matsch, Henkel; Matsch im Material `akzent` (Slot-Farbe des Malers)."""
    p = Prop("matscheimer")
    r.gefaess(p, [(0.22, 0.0), (0.24, 0.04), (0.3, 0.42)], P["blech"], wall=0.025, mat="metall", segments=28)
    r.ring(p, (0, 0, 0.14), 0.255, 0.012, P["blech_dunkel"], mat="metall")
    r.ring(p, (0, 0, 0.32), 0.282, 0.012, P["blech_dunkel"], mat="metall")
    surface = k.sphere("matsch", (0, 0, 0), 0.28, scale=(1, 1, 0.18), segments=20, rings=8)
    k.deform(surface, k.bump(Vector((0.08, 0.05, 0.05)), Vector((0, 0, 1)), 0.05, 0.08))
    p.add(r.move(surface, (0, 0, 0.36)), mat="akzent")
    r.henkel(p, [(-0.3, 0, 0.4), (-0.18, 0, 0.62), (0.18, 0, 0.62), (0.3, 0, 0.4)], 0.012, P["blech_dunkel"], "metall")
    return p


def regenwolke() -> Prop:
    """Regenwolke (Regenschauer wäscht einen Streifen weg): weiß oben, grau unten. Schwebt:
    Ursprung unter der Wolke, Boden bei z = 0 wie alle Requisiten."""
    p = Prop("regenwolke")
    r.wolke(p, (0, 0, 0.5), 0.55, P["wolke"], under=P["wolke_dunkel"], puffs=7)
    return p


# ---------------------------------------------------------------------------------------------
# kulisse-garten / kulisse-kueche: Set-Dressing nach Ort
# ---------------------------------------------------------------------------------------------


def zaunfeld() -> Prop:
    """Lattenzaun-Feld (1,2 m breit): spitze Latten in Creme auf zwei Querriegeln."""
    p = Prop("zaunfeld")
    for z in (0.22, 0.58):
        r.brett(p, (0, 0.04, z), (1.2, 0.04, 0.08), P["holz"], grain=P["holz_dunkel"])
    for i in range(6):
        x = -0.5 + i * 0.2
        r.brett(p, (x, 0, 0.38), (0.13, 0.035, 0.76), P["creme"])
        r.kugel(p, (x, 0, 0.78), 0.075, P["creme"], scale=(0.92, 0.25, 0.7), mat="matt", segments=12)
    return p


def blumentopf() -> Prop:
    """Tontopf mit Erde und Tulpenbusch (Blüten gelb und rot, kein Slot-Farbton)."""
    p = Prop("blumentopf")
    r.gefaess(p, [(0.15, 0.0), (0.2, 0.26), (0.23, 0.3)], P["ton"], wall=0.025, mat="matt", inner=P["matsch"], segments=24)
    r.kugel(p, (0, 0, 0.26), 0.19, P["matsch"], scale=(1, 1, 0.15), mat="matt")
    for i, (dx, dy, h, col) in enumerate([(0, 0, 0.62, P["rot"]), (0.09, 0.05, 0.52, P["gelb"]), (-0.08, 0.06, 0.55, P["rot"]), (0.0, -0.09, 0.5, P["gelb"])]):
        r.stab(p, [(dx * 0.3, dy * 0.3, 0.26), (dx, dy, h)], 0.012, P["laub_dunkel"], "matt", around=6)
        r.kugel(p, (dx, dy, h + 0.04), 0.055, col, scale=(1, 1, 1.35), segments=12)
        leaf = k.sphere(f"tulpe-blatt{i}", (0, 0, 0), 0.09, scale=(0.35, 0.12, 1), segments=10, rings=6)
        r.rotate(leaf, (0, 25 * (1 if dx >= 0 else -1), i * 70))
        p.add(r.move(leaf, (dx * 0.5, dy * 0.5, 0.36)), P["laub"], "matt")
    return p


def giesskanne() -> Prop:
    """Gießkanne aus Blech: Bauch, Bügelgriff, lange Tülle mit Brause."""
    p = Prop("giesskanne")
    r.gefaess(p, [(0.2, 0.0), (0.23, 0.08), (0.22, 0.34), (0.14, 0.42)], P["schlauch"], wall=0.02, mat="metall", segments=28)
    r.henkel(p, [(0.12, 0, 0.4), (0.2, 0, 0.56), (0.0, 0, 0.6), (-0.16, 0, 0.42)], 0.022, P["laub_dunkel"], "metall")
    r.tuelle(p, (-0.18, 0, 0.12), (-0.52, 0, 0.5), 0.045, 0.025, P["schlauch"], "metall")
    r.gefaess(p, [(0.03, 0.0), (0.07, 0.05)], P["blech"], wall=0.01, mat="metall", segments=16, at=(0, 0, 0))
    rose = p.parts["metall"][-1]
    r.rotate(rose, (0, -50, 0))
    r.move(rose, (-0.55, 0, 0.52))
    return p


def kochtopf() -> Prop:
    """Kochtopf mit Deckel und zwei Griffen."""
    p = Prop("kochtopf")
    r.gefaess(p, [(0.3, 0.0), (0.32, 0.04), (0.32, 0.36)], P["rot"], wall=0.02, mat="lack", segments=32, inner=P["blech"])
    r.kugel(p, (0, 0, 0.37), 0.33, P["blech"], scale=(1, 1, 0.16), mat="metall", segments=24)
    r.kugel(p, (0, 0, 0.44), 0.04, P["tinte"], segments=10)
    for x in (-0.36, 0.36):
        r.kasten(p, (x, 0, 0.3), (0.1, 0.16, 0.035), P["tinte"], radius=0.012)
    return p


def milchkanne() -> Prop:
    """Milchkanne (Blech, Schulter, Hals, Deckel, Henkel)."""
    p = Prop("milchkanne")
    r.gefaess(p, [(0.2, 0.0), (0.22, 0.05), (0.22, 0.36), (0.12, 0.46), (0.1, 0.58), (0.12, 0.62)], P["blech"], wall=0.02, mat="metall", segments=28)
    r.kugel(p, (0, 0, 0.62), 0.125, P["blech_dunkel"], scale=(1, 1, 0.3), mat="metall", segments=16)
    for x in (-0.24, 0.24):
        r.henkel(p, [(x * 0.92, 0, 0.42), (x * 1.08, 0, 0.47), (x * 0.92, 0, 0.52)], 0.015, P["blech_dunkel"], "metall")
    r.ring(p, (0, 0, 0.2), 0.222, 0.012, P["rot"])
    return p


def holzloeffel() -> Prop:
    """Großer Kochlöffel (liegt flach, Laffe vorn −Y)."""
    p = Prop("holzloeffel")
    r.stab(p, [(0, 0.55, 0.035), (0, 0.0, 0.035), (0, -0.18, 0.04)], 0.028, P["holz_hell"], "matt")
    r.kugel(p, (0, -0.3, 0.04), 0.11, P["holz_hell"], scale=(0.8, 1.15, 0.3), mat="matt", segments=16)
    return p


# ---------------------------------------------------------------------------------------------
# Kulissen weiterer Orte (CHAOS-222): Bad, Teich, Spielzimmer, Wald, Dachboden. Farben passend
# zu den Farbwelten `PLACES` der Arena-Vorlagen (packages/minigame-kit/src/babylon/arena.ts).
# ---------------------------------------------------------------------------------------------


def badewanne() -> Prop:
    """Ovale Klauenfuß-Wanne (1,6 m) mit Wasser, Chromfüßen und Wasserhahn am Kopfende (+X)."""
    p = Prop("badewanne")
    wanne = r.gefaess(p, [(0.3, 0.14), (0.35, 0.2), (0.4, 0.66)], P["fliese"], wall=0.04, mat="lack", inner=P["weiss"], segments=32)
    r.streck(wanne, (2.0, 1.0, 1.0))
    wasser = r.drehkoerper(p, [(0.33, 0.5), (0.355, 0.56)], P["wasser"], mat="glas", segments=32)
    r.streck(wasser, (2.0, 1.0, 1.0))
    for x in (-0.52, 0.52):
        for y in (-0.2, 0.2):
            r.kugel(p, (x, y, 0.08), 0.08, P["chrom"], scale=(1, 1, 1.3), mat="metall", segments=12)
    r.stab(p, [(0.86, 0, 0.6), (0.86, 0, 0.84), (0.72, 0, 0.88), (0.66, 0, 0.8)], 0.03, P["chrom"], "metall")
    for y in (-0.09, 0.09):
        r.kugel(p, (0.86, y, 0.7), 0.04, P["chrom"], mat="metall", segments=10)
    return p


def quietscheente() -> Prop:
    """Quietscheente (≈ 0,5 m, Spielzeug-groß): Bauch, Kopf, Schnabel vorn (−Y), Schwanzspitze."""
    p = Prop("quietscheente")
    r.kugel(p, (0, 0.02, 0.17), 0.22, P["ente"], scale=(0.85, 1.15, 0.75))
    r.kugel(p, (0, 0.23, 0.26), 0.07, P["ente"], scale=(0.8, 1, 1.2), segments=12)  # Schwanz
    r.kugel(p, (0, -0.12, 0.38), 0.13, P["ente"])
    r.kugel(p, (0, -0.25, 0.35), 0.07, P["schnabel"], scale=(1.1, 1.0, 0.45), segments=14)
    for sx in (-1, 1):
        r.kugel(p, (sx * 0.17, 0.04, 0.2), 0.09, r.mix(P["ente"], P["schnabel"], 0.15), scale=(0.35, 1.2, 0.6), segments=12)
        r.kugel(p, (sx * 0.06, -0.22, 0.43), 0.03, P["weiss"], segments=10)
        r.kugel(p, (sx * 0.065, -0.245, 0.435), 0.016, P["tinte"], segments=8)
    return p


def seifenstueck() -> Prop:
    """Seifenstück mit Schaumblasen auf einer flachen Seifenschale."""
    p = Prop("seifenstueck")
    r.gefaess(p, [(0.2, 0.0), (0.26, 0.05)], P["weiss"], wall=0.02, mat="lack", segments=24)
    schale = p.parts["lack"][-1]
    r.streck(schale, (1.35, 1.0, 1.0))
    seife = r.kasten(p, (0, 0, 0.1), (0.34, 0.2, 0.1), P["seife"], radius=0.04)
    r.rotate(seife, (0, 0, 8))
    for i, (x, y, rad) in enumerate([(0.05, 0.0, 0.05), (-0.06, 0.04, 0.04), (0.11, 0.05, 0.03), (-0.1, -0.05, 0.035), (0.0, -0.06, 0.03)]):
        r.kugel(p, (x, y, 0.15 + rad * 0.4), rad, r.mix(P["weiss"], P["wasser"], 0.15 * (i % 2)), mat="glas", segments=12)
    return p


def seerose() -> Prop:
    """Seerosenblatt mit Kerbe und weiß-rosa Blüte (schwimmt: Boden = Wasserlinie)."""
    p = Prop("seerose")
    pad = k.cylinder("seerose-blatt", (0, 0, 0.015), 0.48, 0.03, segments=32)

    def paint(pt: Vector, n: Vector) -> k.Color:
        a = math.atan2(pt.y, pt.x)
        if abs(a + math.pi / 2) < 0.18 and math.hypot(pt.x, pt.y) > 0.08:
            return P["wasser"]  # Kerbe als Wasser-Keil
        vein = abs(math.sin(a * 7)) < 0.08
        return P["laub_dunkel"] if vein else P["laub"]

    k.paint(pad, paint)
    p.add(pad, mat="lack")
    for ring_i, (count, length, lift) in enumerate([(8, 0.3, 30), (6, 0.22, 55)]):
        for i in range(count):
            angle = 360 * i / count + ring_i * 30
            petal = k.sphere(f"seerose-bluete{ring_i}-{i}", (0, 0, 0), length * 0.5, scale=(1, 0.42, 0.18), segments=12, rings=6)
            r.move(petal, (length * 0.5, 0, 0))

            def tip(pt: Vector, n: Vector, length: float = length) -> k.Color:
                return r.mix(P["seerose"], P["seerose_spitze"], max(0.0, (pt.x - length * 0.55) / (length * 0.45)))

            k.paint(petal, tip)
            r.rotate(petal, (0, -lift, angle))
            p.add(r.move(petal, (0, 0.04, 0.05)), mat="lack")
    r.kugel(p, (0, 0.04, 0.1), 0.06, P["gelb"], scale=(1, 1, 0.7), segments=12)
    return p


def schilf() -> Prop:
    """Schilfbüschel mit Rohrkolben (≈ 1,4 m) auf einem Matschhügel."""
    p = Prop("schilf")
    r.kugel(p, (0, 0, 0.0), 0.3, P["matsch"], scale=(1, 0.8, 0.3), mat="matt", segments=16)
    stems = [(0.0, 0.0, 1.35, 4), (0.12, 0.06, 1.15, -6), (-0.1, 0.05, 1.25, 7), (0.05, -0.1, 1.0, -3), (-0.06, -0.07, 0.9, 5)]
    for i, (x, y, h, lean) in enumerate(stems):
        top = (x + math.sin(math.radians(lean)) * h * 0.25, y, h)
        r.stab(p, [(x, y, 0.05), (x + (top[0] - x) * 0.5, y, h * 0.55), top], 0.014, P["schilf"], "matt", around=6)
        if i < 3:
            r.kugel(p, (top[0], y, h - 0.17), 0.045, P["kolben"], scale=(1, 1, 3.2), mat="matt", segments=10)
    for i, (turn, length) in enumerate([(70, 0.85), (115, 0.7), (250, 0.8), (300, 0.6)]):
        r.blatt(p, (0, 0, 0.06), length, r.mix(P["schilf"], P["laub_dunkel"], 0.3 * (i % 2)), width=0.08, turn=(0, -72 + 4 * i, turn))
    return p


def steg() -> Prop:
    """Stück Holzsteg (1,2 × 0,8 m): Planken quer, zwei Längsbalken, vier Pfähle bis zum Boden."""
    p = Prop("steg")
    for i in range(6):
        x = -0.5 + i * 0.2
        r.brett(p, (x, 0, 0.52), (0.18, 0.8, 0.05), r.mix(P["holz"], P["holz_hell"], 0.3 * (i % 2)), grain=P["holz_dunkel"])
    for y in (-0.3, 0.3):
        r.brett(p, (0, y, 0.45), (1.2, 0.08, 0.1), P["holz_dunkel"], grain=P["rinde"])
        for x in (-0.52, 0.52):
            r.stab(p, [(x, y, 0.0), (x, y, 0.62)], 0.06, P["rinde"], "matt", around=10)
    r.ring(p, (0.52, -0.3, 0.56), 0.075, 0.018, P["stroh"], mat="matt", segments=16)  # Seilschlinge
    return p


def bauklotz() -> Prop:
    """Bauklotz-Turm: roter Würfel, Holzwürfel, gelbe Säule, hellblaues Dach (Spielzimmer)."""
    p = Prop("bauklotz")
    r.kasten(p, (0, 0, 0.16), (0.32, 0.32, 0.32), P["rot"], radius=0.025)
    hk = r.kasten(p, (0.04, 0.0, 0.47), (0.3, 0.3, 0.3), P["holz_hell"], radius=0.025, mat="matt")
    r.rotate(hk, (0, 0, 18), pivot=(0.04, 0, 0.47))
    saeule = k.cylinder("bauklotz-saeule", (0, 0, 0.75), 0.12, 0.26, segments=20)
    for poly in saeule.data.polygons:
        poly.use_smooth = abs(poly.normal.z) < 0.5  # Deckel flach schattiert, Mantel glatt
    p.add(saeule, P["gelb"])
    r.prisma(p, (0, 0, 0.88), (0.36, 0.26, 0.2), P["hellblau"])
    return p


def spielball() -> Prop:
    """Wasserball mit sechs Bahnen (rot, gelb, hellblau im Wechsel mit Weiß), weiße Pole."""
    p = Prop("spielball")
    ball = k.sphere("spielball-kugel", (0, 0, 0), 0.3, segments=24, rings=12)
    colors = [P["rot"], P["weiss"], P["gelb"], P["weiss"], P["hellblau"], P["weiss"]]

    def paint(pt: Vector) -> k.Color:
        if abs(pt.z) > 0.26:
            return P["weiss"]
        a = (math.atan2(pt.y, pt.x) + math.pi) / (2 * math.pi)
        return colors[int(a * 6) % 6]

    r.flaechen(ball, paint)
    p.add(r.move(ball, (0, 0, 0.3)), mat="lack")
    r.kugel(p, (0, 0, 0.6), 0.03, P["weiss"], segments=8)  # Ventil
    return p


def spielkiste() -> Prop:
    """Spielzeugkiste aus Holz mit offenem Deckel, lila Zierband und bunten Kugeln drin."""
    p = Prop("spielkiste")
    w, d, h, t = 0.9, 0.56, 0.48, 0.04
    r.brett(p, (0, 0, t / 2), (w, d, t), P["holz_hell"], grain=P["holz"])
    for y in (-d / 2 + t / 2, d / 2 - t / 2):
        r.brett(p, (0, y, h / 2), (w, t, h), P["holz_hell"], grain=P["holz"])
    for x in (-w / 2 + t / 2, w / 2 - t / 2):
        r.brett(p, (x, 0, h / 2), (t, d, h), P["holz_hell"], grain=P["holz"])
    r.kasten(p, (0, -d / 2 - 0.004, h * 0.55), (w * 0.9, 0.012, 0.09), P["lila"], radius=0.005)
    lid = r.brett(p, (0, d / 2 + 0.2, h + 0.02), (w + 0.04, 0.42, 0.045), P["holz_hell"], grain=P["holz"])
    r.rotate(lid, (-35, 0, 0), pivot=(0, d / 2, h + 0.02))
    for i, (x, y, rad, col) in enumerate([(-0.22, -0.05, 0.12, P["rot"]), (0.05, 0.06, 0.13, P["hellblau"]), (0.25, -0.08, 0.1, P["gelb"])]):
        r.kugel(p, (x, y, h - 0.04), rad, col, segments=14)
    for x in (-w / 2 - 0.02, w / 2 + 0.02):
        r.ring(p, (x, 0, h * 0.7), 0.06, 0.014, P["holz_dunkel"], tilt=(0, 90, 0), mat="matt", segments=14)
    return p


def baumstumpf() -> Prop:
    """Baumstumpf mit Jahresringen, Rindenfurchen, drei Wurzeln und Moospolster."""
    p = Prop("baumstumpf")
    prof = [(0.42, 0.0), (0.36, 0.06), (0.32, 0.18), (0.31, 0.5), (0.3, 0.55)]
    stumpf = k.lathe("baumstumpf-holz", [(0.0, 0.0)] + prof + [(0.0, 0.55)], segments=28)

    def paint(pt: Vector, n: Vector) -> k.Color:
        rr = math.hypot(pt.x, pt.y)
        if n.z > 0.7 and pt.z > 0.5:
            ring_i = math.sin(rr * 70)
            return r.mix(P["holz_hell"], P["holz"], 0.35 + 0.35 * ring_i) if rr < 0.26 else P["holz"]
        groove = abs(math.sin(math.atan2(pt.y, pt.x) * 11 + pt.z * 3)) < 0.25
        return r.mix(P["rinde"], P["tinte"], 0.25) if groove else P["rinde"]

    k.paint(stumpf, paint)
    p.add(stumpf, mat="matt")
    for a in (20, 140, 260):
        rad = math.radians(a)
        c, s = math.cos(rad), math.sin(rad)
        r.stab(p, [(c * 0.25, s * 0.25, 0.14), (c * 0.45, s * 0.45, 0.06), (c * 0.6, s * 0.6, 0.02)], 0.06, P["rinde"], "matt", around=8)
    r.kugel(p, (0.16, -0.12, 0.55), 0.12, P["moos"], scale=(1, 0.8, 0.25), mat="matt", segments=12)
    return p


def fliegenpilz() -> Prop:
    """Großer Fliegenpilz (≈ 0,7 m) mit weißen Tupfen, Lamellen, Manschette; kleiner Pilz daneben."""
    p = Prop("fliegenpilz")
    for (x, y, size) in [(0.0, 0.0, 1.0), (0.3, 0.12, 0.45)]:
        stiel = [(0.1 * size, 0.0), (0.09 * size, 0.2 * size), (0.075 * size, 0.45 * size)]
        r.drehkoerper(p, stiel, P["creme"], mat="matt", at=(x, y, 0), segments=16)
        if size > 0.6:
            r.ring(p, (x, y, 0.33), 0.09, 0.018, P["weiss"], mat="matt", segments=16)
        hut = k.sphere(f"fliegenpilz-hut{size}", (0, 0, 0), 0.3 * size, scale=(1, 1, 0.55), segments=24, rings=12)

        def paint(pt: Vector, n: Vector, size: float = size) -> k.Color:
            if pt.z < 0.02 * size:
                return P["creme"]  # Lamellen
            spot = math.sin(pt.x / size * 26) * math.sin(pt.y / size * 24 + 1.0) * math.sin(pt.z / size * 30)
            return P["weiss"] if spot > 0.55 else P["pilz_rot"]

        k.paint(hut, paint)
        p.add(r.move(hut, (x, y, 0.45 * size)), mat="lack")
    return p


def ast() -> Prop:
    """Abgebrochener Ast (1,2 m) am Boden mit zwei Zweigen und ein paar Blättern."""
    p = Prop("ast")
    r.stab(p, [(-0.6, 0.0, 0.06), (-0.2, 0.04, 0.07), (0.2, -0.03, 0.06), (0.6, 0.02, 0.05)], 0.055, P["rinde"], "matt", around=10)
    r.drehkoerper(p, [(0.05, -0.62), (0.05, -0.6)], P["holz_hell"], mat="matt", segments=10)
    r.rotate(p.parts["matt"][-1], (0, 90, 0))
    r.stab(p, [(-0.1, 0.03, 0.08), (0.0, 0.25, 0.12), (0.12, 0.42, 0.16)], 0.025, P["rinde"], "matt", around=8)
    r.stab(p, [(0.25, -0.02, 0.07), (0.38, -0.22, 0.1), (0.42, -0.36, 0.15)], 0.022, P["rinde"], "matt", around=8)
    for (x, y, z, turn) in [(0.12, 0.42, 0.16, (0, -20, 50)), (0.0, 0.25, 0.12, (0, -15, 140)), (0.42, -0.36, 0.15, (0, -25, -60)), (0.38, -0.22, 0.1, (0, -10, -150))]:
        r.blatt(p, (x, y, z), 0.18, P["laub"], width=0.45, turn=turn)
    return p


def truhe() -> Prop:
    """Holztruhe mit gewölbtem Deckel, Eisenbändern und Messingschloss vorn (−Y)."""
    p = Prop("truhe")
    w, d, h = 0.9, 0.55, 0.42
    r.brett(p, (0, 0, h / 2), (w, d, h), P["holz"], grain=P["holz_dunkel"])
    deckel = k.cylinder("truhe-deckel", (0, 0, 0), d / 2, w, segments=24, axis="X")
    r.streck(deckel, (1.0, 1.0, 0.5))
    k.paint(deckel, lambda pt, n: r.mix(P["holz"], P["holz_dunkel"], 0.5 + 0.5 * math.sin(pt.x * 9 + pt.z * 30)))
    p.add(r.move(deckel, (0, 0, h)), mat="matt")
    for x in (-0.3, 0.3):
        r.kasten(p, (x, 0, h / 2), (0.06, d + 0.02, h + 0.01), P["blech_dunkel"], radius=0.01, mat="metall")
        band = k.cylinder("truhe-band", (0, 0, 0), d / 2 + 0.01, 0.06, segments=24, axis="X")
        r.streck(band, (1.0, 1.0, 0.52))
        p.add(r.move(band, (x, 0, h)), P["blech_dunkel"], "metall")
    r.kasten(p, (0, -d / 2 - 0.02, h - 0.05), (0.1, 0.03, 0.12), P["messing"], radius=0.012, mat="metall")
    return p


def koffer() -> Prop:
    """Alter Lederkoffer, aufrecht: zwei Riemen, Griff oben, Metallecken, Reiseaufkleber vorn."""
    p = Prop("koffer")
    w, d, h = 0.75, 0.24, 0.55
    r.kasten(p, (0, 0, h / 2), (w, d, h), P["leder"], radius=0.04, mat="matt")
    for x in (-0.2, 0.2):
        r.kasten(p, (x, 0, h / 2), (0.06, d + 0.012, h + 0.012), P["leder_hell"], radius=0.012, mat="matt")
        r.kasten(p, (x, -d / 2 - 0.008, h * 0.62), (0.07, 0.012, 0.05), P["messing"], radius=0.006, mat="metall")
    r.henkel(p, [(-0.1, 0, h), (-0.08, 0, h + 0.08), (0.08, 0, h + 0.08), (0.1, 0, h)], 0.02, P["leder_hell"], "matt")
    for x in (-w / 2 + 0.02, w / 2 - 0.02):
        for z in (0.03, h - 0.03):
            r.kugel(p, (x, 0, z), 0.04, P["messing"], scale=(0.8, 1.6, 0.8), mat="metall", segments=10)
    for (x, z, col, rad) in [(0.0, 0.2, P["gelb"], 0.07), (-0.08, 0.4, P["hellblau"], 0.05), (0.32, 0.36, P["creme"], 0.045)]:
        disc = k.cylinder("koffer-aufkleber", (0, 0, 0), rad, 0.008, segments=18, axis="Y")
        p.add(r.move(disc, (x, -d / 2 - 0.004, z)), col, "lack")
    return p


def lampe() -> Prop:
    """Petroleumlampe: Messingfuß, Glastank, Glaszylinder mit Bauch, leuchtende Flamme, Henkel."""
    p = Prop("lampe")
    r.drehkoerper(p, [(0.16, 0.0), (0.16, 0.03), (0.07, 0.08), (0.06, 0.12)], P["messing"], mat="metall", segments=24)
    r.drehkoerper(p, [(0.06, 0.12), (0.15, 0.18), (0.15, 0.24), (0.07, 0.3)], r.mix(P["messing"], P["flamme"], 0.4), mat="glas", segments=24)
    r.drehkoerper(p, [(0.08, 0.3), (0.08, 0.34)], P["messing"], mat="metall", segments=20)
    r.kugel(p, (0, 0, 0.43), 0.03, P["flamme"], scale=(1, 1, 2.0), segments=12)
    r.gefaess(p, [(0.065, 0.34), (0.11, 0.42), (0.07, 0.52), (0.06, 0.62)], P["eis"], wall=0.008, mat="glas", segments=24)
    r.henkel(p, [(0.15, 0, 0.06), (0.24, 0, 0.12), (0.22, 0, 0.24), (0.14, 0, 0.22)], 0.014, P["messing"], "metall")
    return p


PROPS: dict[str, Callable[[], Prop]] = {
    "eichel": eichel,
    "eichel-faul": eichel_faul,
    "kescher": kescher,
    "sammelkorb": sammelkorb,
    "rasensprenger": rasensprenger,
    "schlauchtrommel": schlauchtrommel,
    "eiswuerfel": eiswuerfel,
    "limoglas": limoglas,
    "zitronenscheibe": zitronenscheibe,
    "strohhalm": strohhalm,
    "toaster": toaster,
    "toast": toast,
    "mausefalle": mausefalle,
    "kaese": kaese,
    "bienenstock": bienenstock,
    "honigtopf": honigtopf,
    "biene": biene,
    "tuer": tuer,
    "tuerschild": tuerschild,
    "matscheimer": matscheimer,
    "regenwolke": regenwolke,
    "zaunfeld": zaunfeld,
    "blumentopf": blumentopf,
    "giesskanne": giesskanne,
    "kochtopf": kochtopf,
    "milchkanne": milchkanne,
    "holzloeffel": holzloeffel,
    "badewanne": badewanne,
    "quietscheente": quietscheente,
    "seifenstueck": seifenstueck,
    "seerose": seerose,
    "schilf": schilf,
    "steg": steg,
    "bauklotz": bauklotz,
    "spielball": spielball,
    "spielkiste": spielkiste,
    "baumstumpf": baumstumpf,
    "fliegenpilz": fliegenpilz,
    "ast": ast,
    "truhe": truhe,
    "koffer": koffer,
    "lampe": lampe,
}


KULISSEN: dict[str, list[str]] = {
    "garten": ["zaunfeld", "blumentopf", "giesskanne"],
    "kueche": ["kochtopf", "milchkanne", "holzloeffel"],
    "bad": ["badewanne", "quietscheente", "seifenstueck"],
    "teich": ["seerose", "schilf", "steg"],
    "spielzimmer": ["bauklotz", "spielball", "spielkiste"],
    "wald": ["baumstumpf", "fliegenpilz", "ast"],
    "dachboden": ["truhe", "koffer", "lampe"],
}
"""Kulissen-Set je Ort der Arena-Vorlagen (`kulisse-<ort>` in props.ts), für den Kulissen-Bogen."""
