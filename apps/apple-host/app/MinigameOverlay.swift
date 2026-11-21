import Foundation
import ImageIO
import SwiftUI

/// Was die Minispiel-Bildschirme brauchen (CHAOS-144), ohne Körper und Geometrie: Die Ansicht soll sich nur ändern,
/// wenn sich etwas Sichtbares ändert (Sekunden, Punkte, Abschnitt), nicht mit jedem Bild.
struct MinigameScreen: Equatable {
    var id: String
    var stage: String
    var ready: Bool
    var info: RenderState.Info
    var round: Int
    var isRepeat: Bool
    var countdown: Int?
    /// CHAOS-214: Anleitung wartet auf „Bereit“; nil = fester Countdown.
    var readiness: RenderState.Readiness?
    /// CHAOS-230: Team-Aufstellung bei Teams bzw. Koop; nil = jeder gegen jeden.
    var teams: RenderState.Teams?
    var scoreboard: RenderState.Scoreboard?
    var results: RenderState.Results?

    init(_ m: RenderState.Minigame) {
        id = m.id
        stage = m.stage ?? "intro"
        ready = m.ready ?? false
        info = m.info ?? RenderState.Info(title: m.id)
        round = m.round ?? 0
        isRepeat = m.repeat ?? false
        countdown = m.countdown
        readiness = m.readiness
        teams = m.teams
        scoreboard = m.scoreboard
        results = m.results
    }
}

/// Anleitung, Countdown, Spiel-HUD und Ergebnis wie `MinigameScreen` im Browser-Host
/// (`apps/host/src/minigame/MinigameScreen.tsx`). Gestaltet für 1920×1080, skaliert auf jede Anzeige.
struct MinigameOverlayView: View {
    let screen: MinigameScreen
    let players: [RenderState.Player]

    static let ink = Color(red: 0x1b / 255, green: 0x15 / 255, blue: 0x30 / 255)
    static let paper = Color(red: 1, green: 0xf8 / 255, blue: 0xec / 255)
    static let accent = Color(red: 0xff / 255, green: 0x7a / 255, blue: 0x3d / 255)
    private static let names = ["robot": "Schraubi", "cactus": "Kalle Kaktus", "raccoon": "Wusel", "sock": "Socke Sigi"]
    private static let symbols = ["●", "▲", "■", "★"]

    var body: some View {
        ZStack {
            switch screen.stage {
            case "play": playHud
            case "results": resultsCard
            default: introCard
            }
        }
        .frame(width: 1920, height: 1080)
        .foregroundStyle(Self.ink)
    }

    // MARK: Anleitung

    private var introCard: some View {
        card(width: 1180) {
            HStack(alignment: .center) {
                Text("Minispiel · Runde \(screen.round)\(screen.isRepeat ? " · Nochmal!" : "")")
                    .font(.system(size: 28, weight: .bold, design: .rounded)).foregroundStyle(Self.ink.opacity(0.7))
                Spacer()
                if let seconds = screen.countdown {
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("Los in").font(.system(size: 26, weight: .bold, design: .rounded))
                        Text("\(seconds)").font(.system(size: 54, weight: .black, design: .rounded)).monospacedDigit()
                    }
                    .padding(.horizontal, 24).padding(.vertical, 4)
                    .background(Self.accent, in: .capsule).foregroundStyle(.white)
                }
            }
            Text(screen.info.title).font(.system(size: 76, weight: .black, design: .rounded))
            if let teams = screen.teams {
                teamLineup(teams)
            }
            if !screen.isRepeat {
                if let tagline = screen.info.tagline, !tagline.isEmpty {
                    Text(tagline).font(.system(size: 32, weight: .semibold, design: .rounded)).foregroundStyle(Self.ink.opacity(0.8))
                }
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array((screen.info.instructions ?? []).enumerated()), id: \.offset) { index, line in
                        HStack(alignment: .firstTextBaseline, spacing: 14) {
                            Text("\(index + 1).").font(.system(size: 28, weight: .black, design: .rounded)).foregroundStyle(Self.accent)
                            Text(line).font(.system(size: 28, weight: .medium, design: .rounded))
                        }
                    }
                }
            }
            controls
            if let readiness = screen.readiness {
                readinessRow(readiness)
            } else {
                roster
            }
        }
    }

    /// Mitspieler ohne Bereitschaft (feste Anleitungszeit).
    private var roster: some View {
        HStack(spacing: 18) {
            ForEach(players.sorted { $0.slot < $1.slot }, id: \.slot) { player in
                HStack(spacing: 12) {
                    badge(slot: player.slot, color: player.color)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(player.name ?? "Spieler \(player.slot)").font(.system(size: 26, weight: .heavy, design: .rounded))
                        Text(player.character.flatMap { Self.names[$0] } ?? "").font(.system(size: 20, weight: .medium, design: .rounded))
                            .foregroundStyle(Self.ink.opacity(0.7))
                    }
                }
                .padding(.horizontal, 16).padding(.vertical, 8)
                .background(Color(platformColor(player.color ?? "#cccccc")).opacity(0.18), in: .rect(cornerRadius: 18))
            }
        }
    }

    /// Team-Ansage (CHAOS-230) wie `TeamLineupRow` im Browser-Host: Überschrift („2 gegen 2“), je Gruppe Symbol
    /// (☀/☾/♥), Name und Mitglieder mit Slot-Abzeichen, darunter der Hinweis (Vorteil der Einzelperson zu dritt).
    private func teamLineup(_ teams: RenderState.Teams) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(teams.headline ?? "Teams").font(.system(size: 34, weight: .black, design: .rounded))
            HStack(alignment: .top, spacing: 18) {
                ForEach(Array((teams.groups ?? []).enumerated()), id: \.offset) { _, group in
                    teamGroup(group)
                }
            }
            if let note = teams.note, !note.isEmpty {
                Text(note).font(.system(size: 24, weight: .semibold, design: .rounded)).foregroundStyle(Self.ink.opacity(0.8))
            }
        }
    }

    private func teamGroup(_ group: RenderState.TeamGroup) -> some View {
        let color = Color(platformColor(group.color ?? "#888888"))
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Text(group.symbol ?? "").font(.system(size: 32, weight: .black)).foregroundStyle(.white)
                    .frame(width: 52, height: 52)
                    .background(color, in: .circle)
                    .overlay(Circle().stroke(Self.ink, lineWidth: 3))
                Text(group.label ?? "").font(.system(size: 30, weight: .black, design: .rounded)).lineLimit(1)
            }
            HStack(spacing: 10) {
                ForEach(group.members ?? [], id: \.slot) { member in
                    HStack(spacing: 8) {
                        badge(slot: member.slot, color: member.color, symbol: member.symbol, size: 38)
                        Text(member.name ?? "Spieler \(member.slot)").font(.system(size: 24, weight: .heavy, design: .rounded))
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(color.opacity(0.16), in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(color, lineWidth: 4))
    }

    /// Kurze Aufstellung unter der Team-Überschrift im Ergebnis (CHAOS-230): „☀ Team Sonne: Anna, Cleo“.
    private func teamSummary(_ teams: RenderState.Teams) -> some View {
        HStack(spacing: 26) {
            ForEach(Array((teams.groups ?? []).enumerated()), id: \.offset) { _, group in
                HStack(spacing: 10) {
                    Text(group.symbol ?? "").font(.system(size: 24, weight: .black)).foregroundStyle(.white)
                        .frame(width: 40, height: 40)
                        .background(Color(platformColor(group.color ?? "#888888")), in: .circle)
                        .overlay(Circle().stroke(Self.ink, lineWidth: 3))
                    Text("\(group.label ?? ""): \((group.members ?? []).compactMap(\.name).joined(separator: ", "))")
                        .font(.system(size: 24, weight: .bold, design: .rounded)).lineLimit(1)
                }
            }
        }
    }

    private static let readyGreen = Color(red: 0x1f / 255, green: 0x9d / 255, blue: 0x55 / 255)

    /// Bereitschaft (CHAOS-214) wie `ReadinessRow` im Browser-Host: Überschrift mit Zähler, je Spieler ein Chip mit
    /// Häkchen + „Bereit“, „Drückt Bereit …“ oder „getrennt“. Kein Countdown (die Sicherheitsfrist ist keiner).
    private func readinessRow(_ readiness: RenderState.Readiness) -> some View {
        let list = (readiness.players ?? []).sorted { $0.slot < $1.slot }
        let done = list.filter { $0.state != "waiting" }.count
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                Text(readiness.headline ?? "Alle bereit?").font(.system(size: 30, weight: .black, design: .rounded))
                Text("\(done)/\(list.count)").font(.system(size: 24, weight: .black, design: .rounded)).monospacedDigit()
                    .padding(.horizontal, 12).padding(.vertical, 2)
                    .background(Color(red: 1, green: 0xd2 / 255, blue: 0x3f / 255), in: .rect(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Self.ink, lineWidth: 3))
            }
            HStack(spacing: 14) {
                ForEach(list, id: \.slot) { player in
                    readyChip(player)
                }
            }
        }
    }

    private func readyChip(_ player: RenderState.ReadyPlayer) -> some View {
        let state = player.state ?? (player.connected == false ? "disconnected" : player.ready == true ? "ready" : "waiting")
        let isReady = state == "ready"
        let mark = isReady ? "✓ " : state == "disconnected" ? "⚠ " : ""
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                badge(slot: player.slot, color: player.color, symbol: player.symbol)
                VStack(alignment: .leading, spacing: 0) {
                    Text(player.name ?? "Spieler \(player.slot)").font(.system(size: 24, weight: .heavy, design: .rounded)).lineLimit(1)
                    Text(player.character ?? "").font(.system(size: 18, weight: .medium, design: .rounded))
                        .foregroundStyle(Self.ink.opacity(0.7))
                }
            }
            Text(mark + (player.text ?? "")).font(.system(size: 20, weight: .black, design: .rounded))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(isReady ? Self.readyGreen : Self.ink.opacity(0.08), in: .rect(cornerRadius: 12))
                .foregroundStyle(isReady ? Color.white : Self.ink)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(width: 252, alignment: .leading)
        .background(isReady ? Self.readyGreen.opacity(0.12) : Color.white, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20)
            .stroke(isReady ? Self.readyGreen : Color(platformColor(player.color ?? "#888888")), lineWidth: 4))
        .opacity(state == "disconnected" ? 0.6 : 1)
    }

    private var controls: some View {
        let c = screen.info.controls
        return HStack(spacing: 26) {
            if let joystick = c?.joystick { control(icon: "◎", label: "Joystick", text: joystick) }
            if let a = c?.a { control(icon: "A", label: "Knopf A", text: a) }
            if let b = c?.b { control(icon: "B", label: "Knopf B", text: b) }
        }
    }

    private func control(icon: String, label: String, text: String) -> some View {
        HStack(spacing: 14) {
            Text(icon).font(.system(size: 30, weight: .black, design: .rounded)).foregroundStyle(.white)
                .frame(width: 58, height: 58).background(Self.ink, in: .circle)
            VStack(alignment: .leading, spacing: 0) {
                Text(label).font(.system(size: 22, weight: .heavy, design: .rounded))
                Text(text).font(.system(size: 24, weight: .medium, design: .rounded))
            }
        }
        .padding(.trailing, 10)
    }

    // MARK: Spiel

    private var playHud: some View {
        VStack(spacing: 14) {
            VStack(spacing: 0) {
                Text(screen.info.title).font(.system(size: 26, weight: .heavy, design: .rounded))
                let seconds = screen.scoreboard?.seconds ?? 0
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(seconds)").font(.system(size: 72, weight: .black, design: .rounded)).monospacedDigit()
                    Text("s").font(.system(size: 30, weight: .heavy, design: .rounded))
                }
                .foregroundStyle(seconds <= 3 ? Color.red : Self.ink)
            }
            .padding(.horizontal, 40).padding(.vertical, 10)
            .background(panel(cornerRadius: 30))
            if let banner = screen.scoreboard?.banner, !banner.isEmpty {
                Text(banner).font(.system(size: 40, weight: .black, design: .rounded))
                    .padding(.horizontal, 30).padding(.vertical, 10).background(Self.accent, in: .capsule).foregroundStyle(.white)
            }
            if screen.scoreboard?.waiting == true {
                Text("Gleich vorbei – der Server wertet aus …").font(.system(size: 30, weight: .bold, design: .rounded))
                    .padding(.horizontal, 26).padding(.vertical, 10).background(panel(cornerRadius: 24))
            }
            Spacer()
            HStack(spacing: 22) {
                ForEach(screen.scoreboard?.scores ?? [], id: \.slot) { score in
                    HStack(spacing: 14) {
                        badge(slot: score.slot, color: score.color, symbol: score.symbol)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(score.name ?? "").font(.system(size: 26, weight: .heavy, design: .rounded)).lineLimit(1)
                            Text(score.character ?? "").font(.system(size: 19, weight: .medium, design: .rounded))
                                .foregroundStyle(Self.ink.opacity(0.7))
                            if let status = score.status, !status.isEmpty {
                                Text(status).font(.system(size: 19, weight: .bold, design: .rounded))
                                    .foregroundStyle(score.connected == false ? Color.red : Self.accent)
                            }
                        }
                        Spacer(minLength: 6)
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(Self.number(score.score ?? 0)).font(.system(size: 52, weight: .black, design: .rounded)).monospacedDigit()
                            Text(screen.info.scoreUnit ?? "").font(.system(size: 18, weight: .bold, design: .rounded))
                        }
                    }
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .frame(width: 400)
                    .background(panel(cornerRadius: 24, color: score.color))
                    .opacity(score.connected == false ? 0.6 : 1)
                }
            }
        }
        .padding(.top, 26).padding(.bottom, 34)
    }

    // MARK: Ergebnis

    private var resultsCard: some View {
        let results = screen.results
        return card(width: 1240) {
            Text("Ergebnis · \(screen.info.title)").font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundStyle(Self.ink.opacity(0.7))
            Text(results?.headline ?? "Auswertung …").font(.system(size: 66, weight: .black, design: .rounded))
            if let teams = screen.teams, results?.aborted != true {
                teamSummary(teams)
            }
            if results?.aborted == true {
                Text("Das Ergebnis kam nicht rechtzeitig an.").font(.system(size: 30, weight: .semibold, design: .rounded))
            } else {
                VStack(spacing: 12) {
                    ForEach(results?.rows ?? [], id: \.slot) { row in
                        HStack(spacing: 18) {
                            VStack(spacing: 0) {
                                Text("\(row.place ?? 0).").font(.system(size: 44, weight: .black, design: .rounded))
                                if row.tied == true { Text("geteilt").font(.system(size: 16, weight: .bold, design: .rounded)) }
                            }
                            .frame(width: 90)
                            badge(slot: row.slot, color: row.color, symbol: row.symbol)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(row.name ?? "").font(.system(size: 32, weight: .heavy, design: .rounded))
                                Text(row.character ?? "").font(.system(size: 20, weight: .medium, design: .rounded))
                                    .foregroundStyle(Self.ink.opacity(0.7))
                            }
                            Spacer()
                            Text(row.scoreText ?? "").font(.system(size: 28, weight: .bold, design: .rounded))
                            if let coins = row.coins {
                                HStack(spacing: 8) {
                                    Circle().fill(Color(red: 1, green: 0.78, blue: 0.2)).overlay(Circle().stroke(Self.ink, lineWidth: 3))
                                        .frame(width: 34, height: 34)
                                    Text("+\(coins)").font(.system(size: 36, weight: .black, design: .rounded)).monospacedDigit()
                                }
                                .frame(width: 140, alignment: .leading)
                            }
                            if let prizes = row.prizes, !prizes.isEmpty {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text("Trostpreis").font(.system(size: 16, weight: .heavy, design: .rounded))
                                    Text(prizes.joined(separator: ", ")).font(.system(size: 24, weight: .bold, design: .rounded))
                                }
                                .padding(.horizontal, 14).padding(.vertical, 6)
                                .background(Self.accent.opacity(0.25), in: .rect(cornerRadius: 14))
                            }
                        }
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(Color(platformColor(row.color ?? "#cccccc")).opacity(row.place == 1 ? 0.3 : 0.14), in: .rect(cornerRadius: 20))
                    }
                }
            }
            if let highlights = results?.highlights, !highlights.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(highlights, id: \.self) { Text("★ \($0)").font(.system(size: 24, weight: .semibold, design: .rounded)) }
                }
            }
        }
    }

    // MARK: Bausteine

    private func card<Content: View>(width: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 20) { content() }
            .padding(44)
            .frame(width: width, alignment: .leading)
            .background(panel(cornerRadius: 36))
    }

    private func panel(cornerRadius: CGFloat, color: String? = nil) -> some View {
        RoundedRectangle(cornerRadius: cornerRadius).fill(Self.paper)
            .overlay(RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(color.map { Color(platformColor($0)) } ?? Self.ink, lineWidth: 5))
            .background(RoundedRectangle(cornerRadius: cornerRadius).fill(Self.ink).offset(y: 8))
    }

    /// Slot-Symbol in Slot-Farbe (Farbe + Symbol, nie nur Farbe).
    private func badge(slot: Int, color: String?, symbol: String? = nil, size: CGFloat = 54) -> some View {
        Text(symbol ?? Self.symbols[(slot - 1) & 3]).font(.system(size: size * 0.52, weight: .black)).foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(platformColor(color ?? "#888888")), in: .circle)
            .overlay(Circle().stroke(Self.ink, lineWidth: 3))
    }

    private static func number(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.1f", value)
    }
}

/// `--bild=<pfad>`: je Minispiel-Abschnitt ein Bild mit Anleitung, HUD bzw. Ergebnis (CHAOS-144): Szene über
/// `RenderLoop.capture`, darüber die SwiftUI-Ebene per `ImageRenderer`. Dateien `<pfad>-mg-<runde>-<id>-<abschnitt>.png`.
@MainActor
enum MinigameSnapshot {
    static func schedule(stage key: String, path: String, loop: RenderLoop?, runtime: HostRuntime) {
        // Die kurze Anleitung bei Wiederholung (CHAOS-66) dauert nur wenige Sekunden: früh aufnehmen.
        let delays: [(Double, String)] = key.hasSuffix("-play") ? [(6, "a"), (16, "b")] : [(key.hasSuffix("-intro") ? 2.5 : 3, "")]
        for (delay, suffix) in delays {
            let name = "\(path)-mg-\(key)\(suffix.isEmpty ? "" : "-\(suffix)")"
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak loop, weak runtime] in
                guard let runtime, let screen = runtime.overlay.minigame else { return }
                // Bildschirm zum Zeitpunkt der Aufnahme festhalten, nicht beim Zusammensetzen.
                let players = runtime.overlay.players
                let background = "\(name)-3d.png"
                try? FileManager.default.removeItem(atPath: background)
                loop?.capture(to: background)
                compose(background: background, screen: screen, players: players, to: "\(name).png", attempts: 30)
            }
        }
    }

    /// Wartet bis zu `attempts` × 0,1 s auf das Szenenbild (dann 0,3 s, bis es fertig geschrieben ist), sonst ohne
    /// Hintergrund.
    private static func compose(background: String, screen: MinigameScreen, players: [RenderState.Player], to path: String,
                                attempts: Int, found: Bool = false) {
        if !found, attempts > 0 {
            let exists = FileManager.default.fileExists(atPath: background)
            DispatchQueue.main.asyncAfter(deadline: .now() + (exists ? 0.3 : 0.1)) {
                compose(background: background, screen: screen, players: players, to: path, attempts: attempts - 1, found: exists)
            }
            return
        }
        let image = CGImageSourceCreateWithURL(URL(fileURLWithPath: background) as CFURL, nil)
            .flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) }
        let view = ZStack {
            if let image { Image(decorative: image, scale: 1).resizable() } else { Color.gray }
            MinigameOverlayView(screen: screen, players: players)
        }
        .frame(width: 1920, height: 1080)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 1
        guard let output = renderer.cgImage,
              let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil)
        else { return hostLog("FEHLER Minispiel-Bild \(path)") }
        CGImageDestinationAddImage(dest, output, nil)
        if CGImageDestinationFinalize(dest) { hostLog("Minispiel-Bild gespeichert: \(path)") }
    }
}
