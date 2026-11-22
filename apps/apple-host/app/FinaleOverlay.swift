import CoreGraphics
import Foundation
import QuartzCore
import SwiftUI

/// Was die Finale-Bildschirme brauchen (CHAOS-145), ohne Fortschritt und Klänge: Die Ansicht ändert sich nur, wenn sich
/// Sichtbares ändert (Abschnitt, hochgezählte Werte, Stempel), nicht mit jedem Bild.
struct FinaleScreen: Equatable {
    var beat: String
    var done: Bool
    var endedEarly: Bool
    var kicker: String
    var title: String
    var lead: String
    var cards: [RenderState.FinaleCard]
    var winner: RenderState.FinaleWinner?
    var canRematch: Bool

    init(_ f: RenderState.Final) {
        beat = f.beat
        done = f.done
        endedEarly = f.endedEarly ?? false
        kicker = f.kicker ?? "Spielende"
        title = f.title ?? ""
        lead = f.lead ?? ""
        cards = f.cards ?? []
        winner = f.winner
        canRematch = f.canRematch ?? false
    }
}

/// Trophäenzählung und Siegerbildschirm wie `Finale.tsx` im Browser-Host (`apps/host/src/finale/finale.css`):
/// Zählung als Karten über dem gedämpften Brett, danach rechts der Endstand mit Bonus-Titeln und „Nochmal spielen“,
/// links das Podest (`PodiumScene`). Gestaltet für 1920×1080.
struct FinaleOverlayView: View {
    let screen: FinaleScreen
    /// `hostCommand`: `skip-finale`, `rematch`.
    var command: (String) -> Void = { _ in }
    #if os(tvOS)
    @Namespace private var focus
    #endif

    private static let ink = MinigameOverlayView.ink
    private static let paper = MinigameOverlayView.paper
    private static let accent = MinigameOverlayView.accent
    private static let gold = Color(red: 1, green: 0xc8 / 255, blue: 0x3a / 255)

    var body: some View {
        ZStack {
            if screen.done { winnerScreen } else { tally }
        }
        .frame(width: 1920, height: 1080)
        .foregroundStyle(Self.ink)
        #if os(tvOS)
        .focusScope(focus)
        #endif
    }

    // MARK: Trophäenzählung

    private var tally: some View {
        VStack(spacing: 40) {
            VStack(spacing: 10) {
                Text(screen.kicker.uppercased()).font(.system(size: 26, weight: .black, design: .rounded)).tracking(4)
                    .foregroundStyle(Self.paper.opacity(0.85))
                Text(screen.title).font(.system(size: 92, weight: .black, design: .rounded)).foregroundStyle(.white)
                    .shadow(color: Self.ink, radius: 0, x: 0, y: 7)
                Text(screen.lead).font(.system(size: 36, weight: .heavy, design: .rounded))
                    .padding(.horizontal, 34).padding(.vertical, 12)
                    .background(panel(cornerRadius: 40))
            }
            .multilineTextAlignment(.center)
            HStack(alignment: .top, spacing: 40) {
                ForEach(screen.cards, id: \.slot) { card in tallyCard(card) }
            }
            actionButton(label: "Überspringen ›", hint: skipHint, primary: false) { command("skip-finale") }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            ZStack {
                LinearGradient(colors: [Color(red: 30 / 255, green: 39 / 255, blue: 72 / 255).opacity(0.88),
                                        Color(red: 30 / 255, green: 39 / 255, blue: 66 / 255).opacity(0.9),
                                        Color(red: 14 / 255, green: 18 / 255, blue: 30 / 255).opacity(0.94)],
                               startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color(red: 1, green: 214 / 255, blue: 150 / 255).opacity(0.3), .clear],
                               center: UnitPoint(x: 0.5, y: 0.18), startRadius: 0, endRadius: 900)
            }
        )
    }

    private func tallyCard(_ card: RenderState.FinaleCard) -> some View {
        let color = Color(platformColor(card.color ?? "#888888"))
        let revealed = card.revealed ?? false
        return VStack(spacing: 14) {
            ZStack(alignment: .bottomTrailing) {
                Portrait(character: card.character, color: color)
                    .frame(width: 170, height: 170)
                    .background(color.opacity(0.25), in: .rect(cornerRadius: 26))
                    .overlay(RoundedRectangle(cornerRadius: 26).stroke(Self.ink, lineWidth: 5))
                symbolBadge(card.symbol, color: card.color).offset(x: 14, y: 12)
            }
            .padding(.top, 34)
            Text(card.name ?? "").font(.system(size: 38, weight: .black, design: .rounded)).lineLimit(1)
            if let ai = card.ai {
                // Eine KI heißt nach ihrer Figur; statt der Figur steht ihr Abzeichen da (CHAOS-182).
                AiBadge(text: ai, size: 20)
            } else {
                Text(card.characterName ?? "").font(.system(size: 22, weight: .semibold, design: .rounded)).foregroundStyle(Self.ink.opacity(0.7))
            }
            HStack(spacing: 12) {
                Image(systemName: "trophy.fill").font(.system(size: 40, weight: .bold)).foregroundStyle(Self.gold)
                    .shadow(color: Self.ink, radius: 0, x: 2, y: 2)
                Text(revealed ? "\(card.trophies ?? 0)" : "?").font(.system(size: 62, weight: .black, design: .rounded)).monospacedDigit()
            }
            HStack(spacing: 12) {
                coin(size: 32)
                Text(revealed ? "\(card.coins ?? 0)" : "?").font(.system(size: 44, weight: .black, design: .rounded)).monospacedDigit()
            }
            .padding(.bottom, 28)
        }
        .frame(width: 360)
        .background(
            RoundedRectangle(cornerRadius: 32).fill(Self.paper)
                .overlay(alignment: .top) { UnevenRoundedRectangle(topLeadingRadius: 32, topTrailingRadius: 32).fill(color).frame(height: 22) }
                .overlay(RoundedRectangle(cornerRadius: 32).stroke(card.active == true ? color : Self.ink, lineWidth: card.active == true ? 9 : 5))
                .background(RoundedRectangle(cornerRadius: 32).fill(Self.ink).offset(y: 10))
        )
        .overlay(alignment: .topTrailing) {
            if card.placeShown == true, let place = card.place {
                VStack(spacing: 2) {
                    Text("\(place).").font(.system(size: 64, weight: .black, design: .rounded)).foregroundStyle(.white)
                        .shadow(color: Self.ink, radius: 0, x: 3, y: 4)
                    if let badge = card.badge {
                        Text(badge).font(.system(size: 18, weight: .heavy, design: .rounded))
                            .padding(.horizontal, 10).padding(.vertical, 3).background(.white, in: .capsule)
                            .overlay(Capsule().stroke(Self.ink, lineWidth: 3))
                    }
                }
                .padding(.horizontal, 18).padding(.vertical, 8)
                .background(place == 1 ? Self.gold : Self.accent, in: .rect(cornerRadius: 22))
                .overlay(RoundedRectangle(cornerRadius: 22).stroke(Self.ink, lineWidth: 5))
                .rotationEffect(.degrees(8))
                .offset(x: 26, y: -22)
            }
        }
        .scaleEffect(card.active == true ? 1.06 : 1)
        .opacity(revealed ? 1 : 0.62)
        .saturation(revealed ? 1 : 0.2)
    }

    // MARK: Siegerbildschirm

    private var winnerScreen: some View {
        let winner = screen.winner
        return ZStack(alignment: .topLeading) {
            if let early = winner?.earlyNote {
                Text(early).font(.system(size: 26, weight: .black, design: .rounded))
                    .padding(.horizontal, 22).padding(.vertical, 8)
                    .background(Color(red: 1, green: 0xe2 / 255, blue: 0xb8 / 255), in: .capsule)
                    .overlay(Capsule().stroke(Self.ink, lineWidth: 5))
                    .padding(.leading, 34).padding(.top, 28)
            }
            VStack(alignment: .leading, spacing: 16) {
                Text("ENDSTAND").font(.system(size: 24, weight: .black, design: .rounded)).tracking(4).foregroundStyle(Self.ink.opacity(0.7))
                Text(winner?.headline ?? "Spielende").font(.system(size: 56, weight: .black, design: .rounded))
                    .lineLimit(2).minimumScaleFactor(0.6)
                if let reason = winner?.reason {
                    Text(reason).font(.system(size: 23, weight: .bold, design: .rounded)).foregroundStyle(Self.ink.opacity(0.8))
                }
                VStack(spacing: 10) {
                    ForEach(winner?.ranking ?? [], id: \.slot) { rankRow($0) }
                }
                if let awards = winner?.awards, !awards.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(awards, id: \.id) { award in
                            VStack(alignment: .leading, spacing: 0) {
                                Text(award.title).font(.system(size: 24, weight: .black, design: .rounded))
                                Text("\(award.names ?? "") · \(award.detail ?? "")").font(.system(size: 20, weight: .semibold, design: .rounded))
                                    .foregroundStyle(Self.ink.opacity(0.8))
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(Self.ink, style: StrokeStyle(lineWidth: 3, dash: [9, 7])))
                }
                Spacer(minLength: 0)
                actionButton(label: "Nochmal spielen", hint: rematchHint, primary: true, enabled: screen.canRematch) { command("rematch") }
                Text("Zurück in die Lobby – Figuren und Runden bleiben.").font(.system(size: 20, weight: .semibold, design: .rounded))
                    .foregroundStyle(Self.ink.opacity(0.7)).frame(maxWidth: .infinity)
            }
            .padding(34)
            .frame(width: 600, height: 1020)
            .background(panel(cornerRadius: 40))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .padding(.trailing, 30)
        }
    }

    private func rankRow(_ row: RenderState.FinaleRank) -> some View {
        let color = Color(platformColor(row.color ?? "#888888"))
        return HStack(spacing: 14) {
            Text("\(row.place ?? 0).").font(.system(size: 38, weight: .black, design: .rounded)).frame(width: 58)
            Portrait(character: row.character, color: color).frame(width: 62, height: 62)
                .background(color.opacity(0.25), in: .rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Self.ink, lineWidth: 3))
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 8) {
                    Text("\(row.symbol ?? "") \(row.name ?? "")").font(.system(size: 28, weight: .black, design: .rounded)).lineLimit(1)
                    if let ai = row.ai { AiBadge(text: ai, size: 15) }
                }
                if let badge = row.badge {
                    Text(badge).font(.system(size: 17, weight: .heavy, design: .rounded)).foregroundStyle(Self.ink.opacity(0.75))
                }
            }
            Spacer(minLength: 4)
            Image(systemName: "trophy.fill").font(.system(size: 24, weight: .bold)).foregroundStyle(Self.gold)
            Text("\(row.trophies ?? 0)").font(.system(size: 30, weight: .black, design: .rounded)).monospacedDigit()
            coin(size: 22)
            Text("\(row.coins ?? 0)").font(.system(size: 30, weight: .black, design: .rounded)).monospacedDigit()
        }
        .padding(.horizontal, 14).padding(.vertical, 8)
        .background(row.place == 1 ? Color(red: 1, green: 0xf1 / 255, blue: 0xb8 / 255) : .white, in: .rect(cornerRadius: 18))
        .overlay(alignment: .leading) { UnevenRoundedRectangle(topLeadingRadius: 18, bottomLeadingRadius: 18).fill(color).frame(width: 10) }
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Self.ink, lineWidth: 3))
    }

    // MARK: Bausteine

    #if os(tvOS)
    private var skipHint: String { "Auswahl drücken" }
    private var rematchHint: String { "" }
    #else
    private var skipHint: String { "⏎" }
    private var rematchHint: String { "⏎" }
    #endif

    /// Knopf wie `.start-button`; macOS: Return, tvOS: Fokus und Auswahl (nicht `.disabled`, sonst kein Fokus).
    @ViewBuilder
    private func actionButton(label: String, hint: String, primary: Bool, enabled: Bool = true, action: @escaping () -> Void) -> some View {
        let content = HStack(spacing: 14) {
            Text(label).font(.system(size: primary ? 40 : 28, weight: .black, design: .rounded)).lineLimit(1).fixedSize()
            if !hint.isEmpty { Text(hint).font(.system(size: 20, weight: .bold, design: .rounded)).opacity(0.75).lineLimit(1) }
        }
        .padding(.horizontal, primary ? 46 : 28).padding(.vertical, primary ? 18 : 10)
        .frame(maxWidth: primary ? .infinity : nil)
        .foregroundStyle(primary ? .white : Self.ink)
        .background(primary ? (enabled ? Self.accent : Color.gray) : Self.paper, in: .capsule)
        .overlay(Capsule().stroke(Self.ink, lineWidth: 5))
        .opacity(enabled ? 1 : 0.6)
        #if os(macOS)
        Button { if enabled { action() } } label: { content }
            .buttonStyle(.plain).keyboardShortcut(.defaultAction)
        #else
        Button { if enabled { action() } } label: { content }
            .buttonStyle(.plain)
            .prefersDefaultFocus(true, in: focus)
        #endif
    }

    private func panel(cornerRadius: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: cornerRadius).fill(Self.paper)
            .overlay(RoundedRectangle(cornerRadius: cornerRadius).stroke(Self.ink, lineWidth: 5))
            .background(RoundedRectangle(cornerRadius: cornerRadius).fill(Self.ink).offset(y: 8))
    }

    private func coin(size: CGFloat) -> some View {
        Circle().fill(Color(red: 1, green: 0.78, blue: 0.2)).overlay(Circle().stroke(Self.ink, lineWidth: max(2, size / 10)))
            .frame(width: size, height: size)
    }

    private func symbolBadge(_ symbol: String?, color: String?) -> some View {
        Text(symbol ?? "●").font(.system(size: 26, weight: .black)).foregroundStyle(.white)
            .frame(width: 52, height: 52)
            .background(Color(platformColor(color ?? "#888888")), in: .circle)
            .overlay(Circle().stroke(Self.ink, lineWidth: 3))
    }
}

/// `--bild=<pfad>` (CHAOS-145): Bilder vom Finale und von der Pause mit Bildschirm darüber, wie `MinigameSnapshot`:
/// `<pfad>-finale-<nn>-<abschnitt>.png` (Zählung im Aufdecken, Siegerbildschirm) und `<pfad>-pause-<nn>.png`.
@MainActor
enum FinaleSnapshots {
    static func attach(loop: RenderLoop, runtime: HostRuntime) {
        guard let path = RenderSettings().screenshot else { return }
        var n = 0
        var lastKey = ""
        Task { @MainActor [weak loop, weak runtime] in
            while true {
                try? await Task.sleep(for: .milliseconds(250))
                guard let runtime else { return }
                let overlay = runtime.overlay
                var key = ""
                if overlay.pause.paused { key = "pause-\(overlay.minigame == nil ? "brett" : "minispiel")" }
                if let finale = overlay.finale { key = finale.done ? "finale-sieger" : finale.beat == "reveal" ? "finale-zaehlung" : "" }
                guard key != lastKey else { continue }
                lastKey = key
                guard !key.isEmpty else { continue }
                n += 1
                let file = "\(path)-\(key.hasPrefix("pause") ? "pause" : "finale")-\(String(format: "%02d", n))-\(key).png"
                // Zählung: Karte mitten im Hochzählen; Sieger: Podest steht und jubelt.
                let delay = key == "finale-sieger" ? 3.0 : key == "finale-zaehlung" ? 1.6 : 1.5
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    loop?.capture { image in
                        DispatchQueue.main.async {
                            let overlay = runtime.overlay
                            writePNG(compose(image, overlay: overlay) ?? image, to: file)
                        }
                    }
                }
            }
        }
    }

    /// 3D-Bild und der SwiftUI-Bildschirm darüber (wie in der App eingepasst).
    static func compose(_ image: CGImage, overlay: Overlay) -> CGImage? {
        let view = ZStack {
            if let finale = overlay.finale {
                FinaleOverlayView(screen: finale)
            } else if let screen = overlay.minigame {
                MinigameOverlayView(screen: screen, players: overlay.players)
            } else if let board = overlay.board {
                BoardHudView(board: board).foregroundStyle(.white)
            }
            PauseLayerView(pause: overlay.pause, confirming: false)
        }
        .frame(width: 1920, height: 1080)
        let renderer = ImageRenderer(content: view)
        let scale = min(CGFloat(image.width) / 1920, CGFloat(image.height) / 1080)
        renderer.scale = scale
        guard let layer = renderer.cgImage,
              let ctx = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return nil }
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let size = CGSize(width: 1920 * scale, height: 1080 * scale)
        ctx.draw(layer, in: CGRect(x: (CGFloat(image.width) - size.width) / 2, y: (CGFloat(image.height) - size.height) / 2,
                                   width: size.width, height: size.height))
        return ctx.makeImage()
    }
}
