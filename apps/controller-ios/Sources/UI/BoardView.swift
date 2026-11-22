// Board phase: status, prompts with countdown, waiting, pause, final results
// (board/{prompt,status,final,countdown}.ts, ui/{board,BoardPanel,final}.tsx).
import SwiftUI

// MARK: - Prompt model (port of `describePrompt`)

struct Choice: Equatable {
    enum Tone { case roll, item, path, buy, skip, target, cancel, reaction, plain }
    let id: String
    let label: String
    let detail: String?
    let tone: Tone
    let icon: String?
    /// Target player (color + symbol) or `nil`.
    let slot: Int?
}

struct PromptLayout: Equatable {
    /// Known kind or `other` (plain button list).
    let kind: String
    let main: [Choice]
    let extra: [Choice]

    init(_ prompt: Prompt) {
        func choice(_ o: PromptOption, _ tone: Choice.Tone, _ icon: String?, withSlot: Bool = false) -> Choice {
            Choice(id: o.id, label: o.label, detail: o.detail, tone: tone, icon: icon, slot: withSlot ? o.slot : nil)
        }
        func plain(_ o: PromptOption) -> Choice { choice(o, o.slot == nil ? .plain : .target, nil, withSlot: true) }
        func item(_ o: PromptOption) -> Choice? {
            guard o.id.hasPrefix("item:") else { return nil }
            let kind = ItemKind(rawValue: String(o.id.dropFirst(5)))
            return kind.isKnown ? choice(o, .item, kind.rawValue) : nil
        }
        let options = prompt.options
        switch prompt.kind {
        case .roll:
            let roll = options.filter { $0.id == "roll" }
            kind = "roll"
            if roll.isEmpty {
                main = options.map(plain)
                extra = []
            } else {
                main = roll.map { choice($0, .roll, "dice") }
                extra = options.filter { $0.id != "roll" }.map { item($0) ?? plain($0) }
            }
        case .path:
            kind = "path"
            main = options.map { choice($0, .path, "arrow") }
            extra = []
        case .trophy:
            kind = "trophy"
            main = options.map {
                $0.id == "buy" ? choice($0, .buy, "trophy") : $0.id == "skip" ? choice($0, .skip, "skip") : plain($0)
            }
            extra = []
        case .target:
            kind = "target"
            main = options.filter { $0.id != "cancel" }.map { $0.slot == nil ? plain($0) : choice($0, .target, nil, withSlot: true) }
            extra = options.filter { $0.id == "cancel" }.map { choice($0, .cancel, "cancel") }
        case .reaction:
            kind = "reaction"
            main = options.map {
                $0.id == "shield" || $0.id == "brace" ? choice($0, .reaction, $0.id) : choice($0, .reaction, nil, withSlot: true)
            }
            extra = []
        default:
            kind = "other"
            main = options.map(plain)
            extra = []
        }
    }
}

// MARK: - Board panel

struct BoardPanel: View {
    let session: any ControllerSessionProtocol
    let slot: Int
    let context: SlotContext
    let tint: Tint
    let landscape: Bool

    var body: some View {
        let state = session.state
        let stack = landscape ? AnyLayout(HStackLayout(spacing: 20)) : AnyLayout(VStackLayout(spacing: 14))
        stack {
            if let board = context.board { StatusBar(board: board).frame(maxWidth: landscape ? 300 : nil) }
            if let prompt = state.ownPrompt(slot) {
                PromptPanel(
                    prompt: prompt, layout: PromptLayout(prompt.info), tint: tint,
                    locked: state.isLocked(slot), chosen: state.choices[slot]?.option
                ) { option in
                    session.choose(slot: slot, promptId: prompt.info.id, option: option)
                }
                .id(prompt.info.id)
            } else {
                WaitingCard(board: context.board, ownSlot: slot, players: state.players)
                    .frame(maxHeight: .infinity)
            }
        }
        .sensoryFeedback(.impact(weight: .light), trigger: state.choices[slot]?.promptId) { _, new in new != nil }
        // Reaction prompts buzz when they appear (`ReactionBuzz`).
        .sensoryFeedback(.warning, trigger: state.ownPrompt(slot).flatMap { $0.info.kind == .reaction ? $0.info.id : nil }) {
            _, new in new != nil
        }
    }
}

/// Own stand: coins, trophies, round, items (`StatusBar`).
struct StatusBar: View {
    let board: ControllerBoardInfo

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                stat(icon: "coin", value: board.coins).accessibilityLabel("\(board.coins) Münzen")
                stat(icon: "trophy", value: board.trophies).accessibilityLabel("\(board.trophies) Trophäen")
                Text(roundLabel)
                    .font(.title3.bold())
                    .lineLimit(1)
                    .fixedSize()
                    .padding(.horizontal, 14)
                    .frame(minHeight: 48)
                    .glass(24)
            }
            if board.items.isEmpty {
                Text("Keine Items").font(.callout).foregroundStyle(Palette.dim)
            } else {
                ViewThatFits {
                    items(named: true)
                    items(named: false)
                }
            }
        }
    }

    /// „Runde 2/5“; before the first round „Runde 1/5“.
    private var roundLabel: String {
        "Runde \(min(max(board.round, 1), max(board.rounds, 1)))/\(board.rounds)"
    }

    private func stat(icon: String, value: Int) -> some View {
        HStack(spacing: 8) {
            GameIcon(name: icon, size: 28)
            Text("\(value)").font(.title2.bold()).monospacedDigit().fixedSize()
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
        .glass(24)
        .accessibilityElement(children: .ignore)
    }

    private func items(named: Bool) -> some View {
        HStack(spacing: 8) {
            ForEach(Array(board.items.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 6) {
                    GameIcon(name: item.isKnown ? item.rawValue : "?", size: 22)
                    if named { Text(item.displayName).font(.callout.weight(.semibold)).lineLimit(1) }
                }
                .padding(.horizontal, 10)
                .frame(minHeight: 36)
                .glass(18)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(item.displayName)
            }
        }
    }
}

private struct PromptPanel: View {
    let prompt: ActivePrompt
    let layout: PromptLayout
    let tint: Tint
    let locked: Bool
    let chosen: String?
    let choose: (String) -> Void

    var body: some View {
        let reaction = layout.kind == "reaction"
        VStack(spacing: 14) {
            Text(prompt.info.title)
                .font(.title.bold())
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            if prompt.deadline != nil { CountdownBar(prompt: prompt, big: reaction) }
            VStack(spacing: 12) {
                ForEach(layout.main, id: \.id) { choice in
                    ChoiceButton(choice: choice, tint: tint, main: true, chosen: locked && chosen == choice.id, onTouchDown: reaction) {
                        choose(choice.id)
                    }
                    .frame(maxHeight: layout.main.count == 1 || reaction ? .infinity : 120)
                }
            }
            .frame(maxHeight: .infinity)
            if !layout.extra.isEmpty {
                HStack(spacing: 12) {
                    ForEach(layout.extra, id: \.id) { choice in
                        ChoiceButton(choice: choice, tint: tint, main: false, chosen: locked && chosen == choice.id, onTouchDown: false) {
                            choose(choice.id)
                        }
                    }
                }
            }
            if locked {
                Text("Gesendet … warte kurz").font(.headline).foregroundStyle(Palette.dim)
            }
        }
        .disabled(locked)
    }
}

private struct ChoiceButton: View {
    let choice: Choice
    let tint: Tint
    let main: Bool
    let chosen: Bool
    /// Reactions count from touch down (faster than a tap).
    let onTouchDown: Bool
    let action: () -> Void
    @Environment(\.isEnabled) private var enabled

    var body: some View {
        let target = choice.slot.map(Slots.style)
        let face = HStack(spacing: 14) {
            if let target {
                SlotSymbol(slot: choice.slot ?? 0, size: 48)
                    .overlay(Circle().strokeBorder(target.onColor.opacity(0.6), lineWidth: 2))
            } else if let icon = choice.icon {
                GameIcon(name: icon, size: iconSize)
            }
            VStack(alignment: choice.tone == .reaction ? .center : .leading, spacing: 2) {
                Text(choice.label)
                    .font(labelFont)
                    .lineLimit(2)
                    .minimumScaleFactor(0.6)
                if let detail = choice.detail {
                    Text(detail).font(main ? .callout.weight(.semibold) : .caption.weight(.semibold)).opacity(0.85)
                }
            }
        }
        .foregroundStyle(textColor(target))
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: main ? 76 : 56, maxHeight: main ? .infinity : nil)
        .background(background(target))
        .overlay {
            if chosen {
                RoundedRectangle(cornerRadius: radius, style: .continuous).strokeBorder(.white, lineWidth: 3)
            }
        }
        .opacity(enabled || chosen ? 1 : 0.55)
        .contentShape(RoundedRectangle(cornerRadius: radius, style: .continuous))

        if onTouchDown {
            face
                .onLongPressGesture(minimumDuration: 0) {} onPressingChanged: { pressing in
                    if pressing && enabled { action() }
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityAction { action() }
        } else {
            SwiftUI.Button(action: action) { face }
                .buttonStyle(PressStyle())
                .accessibilityElement(children: .combine)
        }
    }

    private var radius: CGFloat { main ? 26 : 20 }
    private var iconSize: CGFloat {
        switch choice.tone {
        case .roll, .reaction: 60
        default: main ? 40 : 30
        }
    }
    private var labelFont: Font {
        switch choice.tone {
        case .roll, .reaction: .system(size: 38, weight: .bold)
        default: main ? .title2.bold() : .headline
        }
    }

    private func textColor(_ target: SlotStyle?) -> Color {
        switch choice.tone {
        case .roll, .buy: tint.on
        case .target: target?.onColor ?? Palette.ink
        case .reaction: .white
        default: Palette.ink
        }
    }

    @ViewBuilder
    private func background(_ target: SlotStyle?) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        switch choice.tone {
        case .roll, .buy:
            Color.clear.primary(tint.color, radius: radius)
        case .target:
            shape.fill(target?.color ?? Palette.glassStrong).overlay(shape.strokeBorder(Palette.line))
        case .reaction:
            shape.fill(LinearGradient(colors: [Color(hex: "#ff7a6b"), Palette.danger], startPoint: .top, endPoint: .bottom))
                .shadow(color: Palette.danger.opacity(0.5), radius: 20, y: 14)
                .phaseAnimator([1.0, 1.04]) { view, scale in view.scaleEffect(scale) } animation: { _ in
                    .easeInOut(duration: 0.6)
                }
        default:
            Color.clear.glass(radius, strong: true)
        }
    }
}

/// Countdown bar, display only – the server decides the deadline (`CountdownBar`).
private struct CountdownBar: View {
    let prompt: ActivePrompt
    let big: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30)) { _ in
            let now = ContinuousClock.now
            let fraction = prompt.fraction(at: now) ?? 0
            let leftMs = prompt.deadline.map { max(0, ($0 - now) / .milliseconds(1)) } ?? 0
            let seconds = Int((leftMs / 1000).rounded(.up))
            let urgent = fraction < 0.34
            HStack(spacing: 12) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.15))
                        Capsule()
                            .fill(urgent ? Palette.danger : Palette.sun)
                            .frame(width: geo.size.width * fraction)
                    }
                }
                .frame(height: big ? 18 : 12)
                Text("\(seconds)")
                    .font(big ? .title.bold() : .title3.bold())
                    .monospacedDigit()
                    .frame(minWidth: 32)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Noch \(seconds) Sekunden")
        }
    }
}

// MARK: - Waiting (port of `describeWaiting`)

/// Headline texts of the waiting card (port of `board/status.ts`).
enum WaitingText {
    /// „Schraubi ist dran“, for an AI seat „Schraubi (KI) ist dran“ (ADR-020 §7, CHAOS-239). Without
    /// `activeSeat` (older server): own name from `welcome`, otherwise the colour name.
    static func otherTurn(slot: Int, board: ControllerBoardInfo?, players: [PlayerInfo]) -> String {
        let seat = board?.activeSlot == slot ? board?.activeSeat : nil
        let name = seat?.name ?? players.first { $0.slot == slot }?.label ?? Slots.style(slot).label
        return seat?.kind == "ai" ? "\(name) (KI) ist dran" : "\(name) ist dran"
    }
}

private struct WaitingCard: View {
    let board: ControllerBoardInfo?
    let ownSlot: Int
    let players: [PlayerInfo]

    var body: some View {
        VStack(spacing: 16) {
            mark
            Text(headline).font(.title.bold()).multilineTextAlignment(.center)
            if let lead { Text(lead).font(.title3).foregroundStyle(Palette.dim).multilineTextAlignment(.center) }
        }
        .accessibilityElement(children: .combine)
    }

    private enum Kind { case otherTurn(Int), ownTurn, minigame, results(Int?), setup, tailwind(Int), watch }

    private var kind: Kind {
        guard let board else { return .watch }
        if board.gamePhase == .gameResults { return .results(board.place) }
        if [.minigameIntro, .minigamePlay, .minigameResults].contains(board.gamePhase) { return .minigame }
        if board.gamePhase == .setup { return .setup }
        // CHAOS-125: own tailwind coins during the round end (board/status.ts).
        if board.gamePhase == .roundEnd, let coins = board.tailwind, coins > 0 { return .tailwind(coins) }
        guard let active = board.activeSlot else { return .watch }
        return active == ownSlot ? .ownTurn : .otherTurn(active)
    }

    @ViewBuilder private var mark: some View {
        switch kind {
        case .otherTurn(let slot): SlotSymbol(slot: slot, size: 120)
        case .ownTurn: SlotSymbol(slot: ownSlot, size: 120)
        case .minigame: GameIcon(name: "star", size: 84)
        case .results(let place):
            VStack(spacing: 6) {
                GameIcon(name: "trophy", size: 56)
                if let place { Text("Platz \(place)").font(.title.bold()) }
            }
        case .tailwind: GameIcon(name: "coin", size: 84)
        case .setup, .watch: WaitDots()
        }
    }

    private var headline: String {
        switch kind {
        case .otherTurn(let slot): WaitingText.otherTurn(slot: slot, board: board, players: players)
        case .ownTurn: "Du bist dran!"
        case .minigame: "Minispiel läuft …"
        case .results(let place): place == nil ? "Spiel vorbei!" : place == 1 ? "Du hast gewonnen!" : "Gut gespielt!"
        case .setup: "Gleich geht’s los …"
        case .tailwind(let coins): "Rückenwind: +\(coins) \(coins == 1 ? "Münze" : "Münzen")!"
        case .watch: lookAtScreen
        }
    }

    private var lead: String? {
        switch kind {
        case .results, .watch: nil
        case .tailwind: "Du liegst bei den Trophäen hinten – das hilft beim Aufholen."
        default: lookAtScreen
        }
    }
}

// MARK: - Pause and final (board/final.ts, ui/final.tsx)

struct PauseCard: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "pause.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(Palette.ink)
                .accessibilityHidden(true)
            Text("Pause").font(.largeTitle.bold())
            Text("Der PC hat angehalten.").font(.title3.weight(.semibold))
            Text("Gleich geht’s weiter – deine Eingaben zählen gerade nicht.")
                .font(.body)
                .foregroundStyle(Palette.dim)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: 420)
        .glass(28)
        .accessibilityElement(children: .combine)
    }
}

struct FinalCard: View {
    let board: ControllerBoardInfo
    let tint: Tint

    var body: some View {
        let place = board.place
        let tied = place != nil && board.tied == true
        ScrollView {
            VStack(spacing: 18) {
                HStack(spacing: 16) {
                    Portrait(character: board.character, accent: tint.color)
                        .frame(width: 110, height: 110)
                        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    VStack(alignment: .leading, spacing: 6) {
                        if let place {
                            HStack(spacing: 8) {
                                if place == 1 { GameIcon(name: "trophy", size: 34) }
                                Text(tied ? "Geteilter Platz \(place)" : "Platz \(place)").font(.title.bold())
                            }
                        }
                        Text(headline(place: place, tied: tied)).font(.title3.weight(.semibold))
                    }
                    .accessibilityElement(children: .combine)
                }
                HStack(spacing: 10) {
                    stat("trophy", board.trophies, "Trophäen", board.trophies == 1 ? "1 Trophäe" : "\(board.trophies) Trophäen")
                    stat("coin", board.coins, "Münzen", board.coins == 1 ? "1 Münze" : "\(board.coins) Münzen")
                    stat("star", board.minigameWins, "Siege",
                        board.minigameWins == 1 ? "1 Minispiel gewonnen" : "\(board.minigameWins) Minispiele gewonnen")
                }
                if board.endedEarly == true {
                    Text("Die Partie wurde am PC vorzeitig beendet.").font(.callout).foregroundStyle(Palette.sun)
                }
                Text("Nochmal? Am PC „Nochmal spielen“ wählen.")
                    .font(.callout)
                    .foregroundStyle(Palette.dim)
                    .multilineTextAlignment(.center)
            }
            .padding(22)
            .glass(28)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity, minHeight: 0)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    private func headline(place: Int?, tied: Bool) -> String {
        guard let place else { return "Spiel vorbei!" }
        if place == 1 { return tied ? "Gemeinsam gewonnen!" : "Du hast gewonnen!" }
        return "Gut gespielt!"
    }

    private func stat(_ icon: String, _ value: Int, _ label: String, _ spoken: String) -> some View {
        VStack(spacing: 4) {
            GameIcon(name: icon, size: 28)
            Text("\(value)").font(.title.bold()).monospacedDigit()
            Text(label).font(.caption.weight(.semibold)).foregroundStyle(Palette.dim)
        }
        .frame(maxWidth: .infinity, minHeight: 96)
        .glass(20, strong: true)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
    }
}
