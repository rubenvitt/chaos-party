import SwiftUI

/// Rundenwahl und „Mehr Zeit zum Reagieren“ in der Lobby (CHAOS-166), wie im Babylon-Host
/// (`apps/host/src/lobby/LobbyPanel.tsx`). Zeigt nur den Server-Stand aus `renderState.lobby.settings`;
/// jede Wahl geht als `configure:…` über `hostCommand` an den Kern und kommt im nächsten Bild zurück.
///
/// - macOS: Maus, dazu Tasten ←/→ (Runden) und M (Schalter).
/// - tvOS: Fokus mit der Fernbedienung (hoch vom Startknopf), Auswahl drückt. Knöpfe nie `.disabled`,
///   sonst bekommen sie keinen Fokus.
struct LobbySettingsView: View {
    let settings: RenderState.LobbySettings?
    let playerCount: Int
    let command: (String) -> Void

    var body: some View {
        if let settings, let rounds = settings.rounds {
            let options = Self.roundOptions(settings)
            let more = settings.moreReactionTime == true
            HStack(alignment: .bottom, spacing: 26) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(Self.keys ? "Runden  ← →" : "Runden")
                        .font(.system(size: 22, weight: .semibold, design: .rounded)).foregroundStyle(.white.opacity(0.8))
                    HStack(spacing: 14) {
                        ForEach(options, id: \.self) { value in
                            Button { setRounds(value) } label: {
                                VStack(spacing: 2) {
                                    Text("\(value)").font(.system(size: 40, weight: .heavy, design: .rounded))
                                    Text(Self.duration(rounds: value, players: playerCount))
                                        .font(.system(size: 17, weight: .semibold, design: .rounded)).opacity(0.85)
                                }
                                .frame(width: 112, height: 84)
                            }
                            .buttonStyle(LobbyChoiceStyle(selected: value == rounds))
                            .accessibilityLabel("\(value) Runden")
                            .accessibilityAddTraits(value == rounds ? .isSelected : [])
                        }
                    }
                }
                Button { command("configure:moreReactionTime=\(more ? 0 : 1)") } label: {
                    HStack(spacing: 18) {
                        Capsule().fill(more ? Color.green : Color.white.opacity(0.3))
                            .frame(width: 68, height: 38)
                            .overlay(alignment: more ? .trailing : .leading) { Circle().fill(.white).padding(4) }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Self.keys ? "Mehr Zeit zum Reagieren  (M)" : "Mehr Zeit zum Reagieren")
                                .font(.system(size: 26, weight: .heavy, design: .rounded))
                            Text(more ? "An: 5 s zum Festhalten" : "Aus: 3 s zum Festhalten")
                                .font(.system(size: 20, weight: .medium, design: .rounded)).opacity(0.85)
                        }
                    }
                    .padding(.horizontal, 20).frame(height: 84)
                }
                .buttonStyle(LobbyChoiceStyle(selected: false))
                .accessibilityValue(more ? "An" : "Aus")
            }
            .padding(22)
            .frame(width: 1068, alignment: .leading)
            .background(.black.opacity(0.62), in: .rect(cornerRadius: 28))
            #if os(macOS)
            .background { shortcuts(options: options, rounds: rounds, more: more) }
            #endif
        }
    }

    private func setRounds(_ value: Int) { command("configure:rounds=\(value)") }

    #if os(macOS)
    private static let keys = true

    /// Unsichtbare Knöpfe nur für die Tasten (die sichtbaren sind am Mac ohne Tastaturzugriff nicht fokussierbar).
    @ViewBuilder private func shortcuts(options: [Int], rounds: Int, more: Bool) -> some View {
        let index = options.firstIndex(of: rounds) ?? 0
        ZStack {
            Button("") { if index > 0 { setRounds(options[index - 1]) } }.keyboardShortcut(.leftArrow, modifiers: [])
            Button("") { if index + 1 < options.count { setRounds(options[index + 1]) } }.keyboardShortcut(.rightArrow, modifiers: [])
            Button("") { command("configure:moreReactionTime=\(more ? 0 : 1)") }.keyboardShortcut("m", modifiers: [])
        }
        .opacity(0).frame(width: 0, height: 0).accessibilityHidden(true)
    }
    #else
    private static let keys = false
    #endif

    /// Vorschläge des Servers plus die aktuelle Zahl, falls sie keiner ist (`roundOptions` in `apps/host/src/lobby/lobbyState.ts`).
    static func roundOptions(_ settings: RenderState.LobbySettings) -> [Int] {
        Array(Set((settings.roundPresets ?? []) + (settings.rounds.map { [$0] } ?? []))).sorted()
    }

    /// Grobe Spieldauer „≈ 15 Min.“ wie `roundsDuration` in `apps/host/src/lobby/lobbyState.ts` (EXP-011, CHAOS-40):
    /// Minuten je Runde nach Spielerzahl plus Finale, auf 5 Minuten gerundet; unter zwei Spielern wie mit vier.
    static func duration(rounds: Int, players: Int) -> String {
        let perRound = [2: 1.1, 3: 1.3, 4: 1.45][players] ?? 1.45
        let minutes = Double(rounds) * perRound + 0.35
        return "≈ \(max(5, Int((minutes / 5).rounded()) * 5)) Min."
    }
}

/// Brett-Wahl in der Lobby (CHAOS-197), wie die Brett-Knöpfe im Babylon-Host (`LobbyPanel.tsx`), aber als ein
/// Wechselknopf neben dem Titel, damit die Lobby auf 1080p nicht höher wird: jeder Druck wählt das nächste Brett
/// (zuletzt „Zufall“, dann wieder von vorn). Zeigt nur den Server-Stand aus `renderState.lobby.settings`; die Wahl
/// geht als `configure:board=<id>` an den Kern.
///
/// - macOS: Maus oder Taste B.
/// - tvOS: Fokus mit der Fernbedienung (hoch aus den Einstellungen), Auswahl drückt.
struct BoardChoiceView: View {
    let settings: RenderState.LobbySettings?
    let command: (String) -> Void

    var body: some View {
        if let boards = settings?.boards, !boards.isEmpty {
            let current = boards.first { $0.selected } ?? boards[0]
            Button { command("configure:board=\(Self.next(after: current, in: boards).id)") } label: {
                HStack(spacing: 16) {
                    Text(current.random ? "🎲" : "🗺️").font(.system(size: 40))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(Self.keys ? "Brett  (B)" : "Brett")
                            .font(.system(size: 18, weight: .semibold, design: .rounded)).opacity(0.8)
                        Text(current.name).font(.system(size: 30, weight: .heavy, design: .rounded))
                        Text(current.detail).font(.system(size: 17, weight: .semibold, design: .rounded)).opacity(0.85)
                    }
                    if boards.count > 1 {
                        Image(systemName: "chevron.right").font(.system(size: 26, weight: .heavy)).opacity(0.7)
                    }
                }
                .padding(.horizontal, 22).frame(minWidth: 300, minHeight: 96, alignment: .leading)
            }
            .buttonStyle(LobbyChoiceStyle(selected: false))
            .accessibilityLabel("Brett")
            .accessibilityValue(current.name)
            #if os(macOS)
            .keyboardShortcut("b", modifiers: [])
            #endif
        }
    }

    /// Nächstes Brett nach dem gewählten, am Ende wieder das erste.
    static func next(after current: RenderState.BoardChoice, in boards: [RenderState.BoardChoice]) -> RenderState.BoardChoice {
        guard let index = boards.firstIndex(of: current) else { return boards[0] }
        return boards[(index + 1) % boards.count]
    }

    #if os(macOS)
    private static let keys = true
    #else
    private static let keys = false
    #endif
}

/// Minispiele der Rotation in der Lobby (CHAOS-216), wie der Knopf „Minispiele“ im Babylon-Host (`LobbyPanel.tsx`):
/// zeigt den Stand („5 im Topf · 2 ★ · 1 ⦸“) und öffnet die Liste (`MinigameRotationPanel`).
///
/// - macOS: Maus oder Taste S.
/// - tvOS: Fokus mit der Fernbedienung (rechts vom Startknopf), Auswahl drückt.
struct MinigameRotationButton: View {
    let settings: RenderState.LobbySettings?
    let open: () -> Void

    var body: some View {
        if let games = settings?.minigames, !games.isEmpty {
            Button(action: open) {
                HStack(spacing: 14) {
                    Text("🎲").font(.system(size: 36))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(Self.keys ? "Minispiele  (S)" : "Minispiele")
                            .font(.system(size: 18, weight: .semibold, design: .rounded)).opacity(0.8)
                        Text(settings?.minigameSummary?.short ?? "\(games.count) im Topf")
                            .font(.system(size: 24, weight: .heavy, design: .rounded)).lineLimit(1)
                    }
                }
                .padding(.horizontal, 20).frame(minHeight: 84, alignment: .leading)
            }
            .buttonStyle(LobbyChoiceStyle(selected: false))
            .accessibilityLabel("Minispiele")
            .accessibilityValue(settings?.minigameSummary?.long ?? "")
            #if os(macOS)
            .keyboardShortcut("s", modifiers: [])
            #endif
        }
    }

    #if os(macOS)
    private static let keys = true
    #else
    private static let keys = false
    #endif
}

/// Liste der Minispiele (CHAOS-216) wie der Dialog „Minispiele“ am PC (`MinigameRotationDialog.tsx`): je Spiel
/// „★ Favorit“ (kommt öfter) und „⦸ Sperren“ (kommt nicht); beides schließt sich aus. Zeigt nur den Server-Stand aus
/// `renderState.lobby.settings.minigames`; jeder Druck geht als `minigame:favorite=<id>` bzw. `minigame:blocked=<id>` an
/// den Kern, der den Stand speichert (`env.storage` → `UserDefaults`) und an den Server schickt.
///
/// - macOS: Maus; Tasten ↑ ↓ ← → wählen ein Spiel, F Favorit, X Sperren, Esc schließt.
/// - tvOS: Fokus mit der Fernbedienung, Auswahl drückt; die Menü-Taste schließt.
struct MinigameRotationPanel: View {
    let games: [RenderState.LobbyMinigame]
    let command: (String) -> Void
    let close: () -> Void
    @FocusState private var focused: String?
    #if os(macOS)
    @State private var cursor = 0
    #endif

    private static let columns = 2

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
            VStack(alignment: .leading, spacing: 22) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Minispiele").font(.system(size: 60, weight: .black, design: .rounded))
                    Spacer(minLength: 20)
                    Text(Self.keys ? "↑ ↓ ← → wählen · F Favorit · X Sperren · Esc fertig" : "Menü-Taste: fertig")
                        .font(.system(size: 22, weight: .semibold, design: .rounded)).opacity(0.75)
                }
                Text("★ Favoriten kommen öfter dran, gesperrte gar nicht. Gilt ab der nächsten Partie.")
                    .font(.system(size: 26, weight: .medium, design: .rounded)).opacity(0.85)
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 24), count: Self.columns),
                                  spacing: 18) {
                            ForEach(Array(games.enumerated()), id: \.element.id) { index, game in
                                row(game, index: index).id(game.id)
                            }
                        }
                        .padding(14) // Platz für den vergrößerten Fokus (tvOS)
                    }
                    #if os(macOS)
                    .onChange(of: cursor) { _, index in
                        if games.indices.contains(index) { proxy.scrollTo(games[index].id) }
                    }
                    #endif
                }
                .frame(maxHeight: 620)
                if games.allSatisfy(\.blocked) {
                    Text("Alle gesperrt – dann kommen trotzdem alle dran.")
                        .font(.system(size: 24, weight: .semibold, design: .rounded)).foregroundStyle(.yellow)
                }
                Button(action: close) {
                    Text(Self.keys ? "Fertig  (Esc)" : "Fertig")
                        .font(.system(size: 30, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 36).frame(height: 72)
                }
                .buttonStyle(LobbyChoiceStyle(selected: true))
                #if os(macOS)
                .keyboardShortcut(.cancelAction)
                #endif
            }
            .padding(44)
            .frame(width: 1440)
            .background(Color(white: 0.07).opacity(0.95), in: .rect(cornerRadius: 36))
            .overlay { RoundedRectangle(cornerRadius: 36).strokeBorder(.white.opacity(0.2), lineWidth: 2) }
            #if os(tvOS)
            .focusSection()
            .onExitCommand(perform: close)
            #endif
        }
        .onAppear {
            // tvOS: Fokus gleich auf das erste Spiel, nicht irgendwo in der (gesperrten) Lobby dahinter.
            DispatchQueue.main.async { focused = games.first.map { "favorite-\($0.id)" } }
        }
        #if os(macOS)
        .background { shortcuts }
        #endif
    }

    private func row(_ game: RenderState.LobbyMinigame, index: Int) -> some View {
        HStack(spacing: 14) {
            Text(game.title)
                .font(.system(size: 28, weight: .heavy, design: .rounded)).strikethrough(game.blocked)
                .lineLimit(1).minimumScaleFactor(0.7)
                .opacity(game.blocked ? 0.55 : 1)
                .frame(maxWidth: .infinity, alignment: .leading)
            toggle("★ Favorit", on: game.favorite, tint: .orange, id: "favorite-\(game.id)") {
                command("minigame:favorite=\(game.id)")
            }
            .accessibilityLabel("\(game.title) als Favorit")
            toggle("⦸ Sperren", on: game.blocked, tint: .red, id: "blocked-\(game.id)") {
                command("minigame:blocked=\(game.id)")
            }
            .accessibilityLabel("\(game.title) sperren")
        }
        .padding(.leading, 22).padding(.trailing, 12)
        .frame(height: 88)
        .background(.white.opacity(0.08), in: .rect(cornerRadius: 22))
        #if os(macOS)
        .overlay {
            if index == cursor { RoundedRectangle(cornerRadius: 22).strokeBorder(.white, lineWidth: 4) }
        }
        #endif
    }

    private func toggle(_ label: String, on: Bool, tint: Color, id: String,
                        action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label).font(.system(size: 22, weight: .bold, design: .rounded))
                .padding(.horizontal, 16).frame(height: 60)
        }
        .buttonStyle(LobbyChoiceStyle(selected: on, tint: tint))
        .focused($focused, equals: id)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    #if os(macOS)
    private static let keys = true

    /// Unsichtbare Knöpfe nur für die Tasten (die sichtbaren sind am Mac ohne Tastaturzugriff nicht fokussierbar).
    @ViewBuilder private var shortcuts: some View {
        let index = min(cursor, max(0, games.count - 1))
        ZStack {
            Button("") { move(-Self.columns) }.keyboardShortcut(.upArrow, modifiers: [])
            Button("") { move(Self.columns) }.keyboardShortcut(.downArrow, modifiers: [])
            Button("") { move(-1) }.keyboardShortcut(.leftArrow, modifiers: [])
            Button("") { move(1) }.keyboardShortcut(.rightArrow, modifiers: [])
            Button("") { if games.indices.contains(index) { command("minigame:favorite=\(games[index].id)") } }
                .keyboardShortcut("f", modifiers: [])
            Button("") { if games.indices.contains(index) { command("minigame:blocked=\(games[index].id)") } }
                .keyboardShortcut("x", modifiers: [])
        }
        .opacity(0).frame(width: 0, height: 0).accessibilityHidden(true)
    }

    private func move(_ delta: Int) {
        guard !games.isEmpty else { return }
        cursor = min(max(0, cursor + delta), games.count - 1)
    }
    #else
    private static let keys = false
    #endif
}

/// Wahlknopf der Lobby: gewählt in der Akzentfarbe (Standard orange), sonst dunkel; Fokus (tvOS) als weißer Rand und
/// leichte Vergrößerung.
struct LobbyChoiceStyle: ButtonStyle {
    let selected: Bool
    var tint: Color = .orange

    func makeBody(configuration: Configuration) -> some View {
        Choice(configuration: configuration, selected: selected, tint: tint)
    }

    private struct Choice: View {
        let configuration: ButtonStyleConfiguration
        let selected: Bool
        let tint: Color
        @Environment(\.isFocused) private var focused

        var body: some View {
            configuration.label
                .foregroundStyle(.white)
                .background(selected ? tint : Color.white.opacity(0.12), in: .rect(cornerRadius: 20))
                .overlay {
                    RoundedRectangle(cornerRadius: 20)
                        .strokeBorder(focused ? Color.white : selected ? tint : Color.white.opacity(0.35),
                                      lineWidth: focused ? 5 : 2)
                }
                .scaleEffect(configuration.isPressed ? 0.96 : focused ? 1.08 : 1)
                .shadow(color: .black.opacity(focused ? 0.5 : 0), radius: 12, y: 6)
                .animation(.easeOut(duration: 0.12), value: focused)
                .contentShape(.rect(cornerRadius: 20))
        }
    }
}

/// `--runden=<n>`, `--mehrzeit` (bzw. `--mehrzeit=0|1`) und `--brett=<id|zufall>` (CHAOS-197): Lobby-Einstellungen
/// gleich nach dem Start (CHAOS-166), etwa für Bot-Partien mit `--autostart`. Ungültige Werte meldet der Kern im Log.
func launchConfigureCommand(_ arguments: [String]) -> String? {
    var parts: [String] = []
    for arg in arguments {
        if arg.hasPrefix("--runden=") { parts.append("rounds=\(arg.dropFirst(9))") }
        else if arg == "--mehrzeit" { parts.append("moreReactionTime=1") }
        else if arg.hasPrefix("--mehrzeit=") { parts.append("moreReactionTime=\(arg.dropFirst(11))") }
        else if arg.hasPrefix("--brett=") { parts.append("board=\(arg.dropFirst(8))") }
    }
    return parts.isEmpty ? nil : "configure:" + parts.joined(separator: ",")
}

/// `--rueckenwind` (bzw. `--rueckenwind=0|1`) oder die Umgebungsvariable `RUECKENWIND=1`: Regel Rückenwind
/// einschalten (CHAOS-188), wie `RUECKENWIND=1` am PC-Server (CHAOS-125, EXP-022). Standard aus bis zum Playtest;
/// der Startparameter geht vor der Umgebungsvariable. Geht als `tailwind` an `HostEnv`.
func launchTailwind(_ arguments: [String], environment: [String: String]) -> Bool {
    if let arg = arguments.last(where: { $0 == "--rueckenwind" || $0.hasPrefix("--rueckenwind=") }) {
        return arg == "--rueckenwind" || arg == "--rueckenwind=1"
    }
    return environment["RUECKENWIND"]?.trimmingCharacters(in: .whitespaces) == "1"
}

/// `--schnellfeuer=<wert>` (`an`, `aus`, `ereignis`, `halbzeit`, `finale`; ohne Wert `an`) oder die
/// Umgebungsvariable `SCHNELLFEUER`: Auslöser der Schnellfeuer-Runde (CHAOS-232), wie `SCHNELLFEUER`
/// am PC-Server (CHAOS-90, EXP-041). Der Startparameter geht vor der Umgebungsvariable; `nil` = Standard.
/// Geht unverändert als `rapidFire` an `HostEnv`; der JS-Kern prüft den Wert (`parseRapidFire`).
func launchRapidFire(_ arguments: [String], environment: [String: String]) -> String? {
    if let arg = arguments.last(where: { $0 == "--schnellfeuer" || $0.hasPrefix("--schnellfeuer=") }) {
        return arg == "--schnellfeuer" ? "an" : String(arg.dropFirst("--schnellfeuer=".count))
    }
    let value = environment["SCHNELLFEUER"]?.trimmingCharacters(in: .whitespaces) ?? ""
    return value.isEmpty ? nil : value
}

/// `--minispiele=pump-duell,pump-solo,pump-riese`: nur Test und Vorführung (CHAOS-230). Ersetzt die Rotation der
/// Partien durch genau diese Minispiele, etwa um die Team-Ansage der Testspiele aus CHAOS-89 am Mac oder auf der
/// Apple TV zu zeigen (mit `--bild=` auch als Bild). Geht als `debugMinigames` an `HostEnv`; Unbekanntes loggt
/// der Kern und lässt es weg. nil = Rotation des Katalogs.
func launchMinigames(_ arguments: [String]) -> [String]? {
    guard let arg = arguments.last(where: { $0.hasPrefix("--minispiele=") }) else { return nil }
    let ids = arg.dropFirst("--minispiele=".count).split(separator: ",")
        .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    return ids.isEmpty ? nil : ids
}
