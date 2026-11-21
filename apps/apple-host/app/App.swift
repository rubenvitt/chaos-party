import Combine
import CoreImage.CIFilterBuiltins
import ImageIO
import RealityKit
import SwiftUI

// ADR-019: Mac oder Apple TV hosten die Partie allein; iPhones/iPads bleiben Controller (CHAOS-138, CHAOS-139).
@main
@MainActor
enum Main {
    static func main() {
        #if os(macOS)
        // CHAOS-118: checks the built (signed, hardened) app without a window, see SelfTest.swift.
        if CommandLine.arguments.contains("--selftest") { SelfTest.run() }
        #endif
        ChaosHostApp.main()
    }
}

struct ChaosHostApp: App {
    @StateObject private var runtime = HostRuntime()
    /// Pause über Tastatur bzw. Fernbedienung (CHAOS-145).
    @StateObject private var pause = PauseControl()
    @Environment(\.scenePhase) private var scenePhase
    #if os(macOS) && !APP_STORE
    @StateObject private var updates = Updates()
    #endif

    var body: some SwiftUI.Scene {
        WindowGroup("Chaos Party") {
            ZStack(alignment: .topLeading) {
                StageView(runtime: runtime).ignoresSafeArea()
                OverlayView(overlay: runtime.overlay, start: { runtime.command("start") }, command: runtime.command, pause: pause)
            }
            #if os(tvOS)
            // Play/Pause und Menü (CHAOS-145); Menü nur in der Partie, in der Lobby führt es zum Home-Bildschirm.
            .onPlayPauseCommand { pause.toggle() }
            .onExitCommand(perform: runtime.overlay.pause.paused || runtime.overlay.pause.canPause ? { pause.escape() } : nil)
            #endif
            #if os(macOS)
            .frame(minWidth: 960, minHeight: 540)
            #endif
            .onAppear {
                #if os(tvOS)
                // Input comes from phones, not the remote: without this tvOS sleeps mid-game and the listener dies.
                UIApplication.shared.isIdleTimerDisabled = true
                #endif
                runtime.start()
                pause.runtime = runtime
                LaunchProbes.attach(runtime: runtime)
                #if os(macOS)
                pause.installKeys()
                LobbySnapshot.schedule(runtime: runtime)
                SessionActivity.minimizeIfRequested()
                #endif
            }
            #if os(tvOS)
            // Hintergrund und zurück (CHAOS-145): Partie pausieren, Kern ruhen lassen, Listener prüfen.
            .onChange(of: scenePhase) { _, phase in
                switch phase {
                case .background:
                    let task = UIApplication.shared.beginBackgroundTask(withName: "pause")
                    runtime.enterBackground { UIApplication.shared.endBackgroundTask(task) }
                case .active: runtime.enterForeground()
                default: break
                }
            }
            #endif
        }
        #if os(macOS) && !APP_STORE
        .commands {
            // CHAOS-156: Sparkle prüft ohnehin täglich; der Menüpunkt prüft sofort.
            CommandGroup(after: .appInfo) {
                Button("Nach Updates suchen …") { updates.check() }.disabled(!updates.canCheck)
            }
        }
        #endif
    }
}

struct OverlayView: View {
    let overlay: Overlay
    let start: () -> Void
    /// `hostCommand` für die Lobby-Einstellungen (`configure:…`, CHAOS-166).
    var command: (String) -> Void = { _ in }
    /// Pause-Bedienung (CHAOS-145); `nil` in Tests und Bildern.
    var pause: PauseControl?

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            content
            // Pause über allem, auch über dem Minispiel (CHAOS-145).
            if overlay.pause.paused || overlay.pause.canPause {
                GeometryReader { geo in
                    Group {
                        if let pause { PauseLayerContainer(pause: overlay.pause, control: pause) } else {
                            PauseLayerView(pause: overlay.pause, confirming: false)
                        }
                    }
                    .scaleEffect(min(geo.size.width / 1920, geo.size.height / 1080))
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            }
        }
        .foregroundStyle(.white)
    }

    @ViewBuilder private var content: some View {
        ZStack(alignment: .bottomLeading) {
            if overlay.phase == "lobby" || overlay.phase == "start" {
                // Gestaltet für 1920×1080, skaliert auf jede Fenstergröße (Mac) bzw. 4K (Apple TV).
                GeometryReader { geo in
                    let scale = min(geo.size.width / 1920, geo.size.height / 1080)
                    LobbyView(overlay: overlay, start: start, command: command)
                        .frame(width: 1920, height: 1080)
                        .scaleEffect(scale)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            } else if let screen = overlay.minigame {
                // Anleitung, Countdown, HUD und Ergebnis (CHAOS-144), gestaltet für 1920×1080.
                GeometryReader { geo in
                    MinigameOverlayView(screen: screen, players: overlay.players)
                        .scaleEffect(min(geo.size.width / 1920, geo.size.height / 1080))
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            } else if let finale = overlay.finale {
                // Trophäenzählung und Siegerbildschirm (CHAOS-145), gestaltet für 1920×1080.
                GeometryReader { geo in
                    FinaleOverlayView(screen: finale, command: command)
                        .scaleEffect(min(geo.size.width / 1920, geo.size.height / 1080))
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            } else if let board = overlay.board {
                // HUD der Brettphase (CHAOS-143), gestaltet für 1920×1080 wie die Lobby.
                GeometryReader { geo in
                    let scale = min(geo.size.width / 1920, geo.size.height / 1080)
                    BoardHudView(board: board)
                        .scaleEffect(scale)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(overlay.lines.enumerated()), id: \.offset) { Text($0.element) }
                }
                .font(.title3).padding(12).background(.black.opacity(0.55), in: .rect(cornerRadius: 12)).padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                // Sabotage-Ansage oben mittig über dem Brett (CHAOS-157).
                if let notice = overlay.notice {
                    NoticeView(notice: notice).padding(.top, 28)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
            Text(overlay.stats).font(.caption.monospaced()).padding(8).foregroundStyle(.white.opacity(0.8))
        }
        .foregroundStyle(.white)
    }
}

/// Lobby wie im Babylon-Host (`apps/host/src/lobby/LobbyPanel.tsx`): QR-Code, Join-Code und Link, je Spieler eine
/// Karte mit Porträt der Figur, Slot-Farbe und Status; Start über Return (Mac) bzw. die Fernbedienung (tvOS).
struct LobbyView: View {
    let overlay: Overlay
    let start: () -> Void
    /// `hostCommand` für Rundenwahl und Schalter (`LobbySettingsView`, CHAOS-166) und Brett (`BoardChoiceView`, CHAOS-197).
    var command: (String) -> Void = { _ in }
    /// Minispiel-Galerie offen (CHAOS-220); sie ersetzt die Lobby, damit der Fokus (tvOS) nicht dahinter landet.
    @State private var galleryOpen = false
    #if os(tvOS)
    @Namespace private var focus
    #endif

    private var players: [RenderState.Player] { overlay.players.sorted { $0.slot < $1.slot } }
    private var canStart: Bool { overlay.sceneLoaded && !players.isEmpty && players.allSatisfy { $0.ready == true } }
    /// Üben wie im Babylon-Host: ab einem verbundenen Controller, bereit muss niemand sein (CHAOS-220).
    private var canPractice: Bool { overlay.sceneLoaded && players.contains { $0.connected != false } }
    private var hint: String {
        if !overlay.sceneLoaded { return overlay.status.hasPrefix("Fehler") ? overlay.status : "Brett lädt …" }
        if players.isEmpty { return "Warte auf Spieler …" }
        let waiting = players.filter { $0.ready != true }.count
        return waiting == 0 ? "Alle bereit!" : waiting == 1 ? "Ein Spieler ist noch nicht bereit" : "\(waiting) Spieler sind noch nicht bereit"
    }

    var body: some View {
        if galleryOpen {
            MinigameGalleryView(rows: overlay.gallery, votes: overlay.galleryVotes, canPractice: canPractice,
                                exportURL: overlay.ratingsExport,
                                practice: { command("practice:\($0)") }, close: { galleryOpen = false })
        } else {
            lobby
        }
    }

    private var lobby: some View {
        // Mit dem Galerie-Knopf (CHAOS-220) wird der QR-Code etwas kleiner, damit die linke Spalte in 1080 passt.
        let qrSize: CGFloat = overlay.gallery.isEmpty ? 400 : 360
        return HStack(alignment: .top, spacing: 56) {
            VStack(spacing: overlay.gallery.isEmpty ? 22 : 18) {
                Text("Mitspielen!").font(.system(size: 52, weight: .heavy, design: .rounded))
                Text("Handy-Kamera auf den Code – gleiches WLAN wie dieses Gerät.")
                    .font(.system(size: 22, weight: .medium, design: .rounded)).multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.85))
                if let qr = qrImage(overlay.joinUrl) {
                    Image(decorative: qr, scale: 1).interpolation(.none).resizable()
                        .frame(width: qrSize, height: qrSize).padding(20).background(.white, in: .rect(cornerRadius: 24))
                } else {
                    RoundedRectangle(cornerRadius: 24).fill(.white.opacity(0.15)).frame(width: qrSize + 40, height: qrSize + 40)
                        .overlay { Text(overlay.status).font(.title2) }
                }
                VStack(spacing: 2) {
                    Text("Join-Code").font(.system(size: 22, weight: .semibold, design: .rounded)).foregroundStyle(.white.opacity(0.75))
                    Text(overlay.joinCode.isEmpty ? "––––" : overlay.joinCode)
                        .font(.system(size: 76, weight: .black, design: .monospaced)).tracking(10)
                }
                Text(overlay.joinUrl).font(.system(size: 20, design: .monospaced)).foregroundStyle(.white.opacity(0.75))
                // Galerie mit Übungsrunde und Daumen (CHAOS-220), wie der Galerie-Knopf am PC in der linken Spalte.
                if !overlay.gallery.isEmpty {
                    GalleryButton(count: overlay.gallery.count) { galleryOpen = true }
                }
            }
            .padding(44)
            .frame(width: 620)
            .background(.black.opacity(0.62), in: .rect(cornerRadius: 36))

            VStack(alignment: .leading, spacing: 28) {
                HStack(alignment: .center, spacing: 28) {
                    Text("Chaos Party").font(.system(size: 84, weight: .black, design: .rounded))
                        .shadow(color: .black.opacity(0.5), radius: 10, y: 4)
                    Spacer(minLength: 0)
                    BoardChoiceView(settings: overlay.settings, command: command)
                }
                .frame(width: 1068)
                LazyVGrid(columns: [GridItem(.fixed(520), spacing: 28), GridItem(.fixed(520))], spacing: 28) {
                    ForEach(1...4, id: \.self) { slot in
                        PlayerCard(slot: slot, player: players.first { $0.slot == slot })
                    }
                }
                LobbySettingsView(settings: overlay.settings, playerCount: players.count, command: command)
                HStack(spacing: 28) {
                    startButton
                    Text(hint).font(.system(size: 28, weight: .semibold, design: .rounded))
                        .shadow(color: .black.opacity(0.6), radius: 6)
                }
            }
        }
        .padding(.horizontal, 80)
        .padding(.vertical, 70)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(LinearGradient(colors: [.black.opacity(0.45), .black.opacity(0.05)], startPoint: .leading, endPoint: .trailing))
        #if os(tvOS)
        .focusScope(focus)
        #endif
    }

    @ViewBuilder private var startButton: some View {
        #if os(macOS)
        Button(action: start) {
            Text("Partie starten  ⏎").font(.system(size: 34, weight: .heavy, design: .rounded))
                .padding(.horizontal, 40).padding(.vertical, 18)
                .background(canStart ? Color.orange : Color.gray.opacity(0.6), in: .capsule)
        }
        .buttonStyle(.plain).keyboardShortcut(.defaultAction).disabled(!canStart)
        #else
        // tvOS: nicht `.disabled`, sonst bekommt der Knopf keinen Fokus und die Fernbedienung erreicht ihn nie.
        Button { if canStart { start() } } label: {
            Text("Partie starten").font(.system(size: 34, weight: .heavy, design: .rounded)).padding(.horizontal, 24)
                .opacity(canStart ? 1 : 0.45)
        }
        .prefersDefaultFocus(true, in: focus)
        #endif
    }

    private func qrImage(_ text: String) -> CGImage? {
        guard !text.isEmpty else { return nil }
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "M"
        guard let image = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)) else { return nil }
        return CIContext().createCGImage(image, from: image.extent)
    }
}

/// Spielerkarte: Porträt der Figur mit Akzent in Slot-Farbe, Name, Figur, verbunden/bereit.
struct PlayerCard: View {
    let slot: Int
    let player: RenderState.Player?

    private static let names = ["robot": "Schraubi", "cactus": "Kalle Kaktus", "raccoon": "Wusel", "sock": "Socke Sigi"]
    private static let fallbackColors = ["#0072B2", "#D55E00", "#009E73", "#CC79A7"]

    var body: some View {
        let color = Color(platformColor(player?.color ?? Self.fallbackColors[(slot - 1) & 3]))
        HStack(spacing: 22) {
            Portrait(character: player?.character, color: color)
                .frame(width: 150, height: 150)
                .background(color.opacity(0.25), in: .rect(cornerRadius: 22))
                .opacity(player?.character == nil ? 0.35 : 1)
            VStack(alignment: .leading, spacing: 8) {
                if let player {
                    Text(player.name ?? "Spieler \(slot)").font(.system(size: 38, weight: .heavy, design: .rounded)).lineLimit(1)
                    Text(player.character.flatMap { Self.names[$0] } ?? "wählt noch …")
                        .font(.system(size: 24, weight: .medium, design: .rounded)).foregroundStyle(.white.opacity(0.8))
                    HStack(spacing: 10) {
                        if player.connected == false { chip("getrennt", .red) }
                        chip(player.ready == true ? "bereit ✓" : "nicht bereit", player.ready == true ? .green : .white.opacity(0.35))
                    }
                } else {
                    Text("Platz \(slot) frei").font(.system(size: 32, weight: .bold, design: .rounded)).foregroundStyle(.white.opacity(0.6))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(width: 520, height: 190)
        .background(.black.opacity(player == nil ? 0.35 : 0.62), in: .rect(cornerRadius: 28))
        .overlay {
            RoundedRectangle(cornerRadius: 28)
                .strokeBorder(player == nil ? Color.white.opacity(0.3) : color, style: StrokeStyle(lineWidth: player == nil ? 3 : 6, dash: player == nil ? [12, 10] : []))
        }
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).font(.system(size: 22, weight: .bold, design: .rounded))
            .padding(.horizontal, 14).padding(.vertical, 6).background(color, in: .capsule)
    }
}

/// Porträt aus `payload/portraits` (CHAOS-36): weißer Akzent, eingefärbt über die Maske `<id>-akzent`.
struct Portrait: View {
    let character: String?
    let color: Color

    var body: some View {
        if let character, let image = Self.image("\(character)") {
            ZStack {
                Image(decorative: image, scale: 1).resizable().scaledToFit()
                if let mask = Self.image("\(character)-akzent") {
                    color.mask { Image(decorative: mask, scale: 1).resizable().scaledToFit() }.blendMode(.multiply)
                }
            }
        } else {
            Image(systemName: "person.fill").resizable().scaledToFit().padding(36).foregroundStyle(.white.opacity(0.6))
        }
    }

    @MainActor private static var cache: [String: CGImage] = [:]

    @MainActor static func image(_ name: String) -> CGImage? {
        if let cached = cache[name] { return cached }
        guard let url = Bundle.main.url(forResource: "payload", withExtension: nil)?.appending(path: "portraits/\(name).webp"),
              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        cache[name] = image
        return image
    }
}

/// Big banner like `.board-notice` in the PC host (apps/host/src/styles.css), CHAOS-157.
struct NoticeView: View {
    let notice: RenderState.Notice
    private static let ink = Color(red: 0x1b / 255, green: 0x15 / 255, blue: 0x30 / 255)

    var body: some View {
        VStack(spacing: 4) {
            Text(notice.title).font(.system(size: 40, weight: .black)).foregroundStyle(Color(red: 0xe8 / 255, green: 0x45 / 255, blue: 0x4a / 255))
                .shadow(color: Self.ink, radius: 0, x: 2, y: 2)
            if let detail = notice.detail, !detail.isEmpty {
                Text(detail).font(.system(size: 24, weight: .heavy).monospacedDigit()).foregroundStyle(Self.ink)
            }
        }
        .multilineTextAlignment(.center)
        .padding(.horizontal, 28).padding(.top, 10).padding(.bottom, 12)
        .background(RoundedRectangle(cornerRadius: 28).fill(Color(red: 1, green: 0xe6 / 255, blue: 0xe6 / 255)))
        .overlay(RoundedRectangle(cornerRadius: 28).stroke(Self.ink, lineWidth: 5))
        .background(RoundedRectangle(cornerRadius: 28).fill(Self.ink).offset(y: 7))
        .transition(.scale(scale: 0.8).combined(with: .opacity))
    }
}

#if os(macOS)
struct StageView: NSViewRepresentable {
    let runtime: HostRuntime
    func makeNSView(context: Context) -> MetalLayerView { makeView(context.coordinator) }
    func updateNSView(_ view: MetalLayerView, context: Context) {}
}
#else
struct StageView: UIViewRepresentable {
    let runtime: HostRuntime
    func makeUIView(context: Context) -> MetalLayerView { makeView(context.coordinator) }
    func updateUIView(_ view: MetalLayerView, context: Context) {}
}
#endif

extension StageView {
    @MainActor final class Coordinator {
        var stage: Stage?
        var loop: RenderLoop?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    /// `RealityRenderer` hinter einer eigenen Metal-Ebene (CHAOS-114); die Anzeige taktet JS-Tick und Darstellung.
    @MainActor func makeView(_ coordinator: Coordinator) -> MetalLayerView {
        let view = MetalLayerView(frame: .zero)
        let settings = RenderSettings()
        do {
            let loop = try RenderLoop(view: view, settings: settings) { [runtime, weak coordinator] dt in
                guard let stage = coordinator?.stage else { return }
                runtime.frame(dtMs: dt * 1000) { stage.apply($0) }
            }
            loop.onPresented = { [runtime] ms in runtime.presented(ms: ms) }
            let stage = Stage(renderer: loop.renderer)
            if let path = settings.screenshot {
                stage.onPhase = { [weak loop] phase in
                    // Kurz warten, bis Figuren stehen und die Kamera nachgezogen hat.
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { loop?.capture(to: "\(path)-\(phase).png") }
                }
            }
            if let path = settings.screenshot {
                stage.onMinigameStage = { [weak loop, runtime] key in
                    MinigameSnapshot.schedule(stage: key, path: path, loop: loop, runtime: runtime)
                }
            }
            if let path = settings.screenshot, let every = settings.screenshotEvery {
                var n = 0
                Timer.scheduledTimer(withTimeInterval: every, repeats: true) { [weak loop] _ in
                    n += 1
                    MainActor.assumeIsolated { loop?.capture(to: "\(path)-\(String(format: "%03d", n)).png") }
                }
            }
            coordinator.loop = loop
            coordinator.stage = stage
            EventSnapshots.attach(stage: stage, loop: loop, runtime: runtime)
            FinaleSnapshots.attach(loop: loop, runtime: runtime)
            Task { @MainActor in
                await stage.load(assets: settings.assets)
                runtime.sceneReady()
            }
        } catch {
            hostLog("FEHLER Renderer: \(error)")
        }
        #if os(macOS)
        NSApplication.shared.activate()
        #endif
        return view
    }
}

#if os(macOS)
/// `--lobbybild=<pfad>`: rendert die Lobby (SwiftUI) über dem Brettbild `--bild=<pfad>-lobby.png` als PNG,
/// 20 s nach dem Start (Sichtprüfung ohne Bildschirmaufnahme-Recht, CHAOS-142).
@MainActor
enum LobbySnapshot {
    static func schedule(runtime: HostRuntime) {
        let args = RenderSettings()
        guard let path = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("--lobbybild=") })?.dropFirst(12) else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) {
            let background = args.screenshot.flatMap { NSImage(contentsOfFile: "\($0)-lobby.png") }
            let view = ZStack {
                if let background { Image(nsImage: background).resizable() } else { Color.gray }
                LobbyView(overlay: runtime.overlay, start: {})
            }
            .frame(width: 1920, height: 1080).foregroundStyle(.white)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 1
            guard let image = renderer.cgImage,
                  let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: String(path)) as CFURL, "public.png" as CFString, 1, nil)
            else { return hostLog("FEHLER Lobbybild") }
            CGImageDestinationAddImage(dest, image, nil)
            if CGImageDestinationFinalize(dest) { hostLog("Lobbybild gespeichert: \(path)") }
        }
    }
}
#endif
