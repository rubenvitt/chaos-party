// CHAOS-78, CHAOS-140: Prüft die erzeugten USDZ mit RealityKit (nur macOS).
// Aufruf: swift packages/assets/usd/check_realitykit.swift build/apple-assets
// (`node scripts/build-apple-assets.mjs` ruft das auf einem Mac selbst auf.)
// Bricht mit Exit-Code 1 ab, wenn ein Grundmesh oder Feld-Anker fehlt, eine Figur keine
// Animation hat, die Zeitleiste nicht zur Clip-Tabelle passt, die Achsen nicht stimmen oder ein
// aufgesetztes Teil (Socken-Bündchen, Kaktus-Blüte) über seinem Träger schwebt (CHAOS-161) oder
// ein Requisit nicht auf dem Boden steht, ein Teil fehlt oder Glas undurchsichtig lädt (CHAOS-221).
// Ohne Mac prüft `packages/assets/usd/check_usdz.py` dasselbe mit usd-core, aber nicht RealityKit.
// Diese Prüfung läuft in keiner CI (Linux-Job; die Mac-Workflows setzen RK_CHECK=0), nur lokal.
import Foundation
import RealityKit
import simd

let dir = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "build/apple-assets")
var failures = 0
func fail(_ msg: String) { print("FEHLER: \(msg)"); failures += 1 }

func count(_ e: Entity) -> Int { 1 + e.children.reduce(0) { $0 + count($1) } }
func firstModel(_ e: Entity) -> Entity? {
    e.components.has(ModelComponent.self) ? e : e.children.lazy.compactMap(firstModel).first
}
func fmt(_ v: SIMD3<Float>) -> String { String(format: "(%.2f, %.2f, %.2f)", v.x, v.y, v.z) }

// Kulissen je Brett (CHAOS-212): `bretter/<brett-id>/brett.usdz` mit `brett.szene.json` daneben.
struct Szene: Decodable {
    struct Inst: Decodable { let mesh: String }
    struct Feld: Decodable { let id: String; let anchor: String; let position: [Float] }
    let instanced: [Inst]
    let fields: [Feld]?
}
let boardDirs = ((try? FileManager.default.contentsOfDirectory(at: dir.appendingPathComponent("bretter"), includingPropertiesForKeys: nil)) ?? [])
    .filter { FileManager.default.fileExists(atPath: $0.appendingPathComponent("brett.usdz").path) }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
if boardDirs.isEmpty { fail("keine Kulisse unter bretter/<brett-id>/brett.usdz") }
for boardDir in boardDirs {
    let id = boardDir.lastPathComponent
    let brett = try await Entity(contentsOf: boardDir.appendingPathComponent("brett.usdz"))
    let b = brett.visualBounds(relativeTo: nil)
    print("\(id)/brett.usdz: \(count(brett)) Entitäten, Bounds min \(fmt(b.min)) max \(fmt(b.max))")
    // Die Wiese liegt flach (Y-up wie glTF/RealityKit) um die Brettmitte; Himmelskuppeln machen die Gesamt-Bounds ±250.
    if let wiese = brett.findEntity(named: "wiese") {
        let wb = wiese.visualBounds(relativeTo: nil)
        print("  wiese: Bounds min \(fmt(wb.min)) max \(fmt(wb.max))")
        if wb.extents.y > 2 || wb.extents.x < 20 || wb.min.z > -8 || wb.max.z < 8 { fail("\(id): Wiese liegt nicht wie im glTF – Achsen falsch") }
    } else { fail("\(id): wiese fehlt") }

    let szene = try JSONDecoder().decode(Szene.self, from: Data(contentsOf: boardDir.appendingPathComponent("brett.szene.json")))
    // Feld-Anker (CHAOS-140): leere Knoten `feld_<id>` an der Feldoberfläche, Weltkoordinaten wie im JSON.
    var anchorsOk = 0
    for feld in szene.fields ?? [] {
        guard let node = brett.findEntity(named: feld.anchor) else { fail("\(id): Feld-Anker \(feld.anchor) fehlt"); continue }
        let at = node.position(relativeTo: nil)
        let want = SIMD3<Float>(feld.position[0], feld.position[1], feld.position[2])
        if simd_distance(at, want) > 0.01 { fail("\(id): Feld-Anker \(feld.anchor) bei \(fmt(at)), erwartet \(fmt(want))") } else { anchorsOk += 1 }
    }
    print("  Feld-Anker: \(anchorsOk) von \((szene.fields ?? []).count) am richtigen Ort")
    if (szene.fields ?? []).isEmpty { fail("\(id)/brett.szene.json ohne Felder") }
    for inst in szene.instanced {
        let name = inst.mesh.replacingOccurrences(of: "-", with: "_")
        guard let node = brett.findEntity(named: name), let model = firstModel(node) else {
            fail("\(id): Grundmesh \(inst.mesh) (\(name)) fehlt"); continue
        }
        // Weltmatrix des Grundmeshes: das Instanz-Ergebnis ist M_json * w.
        let w = model.transformMatrix(relativeTo: nil)
        let mb = model.visualBounds(relativeTo: nil)
        // Grashalm: im glTF y 0…0,27, x ±0,02 – muss in RealityKit-Weltkoordinaten genauso stehen.
        if name.hasPrefix("gras"), mb.extents.y < 0.2 || mb.min.y < -0.01 { fail("\(id): \(name) steht nicht entlang +Y") }
        print("  \(inst.mesh) → \(name)/\(model.name): Basis-Weltmatrix Spalten \(fmt(SIMD3(w.columns.0.x, w.columns.0.y, w.columns.0.z))) \(fmt(SIMD3(w.columns.1.x, w.columns.1.y, w.columns.1.z))) \(fmt(SIMD3(w.columns.2.x, w.columns.2.y, w.columns.2.z))), Bounds \(fmt(mb.min))–\(fmt(mb.max))")
    }
}

// Auflage (CHAOS-161): wie `AUFLAGE` in check_usdz.py, hier mit den Meshes, wie RealityKit sie
// geladen hat (Ruhepose; das verformte Skinning gibt RealityKit nicht an die CPU heraus, die Clips
// prüft check_usdz.py mit usd-core). Median des Abstands der Unterseite zur Trägeroberfläche.
let auflage: [String: [(part: String, host: String)]] = [
    "sock": [("buendchen", "socke")],
    "cactus": [("bluete", "kaktus"), ("kaktus", "topf")],
]
let auflageBand: Float = 0.02
let auflageLuecke: Float = 0.03

struct Geometry { var points: [SIMD3<Float>] = []; var triangles: [SIMD3<Int>] = [] }
/// Hängt die Meshes aus der `ModelComponent` von `e` in Weltkoordinaten an, nur Instanzen, deren
/// Modell `include` durchlässt.
func appendModels(of e: Entity, into g: inout Geometry, include: (String) -> Bool = { _ in true }) {
    guard let model = e.components[ModelComponent.self] else { return }
    let world = e.transformMatrix(relativeTo: nil)
    let contents = model.mesh.contents
    for instance in contents.instances where include(instance.model) {
        guard let m = contents.models[instance.model] else { continue }
        let t = world * instance.transform
        for part in m.parts {
            let base = g.points.count
            for p in part.positions.elements {
                let w = t * SIMD4<Float>(p, 1)
                g.points.append(SIMD3(w.x, w.y, w.z))
            }
            let idx = part.triangleIndices?.elements ?? []
            for i in stride(from: 0, to: idx.count - 2, by: 3) {
                g.triangles.append(SIMD3(base + Int(idx[i]), base + Int(idx[i + 1]), base + Int(idx[i + 2])))
            }
        }
    }
}
func worldGeometry(_ e: Entity, into g: inout Geometry) {
    appendModels(of: e, into: &g)
    for child in e.children { worldGeometry(child, into: &g) }
}
/// Geometrie eines Figurenteils (CHAOS-201). Ungehäutete Teile (Blüte, Topf) tragen ihre
/// `ModelComponent` selbst oder an einem Kind. Gehäutete Teile (Socke, Bündchen, Kaktus) legt
/// RealityKit unter macOS 27 in die `ModelComponent` der Skelett-Entität (`sigi`, `kalle`), ein
/// Modell je Teil mit dessen Namen; unter dem Teilnamen bleiben dann nur leere Entitäten. Dann
/// zählen die gleichnamigen Modelle des nächsten Vorfahren, der welche hat.
func partGeometry(_ e: Entity) -> Geometry {
    var g = Geometry()
    worldGeometry(e, into: &g)
    var ancestor = e.parent
    while g.points.isEmpty, let a = ancestor {
        appendModels(of: a, into: &g) { $0 == e.name }
        ancestor = a.parent
    }
    return g
}
func contactGap(part: Geometry, host: Geometry) -> Float? {
    guard let minY = part.points.map(\.y).min(), !host.triangles.isEmpty else { return nil }
    let bottom = part.points.filter { $0.y <= minY + auflageBand }
    // Dichte Stichprobe der Trägeroberfläche mit Flächennormalen (Punkte im Träger zählen 0).
    var samples: [(p: SIMD3<Float>, n: SIMD3<Float>)] = []
    let steps = 6
    for tri in host.triangles {
        let a = host.points[tri.x], b = host.points[tri.y], c = host.points[tri.z]
        let n = simd_normalize(simd_cross(b - a, c - a))
        if !n.x.isFinite { continue }
        for i in 0...steps { for j in 0...(steps - i) {
            samples.append((a + (b - a) * Float(i) / Float(steps) + (c - a) * Float(j) / Float(steps), n))
        } }
    }
    var gaps: [Float] = bottom.map { p in
        var best = Float.infinity, inside = false
        for s in samples {
            let d = simd_distance(p, s.p)
            if d < best { best = d; inside = simd_dot(p - s.p, s.n) < 0 }
        }
        return inside ? 0 : best
    }
    gaps.sort()
    return gaps.isEmpty ? nil : gaps[gaps.count / 2]
}

// Figuren
struct Clips: Decodable { struct Clip: Decodable { let name: String; let start: Double; let end: Double }; let clips: [Clip] }
for c in ["robot", "cactus", "raccoon", "sock"] {
    let fig = try await Entity(contentsOf: dir.appendingPathComponent("figuren/\(c).usdz"))
    let fb = fig.visualBounds(relativeTo: nil)
    // Die Wurzel trägt die Gesamtanimation (Skelett + Xform-Zeitreihen); die App spielt die erste.
    let anims = fig.availableAnimations
    print("figuren/\(c).usdz: \(count(fig)) Entitäten, Höhe \(String(format: "%.2f", fb.extents.y)), Bounds min \(fmt(fb.min)) max \(fmt(fb.max)), Wurzel-Animationen: \(anims.map { "\($0.name ?? "?") \(String(format: "%.2f", $0.definition.duration)) s" })")
    if anims.isEmpty { fail("\(c): keine Animation an der Wurzel") }
    if fb.extents.y < max(fb.extents.x, fb.extents.z) * 0.5 { fail("\(c): liegt flach – Achsen falsch") }
    if fig.findEntity(named: "abzeichen") == nil { fail("\(c): Knoten abzeichen fehlt") }
    // Zeitleiste (CHAOS-140): Alle Clips liegen nacheinander auf einer Animation; die Dauer muss
    // zum Ende des letzten Clips passen, sonst stimmt der Nullpunkt für `trimmed(start:end:)` nicht.
    let table = try JSONDecoder().decode(Clips.self, from: Data(contentsOf: dir.appendingPathComponent("figuren/\(c).clips.json")))
    if let first = anims.first, let last = table.clips.last {
        let duration = first.definition.duration
        print("  \(c): Zeitleiste \(String(format: "%.2f", duration)) s, Tabelle bis \(String(format: "%.2f", last.end)) s")
        if abs(duration - last.end) > 0.05 { fail("\(c): Zeitleiste \(duration) s passt nicht zur Clip-Tabelle (\(last.end) s)") }
    }
    for pair in auflage[c] ?? [] {
        guard let partEntity = fig.findEntity(named: pair.part), let hostEntity = fig.findEntity(named: pair.host) else {
            fail("\(c): Teil \(pair.part) oder Träger \(pair.host) fehlt"); continue
        }
        let part = partGeometry(partEntity), host = partGeometry(hostEntity)
        guard let gap = contactGap(part: part, host: host) else { fail("\(c): \(pair.part)/\(pair.host) ohne Geometrie"); continue }
        print("  \(c): \(pair.part) auf \(pair.host): Lücke \(String(format: "%.1f", gap * 100)) cm")
        if gap > auflageLuecke { fail("\(c): \(pair.part) schwebt über \(pair.host) (\(String(format: "%.1f", gap * 100)) cm, erlaubt \(Int(auflageLuecke * 100)) cm)") }
    }
}

// Requisiten (CHAOS-221): `requisiten/<id>.usdz`, Wurzel `<id>` (Bindestrich → `_`), darunter je
// Material ein Teil `<id>_<material>`; Boden bei y = 0, Grundfläche mittig; `glas` durchscheinend.
// Der Host färbt `<id>_akzent` (Slot-Farbe) und `<id>_zustand` (Spielzustand) zur Laufzeit.
let propMaterials = ["lack", "matt", "glas", "metall", "akzent", "zustand"]
let propFiles = ((try? FileManager.default.contentsOfDirectory(at: dir.appendingPathComponent("requisiten"), includingPropertiesForKeys: nil)) ?? [])
    .filter { $0.pathExtension == "usdz" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
if propFiles.isEmpty { fail("keine Requisiten unter requisiten/<id>.usdz") }
for file in propFiles {
    let id = file.deletingPathExtension().lastPathComponent
    let name = id.replacingOccurrences(of: "-", with: "_")
    let prop = try await Entity(contentsOf: file)
    let pb = prop.visualBounds(relativeTo: nil)
    guard let root = prop.findEntity(named: name) else { fail("requisiten/\(id): Wurzelknoten \(name) fehlt"); continue }
    let parts = propMaterials.filter { root.findEntity(named: "\(name)_\($0)") != nil }
    print("requisiten/\(id).usdz: Höhe \(String(format: "%.3f", pb.extents.y)), Bounds min \(fmt(pb.min)) max \(fmt(pb.max)), Teile \(parts)")
    if parts.isEmpty { fail("requisiten/\(id): keine Teile <id>_<material>") }
    if abs(pb.min.y) > 0.01 { fail("requisiten/\(id): Boden bei y = \(pb.min.y) statt 0") }
    if abs(pb.center.x) > 0.01 || abs(pb.center.z) > 0.01 { fail("requisiten/\(id): Grundfläche nicht mittig (\(fmt(pb.center)))") }
    for part in parts {
        guard let entity = root.findEntity(named: "\(name)_\(part)"), let model = firstModel(entity),
              let component = model.components[ModelComponent.self] else {
            fail("requisiten/\(id): Teil \(name)_\(part) ohne Geometrie"); continue
        }
        guard part == "glas" else { continue }
        // UsdPreviewSurface mit opacity < 1 lädt RealityKit als durchscheinendes PBR-Material.
        for material in component.materials {
            if let pbr = material as? PhysicallyBasedMaterial {
                if case .opaque = pbr.blending { fail("requisiten/\(id): glas ist undurchsichtig") }
            } else {
                print("  \(id): glas als \(type(of: material)) geladen (Deckkraft nicht prüfbar)")
            }
        }
    }
}

print(failures == 0 ? "OK" : "\(failures) Fehler")
exit(failures == 0 ? 0 : 1)
