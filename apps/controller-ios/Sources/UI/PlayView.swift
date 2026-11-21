// Play layout (joystick + A/B) and minigame cards (input/joystick.ts, minigame/view.ts,
// ui/{Joystick,ActionButton,minigame}.tsx).
import SwiftUI

// MARK: - Joystick math (port of `input/joystick.ts`)

struct StickInput: Equatable {
    var x = 0.0
    var y = 0.0
    static let zero = StickInput()

    /// Dead zone of the radius in which the stick counts as released (thumb jitter).
    static let deadZone = 0.12
    static let resolution = 0.01

    /// Finger offset (screen points, y down) → stick (y up, length ≤ 1, dead zone rescaled,
    /// truncated toward zero so rounding never pushes the length above 1).
    init(dx: Double, dy: Double, radius: Double) {
        guard dx.isFinite, dy.isFinite, radius > 0 else { return }
        let nx = dx / radius
        let ny = -dy / radius
        let length = (nx * nx + ny * ny).squareRoot()
        guard length > Self.deadZone else { return }
        let factor = (min(length, 1) - Self.deadZone) / (1 - Self.deadZone) / length
        x = Self.quantize(nx * factor)
        y = Self.quantize(ny * factor)
    }

    init(x: Double = 0, y: Double = 0) {
        self.x = x
        self.y = y
    }

    static func quantize(_ value: Double) -> Double {
        let steps = (value / resolution + (value >= 0 ? 1e-9 : -1e-9)).rounded(.towardZero)
        let result = (steps * resolution * 1_000_000).rounded() / 1_000_000
        return result == 0 ? 0 : result
    }
}

/// Knob position, clamped to the ring (`knobOffset`).
func knobOffset(_ translation: CGSize, radius: CGFloat) -> CGSize {
    let length = (translation.width * translation.width + translation.height * translation.height).squareRoot()
    guard length > radius, length > 0 else { return translation }
    return CGSize(width: translation.width * radius / length, height: translation.height * radius / length)
}

/// Sends press/release exactly once per hold. Covers lift, gesture cancel, connection loss
/// and the view disappearing. A finger that was down while offline stays inert until it
/// lifts, so a reconnect never re-presses (like `CONNECTION_INTERRUPTED_EVENT` on the web).
struct Hold {
    enum Edge: Equatable { case press, release }
    private(set) var down = false
    private var latched = false

    mutating func update(touching: Bool, online: Bool) -> Edge? {
        if !touching { latched = false } else if !online { latched = true }
        let value = touching && online && !latched
        guard value != down else { return nil }
        down = value
        return value ? .press : .release
    }
}

// MARK: - Play model (port of `describePlay`)

struct PlayLayout: Equatable {
    let stick: Bool
    let stickHint: String
    let buttons: [(button: Button, label: String?)]
    /// Minigame title for the small header, `nil` outside minigames (M1 arena).
    let title: String?

    init(actions: [Action], minigame: ControllerMinigameInfo?) {
        let playing = minigame?.stage == .play ? minigame : nil
        let controls = playing?.controls
        stick = actions.contains(.move) && (controls == nil || controls?.joystick != nil)
        stickHint = controls?.joystick.map { "Ziehen: \($0)" } ?? "Ziehen zum Laufen"
        buttons = [(Button.a, Action.buttonA), (.b, .buttonB)].compactMap { button, action in
            guard actions.contains(action) else { return nil }
            guard let controls else { return (button, nil) }
            let label = button == .a ? controls.a : controls.b
            return label.map { (button, $0) }
        }
        title = playing?.title
    }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.stick == rhs.stick && lhs.stickHint == rhs.stickHint && lhs.title == rhs.title
            && lhs.buttons.map(\.button) == rhs.buttons.map(\.button)
            && lhs.buttons.map(\.label) == rhs.buttons.map(\.label)
    }
}

// MARK: - Play panel

struct PlayPanel: View {
    let session: any ControllerSessionProtocol
    let slot: Int
    let context: SlotContext
    let tint: Tint
    let landscape: Bool

    var body: some View {
        let layout = PlayLayout(actions: context.actions, minigame: context.minigame)
        let online = if case .online = session.state.link { true } else { false }
        let labelled = layout.title != nil
        let stick = StickPad(hint: labelled ? layout.stickHint : "Ziehen zum Laufen", tint: tint, online: online) {
            session.moveStick(slot: slot, x: $0.x, y: $0.y)
        }
        let buttons = ButtonArea(buttons: layout.buttons, tint: tint, online: online) { button, edge in
            if edge == .press { session.press(slot: slot, button) } else { session.release(slot: slot, button) }
        }
        VStack(spacing: 12) {
            if let title = layout.title, !landscape {
                MinigameHeader(title: title)
            }
            if landscape {
                HStack(spacing: 16) {
                    if layout.stick || !labelled { stick.frame(maxWidth: .infinity) }
                    if !layout.buttons.isEmpty || !labelled {
                        VStack {
                            if let title = layout.title { MinigameHeader(title: title).padding(.top, 52) }
                            buttons
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            } else {
                if !layout.buttons.isEmpty || !labelled { buttons.frame(maxHeight: .infinity) }
                if layout.stick || !labelled { stick.frame(maxHeight: .infinity) }
            }
        }
    }
}

struct MinigameHeader: View {
    let title: String

    var body: some View {
        HStack(spacing: 8) {
            GameIcon(name: "star", size: 20)
            Text(title).font(.title3.bold()).lineLimit(1)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 40)
        .glass(20)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Floating-origin joystick: the ring jumps to where the thumb lands (`Joystick.tsx`).
private struct StickPad: View {
    let hint: String
    let tint: Tint
    let online: Bool
    let onMove: (StickInput) -> Void
    @GestureState private var drag: DragGesture.Value?
    @State private var hold = Hold()

    var body: some View {
        GeometryReader { geo in
            let size = min(max(min(geo.size.width, geo.size.height) * 0.5, 120), 170)
            let radius = size / 2
            let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
            let origin = drag?.startLocation ?? center
            let knob = knobOffset(drag?.translation ?? .zero, radius: radius)
            ZStack {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(.white.opacity(0.22))
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .strokeBorder(Palette.line, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
                Circle()
                    .fill(Palette.glassStrong)
                    .overlay(Circle().strokeBorder(Palette.line))
                    .shadow(color: .black.opacity(0.28), radius: 14, y: 10)
                    .frame(width: size, height: size)
                    .overlay {
                        Circle()
                            .fill(tint.color)
                            .overlay(Circle().strokeBorder(Palette.line))
                            .background(Circle().fill(tint.color.opacity(0.4)).padding(-6))
                            .frame(width: size * 0.46, height: size * 0.46)
                            .offset(knob)
                    }
                    .position(origin)
                Text(hint)
                    .font(.callout.weight(.semibold))
                    .opacity(drag == nil ? 0.6 : 0)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 10)
            }
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .updating($drag) { value, state, _ in state = value })
            .onChange(of: drag?.translation) { _, translation in
                update(translation, radius: radius)
            }
            .onChange(of: online) { _, _ in update(drag?.translation, radius: radius) }
            .onDisappear { update(nil, radius: radius) }
        }
        .accessibilityElement()
        .accessibilityLabel("Joystick")
        .accessibilityHint(hint)
    }

    /// Every drag change goes to the session (it throttles); lift, cancel or a lost
    /// connection send `(0, 0)` once.
    private func update(_ translation: CGSize?, radius: CGFloat) {
        if hold.update(touching: translation != nil, online: online) == .release { onMove(.zero) }
        if hold.down, let translation {
            onMove(StickInput(dx: translation.width, dy: translation.height, radius: radius))
        }
    }
}

/// A big, B smaller and offset (`'. b' / 'a .'`), one hold per button.
private struct ButtonArea: View {
    let buttons: [(button: Button, label: String?)]
    let tint: Tint
    let online: Bool
    let send: (Button, Hold.Edge) -> Void

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width, geo.size.height)
            let big = min(max(side * 0.42, 96), 150)
            let small = min(max(side * 0.34, 80), 120)
            ZStack {
                ForEach(buttons, id: \.button) { entry in
                    let isA = entry.button == .a
                    let alone = buttons.count == 1
                    PadButton(button: entry.button, label: entry.label, size: alone || isA ? big : small, primary: isA, tint: tint, online: online) {
                        send(entry.button, $0)
                    }
                    .position(
                        x: alone ? geo.size.width / 2 : geo.size.width * (isA ? 0.3 : 0.72),
                        y: alone ? geo.size.height / 2 : geo.size.height * (isA ? 0.68 : 0.3))
                }
            }
        }
    }
}

/// `press` on touch down, `release` on lift or cancel (`ActionButton.tsx`).
private struct PadButton: View {
    let button: Button
    let label: String?
    let size: CGFloat
    let primary: Bool
    let tint: Tint
    let online: Bool
    let send: (Hold.Edge) -> Void
    @GestureState private var touching = false
    @State private var hold = Hold()

    var body: some View {
        let letter = button.rawValue.uppercased()
        VStack(spacing: 0) {
            Text(letter).font(.system(size: size * 0.4, weight: .bold))
            if let label {
                Text(label)
                    .font(.system(size: max(13, size * 0.13), weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 8)
            }
        }
        .foregroundStyle(primary ? tint.on : Palette.ink)
        .frame(width: size, height: size)
        .background {
            if primary {
                Color.clear.primary(tint.color, radius: size / 2)
            } else {
                Circle().fill(.ultraThinMaterial).overlay(Circle().fill(Palette.glassStrong))
                    .overlay(Circle().strokeBorder(Palette.line))
                    .shadow(color: .black.opacity(0.28), radius: 14, y: 10)
            }
        }
        .scaleEffect(hold.down ? 0.94 : 1)
        .brightness(hold.down ? -0.08 : 0)
        .contentShape(Circle())
        .gesture(DragGesture(minimumDistance: 0).updating($touching) { _, state, _ in state = true })
        .onChange(of: touching) { _, _ in update() }
        .onChange(of: online) { _, _ in update() }
        .onDisappear { if hold.update(touching: false, online: online) == .release { send(.release) } }
        .sensoryFeedback(.impact(weight: .light), trigger: hold.down) { _, down in down }
        .accessibilityElement()
        .accessibilityLabel(label.map { "Knopf \(letter): \($0)" } ?? "Knopf \(letter)")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            send(.press)
            send(.release)
        }
    }

    private func update() {
        if let edge = hold.update(touching: touching, online: online) { send(edge) }
    }
}

// MARK: - Minigame intro and result (minigame/view.ts, ui/minigame.tsx)

/// Texts of the minigame card (port of `MinigameIntro`). If the minigame already ran this match
/// (`repeat`, CHAOS-66/CHAOS-128), the intro is short: kicker „Nochmal!“, title and controls,
/// no tagline and no steps (players already know the game).
struct MinigameCardText: Equatable {
    static let repeatKicker = "Nochmal!"

    let kicker: String
    let tagline: String?
    let instructions: [String]

    init(_ minigame: ControllerMinigameInfo) {
        let short = minigame.stage == .intro && minigame.`repeat` == true
        kicker = minigame.stage == .results ? minigame.title : short ? Self.repeatKicker : "Minispiel"
        tagline = short ? nil : minigame.tagline
        instructions = short ? [] : minigame.instructions
    }
}

/// „Bereit“ in the minigame intro (CHAOS-214). The server offers the action `ready` until the
/// slot pressed it and then reports `minigame.ready == true`; without `ready` in the info
/// (older server, fixed intro timer) the intro keeps its old closing line.
enum MinigameIntroReady: Equatable {
    /// Intro does not wait (or no intro): „Gleich geht’s los!“.
    case fixed
    /// Big „Bereit!“ button.
    case offer
    /// Pressed (locally sent or confirmed by the server): wait for the others.
    case waiting

    static let buttonTitle = "Bereit!"
    static let offerHint = "Alles klar? Dann tippe „Bereit!“."
    static let waitingText = "Bereit! Warte auf die anderen …"
    static let fixedText = "Gleich geht’s los!"
    /// Taps right after the intro appears are ignored (fingers still on the board screen).
    static let tapGuard: Duration = .milliseconds(600)

    /// `sent`: tapped locally since the current context arrived.
    init(minigame: ControllerMinigameInfo, actions: [Action], sent: Bool) {
        guard minigame.stage == .intro else {
            self = .fixed
            return
        }
        if minigame.ready == true {
            self = .waiting
        } else if actions.contains(.ready) {
            self = sent ? .waiting : .offer
        } else {
            self = .fixed
        }
    }

    /// Whether a tap at `now` counts, given when the button appeared.
    static func acceptsTap(shownAt: ContinuousClock.Instant, now: ContinuousClock.Instant) -> Bool {
        now - shownAt >= tapGuard
    }
}

/// Thumbs after the minigame (CHAOS-87, CHAOS-219; `describeVote` in `minigame/view.ts`).
/// Voluntary, nothing waits for it. A tap lights up at once (sent); the server confirms it in
/// `minigame.vote` with the next context. Changing the vote works while the results show.
struct MinigameVoting: Equatable {
    static let question = "Hat’s Spaß gemacht?"
    /// Order of the buttons: up first, like the web controller.
    static let options: [Vote] = [.up, .down]

    /// The server offers `rate` right now (results, not paused).
    let open: Bool
    /// Own vote: tapped and unconfirmed, else the server's, else `nil`.
    let selected: Vote?

    init(minigame: ControllerMinigameInfo, actions: [Action], pending: Vote?) {
        let results = minigame.stage == .results
        open = results && actions.contains(.rate)
        selected = pending ?? (results ? minigame.vote : nil)
    }

    static func symbol(_ vote: Vote) -> String { vote == .down ? "👎" : "👍" }
    /// Spoken label (`VOTE_LABELS` in `ui/minigame.tsx`).
    static func label(_ vote: Vote) -> String { vote == .down ? "Daumen runter" : "Daumen hoch" }
}

struct MinigameCard: View {
    let minigame: ControllerMinigameInfo
    let actions: [Action]
    let tint: Tint
    /// `SlotContext.key`: a new context releases the local „sent“ lock.
    let contextKey: String
    let onReady: () -> Void
    /// Thumbs in the results (CHAOS-219).
    let onVote: (Vote) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Label {
                    Text(MinigameCardText(minigame).kicker)
                } icon: {
                    GameIcon(name: "star", size: 24)
                }
                .font(.headline)
                .foregroundStyle(Palette.dim)
                if minigame.stage == .results { result } else { intro }
            }
            .padding(22)
            .frame(maxWidth: 520)
            .glass(28)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    @ViewBuilder private var intro: some View {
        let text = MinigameCardText(minigame)
        Text(minigame.title).font(.largeTitle.bold()).multilineTextAlignment(.center)
            .accessibilityAddTraits(.isHeader)
        if let tagline = text.tagline {
            Text(tagline).font(.title3).foregroundStyle(Palette.dim).multilineTextAlignment(.center)
        }
        if !text.instructions.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(text.instructions.enumerated()), id: \.offset) { index, line in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("\(index + 1).").font(.headline).foregroundStyle(Palette.sun)
                        Text(line).font(.body.weight(.semibold))
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        let legend: [(String, String, String)] = [
            minigame.controls.joystick.map { ("stick", "Joystick", $0) },
            minigame.controls.a.map { ("A", "Knopf A", $0) },
            minigame.controls.b.map { ("B", "Knopf B", $0) },
        ].compactMap { $0 }
        if !legend.isEmpty {
            HStack(spacing: 10) {
                ForEach(legend, id: \.0) { key, spoken, label in
                    HStack(spacing: 8) {
                        if key == "stick" {
                            Circle().strokeBorder(Palette.ink, lineWidth: 2)
                                .overlay(Circle().fill(Palette.ink).padding(9))
                                .frame(width: 34, height: 34)
                        } else {
                            Text(key).font(.headline.bold()).frame(width: 34, height: 34)
                                .background(Circle().fill(Palette.glassStrong))
                        }
                        Text(label).font(.callout.weight(.semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .glass(20, strong: true)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(spoken): \(label)")
                }
            }
        }
        IntroReadyFooter(minigame: minigame, actions: actions, tint: tint, onReady: onReady)
            .id(contextKey)
    }

    @ViewBuilder private var result: some View {
        if minigame.aborted || minigame.place == nil {
            Text("Minispiel abgebrochen").font(.largeTitle.bold()).multilineTextAlignment(.center)
            Text("Keine Wertung – gleich geht’s auf dem Brett weiter.")
                .font(.title3).foregroundStyle(Palette.dim).multilineTextAlignment(.center)
        } else if let place = minigame.place {
            let tied = minigame.tied
            HStack(spacing: 10) {
                if place == 1 { GameIcon(name: "trophy", size: 52) }
                Text(tied ? "Geteilter Platz \(place)!" : "Platz \(place)!").font(.largeTitle.bold())
            }
            .accessibilityElement(children: .combine)
            Text(tied && place == 1 ? "Gemeinsam gewonnen!" : Self.cheers[place] ?? "Gut gespielt!")
                .font(.title2.weight(.semibold))
            if let score = minigame.score {
                Text("\(score.formatted(.number.locale(Locale(identifier: "de_DE")))) \(minigame.scoreUnit)")
                    .font(.title3.weight(.semibold))
            }
            if let reward = minigame.resultRewardText {
                HStack(spacing: 8) {
                    GameIcon(name: "coin", size: 28)
                    Text(reward).font(.title3.bold())
                }
                .accessibilityElement(children: .combine)
            }
            if let prize = minigame.prizeText {
                HStack(spacing: 8) {
                    ForEach(Array((minigame.prizes ?? []).enumerated()), id: \.offset) { _, item in
                        GameIcon(name: item.rawValue, size: 28)
                    }
                    Text(prize).font(.title3.bold()).multilineTextAlignment(.center)
                }
                .accessibilityElement(children: .combine)
            }
            Text(minigame.resultLead).font(.body).foregroundStyle(Palette.dim)
                .multilineTextAlignment(.center)
        }
        ResultVoteFooter(minigame: minigame, actions: actions, tint: tint, onVote: onVote)
            .id(contextKey)
    }

    private static let cheers = [1: "Gewonnen!", 2: "Stark gespielt!", 3: "Gut gemacht!", 4: "Nächstes Mal!"]
}

/// Closing part of the results: thumbs while the server offers `rate`, otherwise the hint to
/// look at the big screen (like `MinigameResult` in `ui/minigame.tsx`).
private struct ResultVoteFooter: View {
    let minigame: ControllerMinigameInfo
    let actions: [Action]
    let tint: Tint
    let onVote: (Vote) -> Void
    /// Tapped, not yet confirmed by the server.
    @State private var pending: Vote?

    var body: some View {
        let voting = MinigameVoting(minigame: minigame, actions: actions, pending: pending)
        if voting.open {
            VStack(spacing: 12) {
                Text(MinigameVoting.question).font(.title3.bold())
                HStack(spacing: 20) {
                    ForEach(MinigameVoting.options, id: \.self) { vote in
                        thumb(vote, selected: voting.selected == vote)
                    }
                }
            }
            .padding(.top, 4)
            .sensoryFeedback(.selection, trigger: pending)
        } else {
            Text(lookAtScreen).font(.callout.weight(.semibold)).foregroundStyle(Palette.dim)
        }
    }

    private func thumb(_ vote: Vote, selected: Bool) -> some View {
        SwiftUI.Button {
            pending = vote
            onVote(vote)
        } label: {
            Text(MinigameVoting.symbol(vote))
                .font(.system(size: 44))
                .frame(width: 96, height: 96)
                .background(Circle().fill(selected ? tint.color : Palette.glassStrong))
                .overlay(
                    Circle().strokeBorder(selected ? Palette.ink : Palette.line, lineWidth: selected ? 3 : 1))
                .scaleEffect(selected ? 1.06 : 1)
                .animation(.easeOut(duration: 0.15), value: selected)
        }
        .buttonStyle(PressStyle())
        .accessibilityLabel(MinigameVoting.label(vote))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Closing line of the intro: fixed text, „Bereit!“ button or waiting note (CHAOS-214).
private struct IntroReadyFooter: View {
    let minigame: ControllerMinigameInfo
    let actions: [Action]
    let tint: Tint
    let onReady: () -> Void
    @State private var sent = false
    @State private var shownAt = ContinuousClock.now
    /// Grace period over: the button looks (and is) tappable.
    @State private var armed = false

    var body: some View {
        switch MinigameIntroReady(minigame: minigame, actions: actions, sent: sent) {
        case .fixed:
            Text(MinigameIntroReady.fixedText).font(.title3.bold())
        case .offer:
            VStack(spacing: 12) {
                Text(MinigameIntroReady.offerHint)
                    .font(.callout.weight(.semibold))
                    .foregroundStyle(Palette.dim)
                    .multilineTextAlignment(.center)
                PrimaryButton(title: MinigameIntroReady.buttonTitle, color: tint.color, onColor: tint.on) {
                    guard !sent, MinigameIntroReady.acceptsTap(shownAt: shownAt, now: .now) else { return }
                    sent = true
                    onReady()
                }
                .disabled(!armed)
                .opacity(armed ? 1 : 0.5)
                .animation(.easeOut(duration: 0.2), value: armed)
                .accessibilityLabel("Bereit")
                .accessibilityHint("Das Minispiel startet, sobald alle bereit sind.")
            }
            .task {
                shownAt = .now
                armed = false
                guard (try? await Task.sleep(for: MinigameIntroReady.tapGuard)) != nil else { return }
                armed = true
            }
        case .waiting:
            Label(MinigameIntroReady.waitingText, systemImage: "checkmark.circle.fill")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Palette.mint)
                .multilineTextAlignment(.center)
                .accessibilityLabel("Bereit. Warte auf die anderen.")
        }
    }
}

extension ControllerMinigameInfo {
    /// Coin reward as text (`rewardText` in `minigame/view.ts`); `nil` without `reward`.
    var rewardText: String? {
        guard let reward else { return nil }
        return switch reward {
        case 0: "Keine Münzen"
        case 1: "+1 Münze"
        default: "+\(reward) Münzen"
        }
    }

    static let resultsLead = "Gleich geht’s auf dem Brett weiter."
    /// Practice round from the gallery (CHAOS-87, `PRACTICE_LEAD` in `minigame/view.ts`).
    static let practiceLead = "Übungsrunde ohne Münzen – gleich geht’s zurück in die Lobby."

    /// Line under the result: board, or back to the lobby after a practice round.
    var resultLead: String { practice == true ? Self.practiceLead : Self.resultsLead }

    /// Coin line of the result: none in a practice round, not even „Keine Münzen“ (CHAOS-87).
    var resultRewardText: String? { practice == true ? nil : rewardText }

    /// Consolation prize line as in the web controller (`ui/minigame.tsx`, CHAOS-51):
    /// „Trostpreis: Falle“, several items comma-separated; `nil` when there is none.
    var prizeText: String? {
        guard let prizes, !prizes.isEmpty else { return nil }
        return "Trostpreis: " + prizes.map(\.displayName).joined(separator: ", ")
    }
}
