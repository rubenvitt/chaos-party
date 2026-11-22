import SwiftUI

/// HUD der Brettphase (CHAOS-143) wie `apps/host/src/board/BoardHud.tsx`: Titel mit Runde, Einblendung, Banner
/// „… ist dran!“, Statuszeile mit Countdown, Ereignis-Ticker, Rückenwind-Karte und Spielerleiste (Münzen, Trophäen,
/// Items, am Zug, getrennt). Alle Texte kommen fertig aus dem JS-Kern (`renderState().board.hud`, `texts.ts`).
/// Gestaltet für 1920×1080 (Maße aus `apps/host/src/styles.css` × 1,5), skaliert wie die Lobby.
struct BoardOverlay: Equatable {
    var hud: RenderState.Hud
    var ticker: [RenderState.TickerEntry]
    var notice: RenderState.Notice?
}

private let ink = Color(red: 0x1b / 255, green: 0x15 / 255, blue: 0x30 / 255)

private func slotColor(_ hud: RenderState.Hud, _ slot: Int?) -> Color {
    let fallback = ["#0072B2", "#E69F00", "#009E73", "#CC79A7"]
    guard let slot else { return ink }
    let hex = hud.players?.first { $0.slot == slot }?.color ?? fallback[(slot - 1) & 3]
    return Color(platformColor(hex))
}

private func rounded(_ size: CGFloat, _ weight: Font.Weight = .heavy) -> Font {
    .system(size: size, weight: weight, design: .rounded)
}

/// Kontur wie `-webkit-text-stroke`: Text achtfach versetzt in Tinte, darüber die Füllung.
private struct Outlined: View {
    let text: String
    let size: CGFloat
    var fill: Color = .white
    var stroke: CGFloat = 3

    var body: some View {
        ZStack {
            ForEach(0..<8, id: \.self) { i in
                let a = Double(i) * .pi / 4
                Text(text).foregroundStyle(ink).offset(x: cos(a) * stroke, y: sin(a) * stroke)
            }
            Text(text).foregroundStyle(fill)
        }
        .font(rounded(size, .black))
    }
}

struct BoardHudView: View {
    let board: BoardOverlay

    private var hud: RenderState.Hud { board.hud }

    var body: some View {
        ZStack(alignment: .topLeading) {
            title.padding(.leading, 36).padding(.top, 26)
            VStack(spacing: 16) {
                if let notice = board.notice { NoticeView(notice: notice) }
                if let banner = hud.banner {
                    Outlined(text: banner, size: 66, stroke: 3)
                        .padding(.horizontal, 50).padding(.vertical, 14)
                        .background(Capsule().fill(slotColor(hud, hud.bannerSlot)))
                        .overlay(Capsule().stroke(ink, lineWidth: 7))
                        .background(Capsule().fill(ink).offset(y: 10))
                        .transition(.scale(scale: 0.7).combined(with: .opacity))
                }
                if let status = hud.status { StatusLine(hud: hud, status: status) }
                if let tailwind = hud.tailwind { TailwindCard(hud: hud, tailwind: tailwind).padding(.top, 30) }
            }
            .frame(maxWidth: 1100)
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(.top, 28)
            Ticker(hud: hud, entries: board.ticker)
                .frame(width: 520, alignment: .trailing)
                .padding(.top, 150).padding(.trailing, 30)
                .frame(maxWidth: .infinity, alignment: .topTrailing)
            HStack(alignment: .bottom, spacing: 22) {
                ForEach(hud.players ?? [], id: \.slot) { HudPlayerCard(hud: hud, player: $0) }
            }
            .padding(.bottom, 26)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .frame(width: 1920, height: 1080, alignment: .topLeading)
        .animation(.easeOut(duration: 0.25), value: board)
    }

    private var title: some View {
        VStack(alignment: .leading, spacing: 6) {
            Outlined(text: "Chaos Party", size: 52, stroke: 3)
                .shadow(color: ink, radius: 0, y: 6)
                .rotationEffect(.degrees(-2), anchor: .leading)
            Text([hud.boardName, hud.roundText].compactMap { $0 }.joined(separator: " · "))
                .font(rounded(27, .heavy)).foregroundStyle(ink.opacity(0.75)).padding(.leading, 6)
        }
    }
}

private struct PlayerDot: View {
    let color: Color
    let slot: Int
    var size: CGFloat = 36

    var body: some View {
        ZStack {
            Circle().fill(color)
            Circle().stroke(ink, lineWidth: 3)
            Text(["●", "▲", "■", "★"][(slot - 1) & 3]).font(.system(size: size * 0.5, weight: .black)).foregroundStyle(.white)
        }
        .frame(width: size, height: size)
    }
}

private struct StatusLine: View {
    let hud: RenderState.Hud
    let status: RenderState.Hud.Status

    var body: some View {
        HStack(spacing: 16) {
            PlayerDot(color: slotColor(hud, status.slot), slot: status.slot, size: 44)
            Text(status.text).font(rounded(42, .heavy))
            if let detail = status.detail { Text(detail).font(rounded(32, .bold)).foregroundStyle(ink.opacity(0.7)) }
            if let countdown = status.countdown {
                Text(countdown).font(rounded(42, .black).monospacedDigit()).foregroundStyle(Color(red: 0.84, green: 0.37, blue: 0))
            }
        }
        .foregroundStyle(ink)
        .padding(.leading, 18).padding(.trailing, 33).padding(.vertical, 14)
        .background(RoundedRectangle(cornerRadius: 33).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 33).stroke(ink, lineWidth: 6))
        .background(RoundedRectangle(cornerRadius: 33).fill(ink).offset(y: 8))
    }
}

private struct Ticker: View {
    let hud: RenderState.Hud
    let entries: [RenderState.TickerEntry]

    var body: some View {
        VStack(alignment: .trailing, spacing: 12) {
            ForEach(entries, id: \.id) { entry in
                HStack(spacing: 14) {
                    if let slot = entry.slot { PlayerDot(color: slotColor(hud, slot), slot: slot, size: 34) }
                    Text(entry.text).font(rounded(29, .heavy)).foregroundStyle(ink).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.leading, 28).padding(.trailing, 20).padding(.vertical, 11)
                .background(RoundedRectangle(cornerRadius: 24).fill(Self.background(entry.tone)))
                .overlay(alignment: .leading) {
                    UnevenRoundedRectangle(topLeadingRadius: 24, bottomLeadingRadius: 24).fill(slotColor(hud, entry.slot)).frame(width: 15)
                }
                .overlay(RoundedRectangle(cornerRadius: 24).stroke(ink, lineWidth: 4.5))
                .background(RoundedRectangle(cornerRadius: 24).fill(ink).offset(y: 6))
                .transition(.move(edge: .trailing).combined(with: .opacity))
            }
        }
    }

    static func background(_ tone: String?) -> Color {
        switch tone {
        case "good": Color(red: 0xd4 / 255, green: 0xf5 / 255, blue: 0xe6 / 255)
        case "bad": Color(red: 1, green: 0xe0 / 255, blue: 0xe0 / 255)
        case "gold": Color(red: 1, green: 0xe5 / 255, blue: 0x8a / 255)
        default: .white
        }
    }
}

private struct TailwindCard: View {
    let hud: RenderState.Hud
    let tailwind: RenderState.Hud.Tailwind

    var body: some View {
        VStack(spacing: 10) {
            Text("Aufholhilfe").font(rounded(26, .heavy)).foregroundStyle(ink.opacity(0.6)).textCase(.uppercase)
            Outlined(text: "Rückenwind!", size: 60, fill: Color(red: 0.0, green: 0.62, blue: 0.45), stroke: 2.5)
            if let lead = tailwind.lead { Text(lead).font(rounded(28, .bold)).foregroundStyle(ink.opacity(0.8)) }
            VStack(spacing: 10) {
                ForEach(tailwind.rows, id: \.slot) { row in
                    HStack(spacing: 14) {
                        PlayerDot(color: slotColor(hud, row.slot), slot: row.slot, size: 40)
                        Text(row.name).font(rounded(36, .heavy))
                        Spacer(minLength: 20)
                        CoinIcon(size: 36)
                        Text(row.amount).font(rounded(36, .black))
                    }
                    .foregroundStyle(ink)
                    .padding(.horizontal, 20).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 20).fill(slotColor(hud, row.slot).opacity(0.18)))
                }
            }
            .frame(width: 560)
        }
        .padding(30)
        .background(RoundedRectangle(cornerRadius: 36).fill(.white))
        .overlay(RoundedRectangle(cornerRadius: 36).stroke(ink, lineWidth: 6))
        .background(RoundedRectangle(cornerRadius: 36).fill(ink).offset(y: 9))
    }
}

private struct CoinIcon: View {
    let size: CGFloat
    var body: some View {
        ZStack {
            Circle().fill(Color(red: 0.98, green: 0.78, blue: 0.2))
            Circle().stroke(ink, lineWidth: size * 0.09)
            Circle().stroke(Color(red: 0.85, green: 0.6, blue: 0.1), lineWidth: size * 0.07).padding(size * 0.2)
        }
        .frame(width: size, height: size)
    }
}

private struct TrophyIcon: View {
    let size: CGFloat
    var body: some View {
        Image(systemName: "trophy.fill").resizable().scaledToFit()
            .foregroundStyle(Color(red: 0.89, green: 0.68, blue: 0.22))
            .shadow(color: ink, radius: 0, x: 1.5, y: 1.5)
            .frame(width: size, height: size)
    }
}

private struct ItemIcon: View {
    let id: String
    let size: CGFloat

    private var symbol: String {
        switch id {
        case "double-dice": "dice.fill"
        case "coin-steal": "hand.raised.fill"
        case "trap": "exclamationmark.triangle.fill"
        case "shield": "shield.fill"
        default: "questionmark.circle.fill"
        }
    }

    private var color: Color {
        switch id {
        case "double-dice": Color(red: 0.23, green: 0.48, blue: 0.84)
        case "coin-steal": Color(red: 0.78, green: 0.27, blue: 0.23)
        case "trap": Color(red: 0.4, green: 0.4, blue: 0.45)
        case "shield": Color(red: 0.0, green: 0.62, blue: 0.45)
        default: ink
        }
    }

    var body: some View {
        Image(systemName: symbol).resizable().scaledToFit().foregroundStyle(color).frame(width: size, height: size)
    }
}

private struct HudPlayerCard: View {
    let hud: RenderState.Hud
    let player: RenderState.Hud.HudPlayer

    private var active: Bool { player.active == true }
    private var connected: Bool { player.connected != false }

    var body: some View {
        let color = slotColor(hud, player.slot)
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                PlayerDot(color: color, slot: player.slot, size: 40)
                Text(player.name).font(rounded(36, .black)).lineLimit(1)
                if let ai = player.ai { AiBadge(text: ai, size: 18) }
            }
            HStack(spacing: 24) {
                HStack(spacing: 8) { TrophyIcon(size: 36); Text("\(player.trophies)").font(rounded(38, .black).monospacedDigit()) }
                HStack(spacing: 8) { CoinIcon(size: 36); Text("\(player.coins)").font(rounded(38, .black).monospacedDigit()) }
            }
            HStack(spacing: 10) {
                let items = player.items ?? []
                if items.isEmpty {
                    Text("keine Items").font(rounded(22, .bold)).foregroundStyle(ink.opacity(0.45))
                }
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(spacing: 5) {
                        ItemIcon(id: item.id, size: 28)
                        Text(item.name).font(rounded(21, .heavy)).lineLimit(1)
                    }
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Capsule().fill(ink.opacity(0.07)))
                }
            }
            if !connected { Text("⚠ getrennt").font(rounded(24, .black)).foregroundStyle(Color(red: 0.84, green: 0.37, blue: 0)) }
        }
        .foregroundStyle(ink)
        .padding(.leading, 15).padding(.trailing, 21).padding(.top, 9).padding(.bottom, 12)
        .frame(minWidth: 315, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 30).fill(connected ? (active ? Color(red: 1, green: 0.98, blue: 0.9) : .white) : Color(red: 0.9, green: 0.89, blue: 0.93)))
        .overlay(alignment: .top) {
            UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30).fill(color).frame(height: 15)
        }
        .overlay(RoundedRectangle(cornerRadius: 30).stroke(ink, style: StrokeStyle(lineWidth: 6, dash: connected ? [] : [14, 8])))
        .background(RoundedRectangle(cornerRadius: 30).fill(ink).offset(y: 8))
        .background(active ? RoundedRectangle(cornerRadius: 36).fill(color).padding(-8) : nil)
        .overlay(alignment: .top) {
            if active {
                Text("am Zug").font(rounded(22, .black)).foregroundStyle(ink)
                    .padding(.horizontal, 18).padding(.vertical, 3)
                    .background(Capsule().fill(Color(red: 1, green: 0.886, blue: 0.29)))
                    .overlay(Capsule().stroke(ink, lineWidth: 4.5))
                    .offset(y: -42)
            }
        }
        .offset(y: active ? -15 : 0)
        .saturation(connected ? 1 : 0.5)
    }
}
