import Metal
import QuartzCore
import RealityKit
#if os(macOS)
import AppKit
typealias PlatformColor = NSColor
#else
import UIKit
typealias PlatformColor = UIColor
#endif

/// Darstellung von `renderState` im `RealityRenderer` (CHAOS-142):
/// - Lobby und Brett mit echter Grafik (`BoardScene`), sobald die USDZ-Assets geladen sind; je Brett eine Kulisse
///   (CHAOS-212): Wackelwald beim Start, andere bei Bedarf (Lobby-Wahl lädt vor, Partie-Start lädt nach);
/// - Minispiele mit echter Grafik (`MinigameScene`, CHAOS-144), auch in der Pause eines Minispiels;
/// - Brett ohne Assets als Grundkörper (`Primitives`).
@MainActor
final class Stage {
    private let renderer: RealityRenderer
    private let primitives = Primitives()
    /// Standardbrett (`DEFAULT_BOARD` in game-core): wird beim Start geladen und bleibt geladen (Minispiel-Kulisse).
    static let defaultBoardId = "wackelwald"
    /// Lobby-Wahl „Zufall“ (CHAOS-197): der Server lost erst beim Start.
    private static let randomBoardChoice = "zufall"
    /// Gezeigte Kulisse; `nil`, solange die Kulisse des gespielten Bretts noch lädt oder fehlt (dann Grundkörper).
    private var board: BoardScene?
    /// Geladene Kulissen nach Brett-ID: das Standardbrett und höchstens ein weiteres (Speicher auf der Apple TV).
    private var boards: [String: BoardScene] = [:]
    /// Kulissen, die gerade laden, und solche, die im Asset-Ordner fehlen oder nicht laden (nur einmal melden).
    private var loadingBoards = Set<String>()
    private var missingBoards = Set<String>()
    private var assetRoot: URL?
    private var models: [String: FigureModel] = [:]
    private var minigame: MinigameScene?
    /// Siegerpodest (CHAOS-145), mit den Figuren der Minispiel-Bühne.
    private var podium: PodiumScene?
    /// `pause`-/`resume`-Klang (CHAOS-145).
    private let pauseSounds = BoardSounds()
    /// Klänge der Minispiele (CHAOS-190), auch ohne geladene Minispiel-Bühne.
    private let minigameSounds = MinigameSounds()
    /// Minispiel-Abschnitt gewechselt (`<runde>-<id>-<stage>`), für `--bild` (CHAOS-144).
    var onMinigameStage: ((String) -> Void)? {
        didSet { minigame?.onStage = onMinigameStage }
    }
    private(set) var phase = ""
    private var lastApply: CFTimeInterval = 0
    /// `true`, sobald das Brett geladen ist oder feststeht, dass es ohne Assets (Grundkörper) läuft.
    private(set) var loaded = false
    var onPhase: ((String) -> Void)?
    /// Neues Brett-Ereignis im Bild (CHAOS-143, `--ereignisbild`).
    var onBoardEvent: ((String) -> Void)?

    init(renderer: RealityRenderer) {
        self.renderer = renderer
        renderer.entities.append(primitives.root)
        renderer.activeCamera = primitives.camera
        renderer.cameraSettings.colorBackground = .color(CGColor(red: 0.08, green: 0.1, blue: 0.16, alpha: 1))
        // Klang-Dateien (CHAOS-223) gleich im Hintergrund dekodieren, nicht beim ersten Klang.
        SoundBank.shared.preload()
    }

    /// Lädt Figuren und Kulisse. Ohne Assets bleibt es bei Grundkörpern (Entwicklung, CI ohne `build:apple-assets`).
    func load(assets override: String?) async {
        defer { loaded = true }
        guard let folder = BoardScene.assetFolder(override: override) else {
            hostLog("FEHLER Brett-Assets fehlen (payload/szene) – Grundkörper statt echter Grafik")
            loadMinigame(models: [:])
            return
        }
        assetRoot = folder
        // Jede Figur einmal laden; Brett, Minispiel und Podest klonen daraus (CHAOS-191).
        let models = await FigureModel.loadAll(folder: folder)
        self.models = models
        if let scene = await loadBoard(Self.defaultBoardId) {
            board = scene
            primitives.boardEnabled = false
            show(board: true)
        }
        loadMinigame(models: models)
        await warmUp()
    }

    // MARK: Kulisse je Brett (CHAOS-212)

    /// Lädt die Kulisse eines Bretts (unsichtbar) und merkt sie sich; `nil`, wenn sie fehlt oder nicht lädt.
    private func loadBoard(_ id: String) async -> BoardScene? {
        if let scene = boards[id] { return scene }
        guard let root = assetRoot, let folder = BoardScene.boardFolder(in: root, id: id) else {
            if missingBoards.insert(id).inserted { hostLog("FEHLER Kulisse für Brett „\(id)“ fehlt (bretter/\(id)) – Grundkörper") }
            return nil
        }
        loadingBoards.insert(id)
        defer { loadingBoards.remove(id) }
        do {
            let scene = try await BoardScene.load(from: folder, figures: models)
            scene.onEvent = { [weak self] in self?.onBoardEvent?($0) }
            scene.root.isEnabled = false
            renderer.entities.append(scene.root)
            boards[id] = scene
            evictBoards(keeping: id)
            return scene
        } catch {
            missingBoards.insert(id)
            hostLog("FEHLER Brett „\(id)“ laden: \(error)")
            return nil
        }
    }

    /// Höchstens eine Kulisse außer dem Standardbrett im Speicher: ältere, nicht gezeigte gehen.
    private func evictBoards(keeping id: String) {
        for (key, scene) in boards where key != Self.defaultBoardId && key != id && scene !== board {
            renderer.entities.remove(scene.root)
            boards[key] = nil
            hostLog("Kulisse \(key) entladen")
        }
    }

    /// Kulisse für diesen Zustand: in der Partie die des gespielten Bretts (fehlt sie noch, `nil` = Grundkörper und
    /// nachladen), in der Lobby die des gewählten Bretts (bis sie geladen ist und bei „Zufall“ die bisherige).
    private func boardScene(for s: RenderState) -> BoardScene? {
        guard assetRoot != nil, !boards.isEmpty else { return board }
        let inGame = s.phase != "lobby" && s.board != nil
        let wanted = inGame ? (s.board?.boardId ?? Self.defaultBoardId) : s.lobby?.settings?.board
        guard let id = wanted, id != Self.randomBoardChoice else { return board }
        if let scene = boards[id] { return scene }
        if !loadingBoards.contains(id), !missingBoards.contains(id) {
            loadingBoards.insert(id)
            Task { [weak self] in
                guard let self else { return }
                self.loadingBoards.remove(id)
                _ = await self.loadBoard(id)
            }
        }
        return inGame ? nil : board
    }

    /// Wechselt die gezeigte Kulisse; die alte geht in die Übersicht (ohne Figuren, Popups, Klänge) und aus.
    private func switchBoard(to scene: BoardScene?) {
        if let old = board {
            old.showOverview(dt: 0)
            old.root.isEnabled = false
        }
        board = scene
        primitives.boardEnabled = scene == nil
        if scene == nil {
            primitives.root.isEnabled = true
            renderer.activeCamera = primitives.camera
            renderer.lighting.resource = nil
            renderer.lighting.intensityExponent = 0
            renderer.cameraSettings.colorBackground = .color(CGColor(red: 0.08, green: 0.1, blue: 0.16, alpha: 1))
        }
        hostLog("Kulisse: \(scene?.boardId ?? "Grundkörper")")
    }

    /// Minispiel-Bühne (CHAOS-144) und Podest mit den schon geladenen Figuren, damit der Wechsel Brett → Minispiel nicht ruckelt.
    private func loadMinigame(models: [String: FigureModel]) {
        let scene = MinigameScene(models: models, grass: board?.grass ?? [], sky: board?.sky, skyExponent: board?.skyExponent ?? 0,
                                  clearColor: board?.clearColor ?? CGColor(red: 0.83, green: 0.9, blue: 0.96, alpha: 1))
        scene.root.isEnabled = false
        scene.onStage = onMinigameStage
        renderer.entities.append(scene.root)
        minigame = scene
        let podium = PodiumScene(models: models)
        podium.root.isEnabled = false
        renderer.entities.append(podium.root)
        self.podium = podium
    }

    func apply(_ s: RenderState) {
        let now = CACurrentMediaTime()
        let dt = lastApply > 0 ? min(0.1, now - lastApply) : 0
        lastApply = now
        if s.phase != phase {
            phase = s.phase
            onPhase?(phase)
        }
        pauseSounds.play(s.pause?.sounds ?? [])
        minigameSounds.apply(s.phase == "minigame" || s.phase == "paused" ? s.minigame : nil)
        // Finale (CHAOS-145): Das Podest entsteht schon in der Zählung (unsichtbar), zu sehen am Siegerbildschirm.
        if s.phase == "final", let f = s.final, let podium {
            podium.apply(f, visible: f.done, dt: dt)
            if f.done {
                show(podium: podium)
                return
            }
            podium.root.isEnabled = false
        } else if let podium, s.phase != "final" {
            if podium.root.isEnabled { podium.root.isEnabled = false }
            if s.phase == "lobby" { podium.leave() }
        }
        if let m = s.minigame, s.phase == "minigame" || s.phase == "paused", let scene = minigame {
            show(minigame: scene)
            scene.apply(m, players: s.lobby?.players ?? [], dt: dt)
            return
        }
        if let scene = minigame, scene.root.isEnabled {
            scene.root.isEnabled = false
            scene.leave()
        }
        if s.phase == "minigame", s.minigame != nil {
            show(board: false)
            primitives.apply(s)
            return
        }
        let scene = boardScene(for: s)
        if scene !== board { switchBoard(to: scene) }
        if let board {
            show(board: true)
            primitives.apply(RenderState(phase: "lobby"))
            if s.phase != "lobby", let b = s.board {
                board.apply(b, players: s.lobby?.players ?? [], dt: dt)
            } else {
                board.showOverview(dt: dt)
            }
        } else {
            primitives.apply(s)
        }
    }

    private func show(minigame scene: MinigameScene) {
        board?.root.isEnabled = false
        primitives.root.isEnabled = false
        scene.root.isEnabled = true
        renderer.activeCamera = scene.camera
        // Lichtstimmung der Runde (CHAOS-193): Himmelslicht, Stärke und Dunst als Hintergrund aus `SceneLight`.
        let light = scene.sceneLight
        renderer.lighting.resource = light.environment
        renderer.lighting.intensityExponent = light.environment == nil ? 0 : light.exponent
        renderer.cameraSettings.colorBackground = .color(light.background)
    }

    private func show(podium scene: PodiumScene) {
        board?.root.isEnabled = false
        primitives.root.isEnabled = false
        minigame?.root.isEnabled = false
        scene.root.isEnabled = true
        renderer.activeCamera = scene.camera
        renderer.lighting.resource = scene.sky
        renderer.lighting.intensityExponent = scene.sky == nil ? 0 : scene.skyExponent
        renderer.cameraSettings.colorBackground = .color(scene.clearColor)
    }

    private func show(board visible: Bool) {
        guard let board else { return }
        board.root.isEnabled = visible
        primitives.root.isEnabled = !visible
        renderer.activeCamera = visible ? board.camera : primitives.camera
        // Lichtstimmung der Runde (CHAOS-193), in der Lobby das Licht des Exports.
        let light = board.sceneLight
        renderer.lighting.resource = visible ? light.environment : nil
        renderer.lighting.intensityExponent = visible ? light.exponent : 0
        renderer.cameraSettings.colorBackground = .color(visible ? light.background
            : CGColor(red: 0.08, green: 0.1, blue: 0.16, alpha: 1))
    }

    // MARK: Aufwärmen (CHAOS-192)

    /// So viele Bilder rendert das Aufwärmen (je Hälfte bei Tag und bei Nacht).
    private static let warmUpFrames = 8

    /// Beim ersten Minispiel nach dem Start erschien die Geometrie im tvOS-Simulator bis 2,2 s nach dem Aufbau
    /// (CHAOS-144): Der erste `MeshResource`-Bau und die ersten Shader der Minispiel-Materialien fielen in die Anleitung.
    /// Darum einmal nach dem Laden: Minispiel-Bühne mit allen Varianten aufbauen (`MinigameScene.prepareWarmUp`) und
    /// ein paar Bilder unsichtbar in eine kleine Textur rendern, mit demselben Renderer, Format und Kantenglätten wie
    /// die Anzeige. Die Anzeige zeigt währenddessen weiter das Brett.
    private func warmUp() async {
        guard let scene = minigame, let device = MTLCreateSystemDefaultDevice() else { return }
        let t0 = CACurrentMediaTime()
        let meshMs = await scene.prepareWarmUp()
        let desc = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: Presenter.format, width: 320, height: 180, mipmapped: false)
        desc.usage = [.renderTarget, .shaderRead]
        desc.storageMode = .private
        guard let texture = device.makeTexture(descriptor: desc),
              let output = try? RealityRenderer.CameraOutput(.singleProjection(colorTexture: texture)) else {
            scene.finishWarmUp()
            return
        }
        var frames: [String] = []
        for frame in 0..<Self.warmUpFrames {
            scene.warmUpNight(frame >= Self.warmUpFrames / 2)
            let start = CACurrentMediaTime()
            let ok = await renderOffscreen(scene, output: output)
            frames.append(ok ? String(format: "%.0f", (CACurrentMediaTime() - start) * 1000) : "–")
        }
        scene.finishWarmUp()
        hostLog(String(format: "Aufwärmen: MeshResource %.0f ms, Bilder unsichtbar [%@] ms, gesamt %.0f ms", meshMs,
                       frames.joined(separator: ", "), (CACurrentMediaTime() - t0) * 1000))
    }

    /// Ein Bild der Minispiel-Szene in `output`; danach steht alles wieder wie vorher (im selben Durchlauf des
    /// Hauptthreads, das nächste Bild der Anzeige sieht nichts davon).
    private func renderOffscreen(_ scene: MinigameScene, output: RealityRenderer.CameraOutput) async -> Bool {
        let saved = (camera: renderer.activeCamera, lighting: renderer.lighting, background: renderer.cameraSettings.colorBackground,
                     board: board?.root.isEnabled, primitives: primitives.root.isEnabled, minigame: scene.root.isEnabled)
        board?.root.isEnabled = false
        primitives.root.isEnabled = false
        scene.root.isEnabled = true
        renderer.activeCamera = scene.camera
        renderer.lighting.resource = scene.sceneLight.environment
        renderer.lighting.intensityExponent = scene.sceneLight.exponent
        renderer.cameraSettings.colorBackground = .color(scene.sceneLight.background)
        let done = await withCheckedContinuation { (continuation: CheckedContinuation<Bool, Never>) in
            do {
                try renderer.updateAndRender(deltaTime: 1.0 / 60, cameraOutput: output) { _ in continuation.resume(returning: true) }
            } catch {
                hostLog("FEHLER Aufwärmen: \(error)")
                continuation.resume(returning: false)
            }
            board?.root.isEnabled = saved.board ?? false
            primitives.root.isEnabled = saved.primitives
            scene.root.isEnabled = saved.minigame
            renderer.activeCamera = saved.camera
            renderer.lighting = saved.lighting
            renderer.cameraSettings.colorBackground = saved.background
        }
        return done
    }
}

/// Generischer Renderer aus dem Spike: Brettfelder als Scheiben, Figuren als Kugeln, Minispiel-Körper nach Form.
/// Babylon ist linkshändig, RealityKit rechtshändig: z und die x/y-Anteile der Quaternion kippen.
@MainActor
final class Primitives {
    let root = Entity()
    let camera = PerspectiveCamera()
    /// Brett als Grundkörper; aus, sobald das echte Brett geladen ist.
    var boardEnabled = true
    private var entities: [String: ModelEntity] = [:]
    private var targets: [String: SIMD3<Float>] = [:]
    private var materials: [String: SimpleMaterial] = [:]
    private var cameraKey = ""
    private let meshes: [String: MeshResource] = [
        "sphere": .generateSphere(radius: 0.5), "box": .generateBox(size: 1), "cylinder": .generateCylinder(height: 1, radius: 0.5),
    ]
    private static let slotColors = ["#3b82f6", "#ef4444", "#22c55e", "#eab308"]
    private static let kindColors = [
        "start": "#e2e8f0", "coins-plus": "#4ade80", "coins-minus": "#f87171", "event": "#a78bfa", "item": "#fbbf24", "trophy": "#f59e0b",
    ]

    init() {
        let light = DirectionalLight()
        light.light.intensity = 4000
        light.look(at: .zero, from: [4, 10, 6], relativeTo: nil)
        root.addChild(light)
        root.addChild(camera)
        camera.look(at: .zero, from: [0, 12, 12], relativeTo: nil)
    }

    func apply(_ s: RenderState) {
        var seen = Set<String>()
        func put(_ key: String, _ shape: String, _ color: String, _ pos: SIMD3<Float>, _ size: SIMD3<Float>,
                 _ rot: simd_quatf = simd_quatf(ix: 0, iy: 0, iz: 0, r: 1), animate: Bool = false) {
            seen.insert(key)
            guard let entity = entities[key] else {
                let entity = ModelEntity(mesh: meshes[shape] ?? meshes["box"]!, materials: [material(color)])
                entity.transform = Transform(scale: size, rotation: rot, translation: pos)
                root.addChild(entity)
                entities[key] = entity
                targets[key] = pos
                return
            }
            if !animate {
                entity.transform = Transform(scale: size, rotation: rot, translation: pos)
            } else if targets[key] != pos {
                targets[key] = pos
                var t = entity.transform
                t.translation = pos
                entity.move(to: t, relativeTo: root, duration: 0.35)
            }
        }

        if s.phase == "minigame", let m = s.minigame {
            for b in m.bodies ?? [] where b.pos.count == 3 {
                let r = b.rot ?? [0, 0, 0, 1], size = b.size ?? [1, 1, 1]
                put("body:\(b.id)", b.shape, b.color ?? "#cccccc", [b.pos[0], b.pos[1], -b.pos[2]],
                    size.count == 3 ? [size[0], size[1], size[2]] : [1, 1, 1],
                    r.count == 4 ? simd_quatf(ix: -r[0], iy: -r[1], iz: r[2], r: r[3]) : simd_quatf(ix: 0, iy: 0, iz: 0, r: 1))
            }
            aim("mg:\(m.id)", target: [0, 0, 0.6], from: [0, 13.5, 13.5], fov: 44.7)
        } else if boardEnabled, s.phase != "lobby", let b = s.board {
            let spaces = b.spaces ?? []
            for space in spaces {
                put("space:\(space.id)", "cylinder", Self.kindColors[space.kind ?? ""] ?? "#94a3b8", [space.x, 0, -space.z], [1.6, 0.15, 1.6])
            }
            let colors = Dictionary((s.lobby?.players ?? []).map { ($0.slot, $0.color ?? "") }, uniquingKeysWith: { a, _ in a })
            for pawn in b.pawns ?? [] {
                let color = colors[pawn.slot].flatMap { $0.isEmpty ? nil : $0 } ?? Self.slotColors[(pawn.slot - 1) & 3]
                put("pawn:\(pawn.slot)", "sphere", color, [pawn.x, 0.6, -pawn.z], [0.8, 0.8, 0.8], animate: true)
            }
            if !spaces.isEmpty {
                let xs = spaces.map(\.x), zs = spaces.map { -$0.z }
                let center: SIMD3<Float> = [(xs.min()! + xs.max()!) / 2, 0, (zs.min()! + zs.max()!) / 2]
                let extent = max(xs.max()! - xs.min()!, (zs.max()! - zs.min()!) * 1.6, 6)
                aim("board:\(spaces.count)", target: center, from: center + [0, extent * 0.85, extent * 0.55], fov: 41)
            }
        }
        for (key, entity) in entities where !seen.contains(key) {
            entity.removeFromParent()
            entities[key] = nil
            targets[key] = nil
        }
    }

    private func aim(_ key: String, target: SIMD3<Float>, from: SIMD3<Float>, fov: Float) {
        guard key != cameraKey else { return }
        cameraKey = key
        camera.camera.fieldOfViewInDegrees = fov
        camera.look(at: target, from: from, relativeTo: nil)
    }

    private func material(_ hex: String) -> SimpleMaterial {
        if let cached = materials[hex] { return cached }
        let made = SimpleMaterial(color: platformColor(hex), roughness: 0.6, isMetallic: false)
        materials[hex] = made
        return made
    }
}
