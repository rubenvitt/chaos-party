import Foundation
import QuartzCore
import RealityKit

/// Requisiten der Minispiele (CHAOS-237): jedes Requisit einmal als USDZ (`requisiten/<id>.usdz`, CHAOS-221) geladen;
/// jede Minispiel-Bühne bekommt mit `instance` einen eigenen Klon. Vertrag wie das GLB im Browser-Host
/// (`packages/assets/src/props.ts`): Meter, Y oben, vorn +z, Boden bei y = 0; Wurzel `<id>` (Bindestrich → `_`),
/// darunter `<id>_<material>`. Die Laufzeit-Materialien `akzent` (Slot-Farbe) und `zustand` (Spielzustand) sind weiß
/// und werden hier gefärbt wie im Browser (`tint`).
@MainActor
struct PropLibrary {
    private(set) var templates: [String: Entity] = [:]

    /// Alle Requisiten aus `<ordner>/requisiten`; fehlt der Ordner, leer (dann zeichnet Swift die Grundkörper des JS-Kerns).
    static func loadAll(folder: URL?) async -> PropLibrary {
        var library = PropLibrary()
        guard let folder else { return library }
        let dir = folder.appending(path: "requisiten")
        guard let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else {
            hostLog("FEHLER requisiten/ fehlt – Requisiten als Grundkörper")
            return library
        }
        let t0 = CACurrentMediaTime()
        for file in files.sorted(by: { $0.path < $1.path }) where file.pathExtension == "usdz" {
            let id = file.deletingPathExtension().lastPathComponent
            do {
                library.templates[id] = try await Entity(contentsOf: file)
            } catch {
                hostLog("FEHLER requisiten/\(id).usdz laden: \(error)")
            }
        }
        hostLog(String(format: "Requisiten geladen: %d in %.0f ms", library.templates.count, (CACurrentMediaTime() - t0) * 1000))
        return library
    }

    func has(_ id: String) -> Bool { templates[id] != nil }

    /// Eigener Klon der Vorlage; `nil`, wenn das Requisit fehlt.
    func instance(_ id: String) -> Entity? {
        templates[id]?.clone(recursive: true)
    }

    /// Prim-Name in USD: Bindestrich → `_` (`eichel-faul` → `eichel_faul`).
    static func primName(_ id: String) -> String { id.replacingOccurrences(of: "-", with: "_") }

    /// Färbt das Laufzeit-Material `material` (`akzent` oder `zustand`) eines Klons. `false`, wenn das Requisit das
    /// Material nicht hat.
    @discardableResult
    static func tint(_ entity: Entity, prop id: String, material: String, color hex: String) -> Bool {
        guard let part = entity.findEntity(named: "\(primName(id))_\(material)") else { return false }
        var stack = [part]
        var tinted = false
        while let current = stack.popLast() {
            stack += current.children
            guard var model = current.components[ModelComponent.self] else { continue }
            for index in model.materials.indices {
                var pbr = (model.materials[index] as? PhysicallyBasedMaterial) ?? PhysicallyBasedMaterial()
                pbr.baseColor = .init(tint: platformColor(hex))
                model.materials[index] = pbr
            }
            current.components.set(model)
            tinted = true
        }
        return tinted
    }
}
