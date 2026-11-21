// UI-facing contract of the native controller (CHAOS-115, ADR-017).
//
// Mirrors the web controller: `state/reducer.ts` (state shape), `state/screen.ts`
// (`describeSlotScreen`), `state/errors.ts` (texts, severity), `net/session.ts` (intents,
// timing constants), `input/moveSender.ts` (move throttling), `board/countdown.ts`.
// Agent A implements `ControllerSessionProtocol` against the real server; Agent B builds the
// SwiftUI screens against `FakeControllerSession`. Do not change this file without the
// coordinator: it is the shared contract.
import Foundation
import Observation

// MARK: - Timing (net/session.ts, net/backoff.ts, input/moveSender.ts)

enum SessionTiming {
    /// Heartbeat interval (server disconnects after 15 s of silence).
    static let heartbeat: Duration = .seconds(5)
    /// Connection setup may take this long before it counts as failed.
    static let connectTimeout: Duration = .seconds(5)
    /// No server message at all for this long → connection is dead.
    static let deadAfter: Duration = .seconds(10)
    /// After returning to the foreground a heartbeat answer must arrive this fast.
    static let probeTimeout: Duration = .seconds(2)
    /// Reconnect backoff: 0.5 s, 1 s, 2 s, 4 s, then 5 s, each ±20 % jitter.
    static let backoffStepsMs: [Int] = [500, 1000, 2000, 4000]
    static let backoffMaxMs = 5000
    static let backoffJitter = 0.2
    /// At most one `move` per 33 ms; unchanged values skipped; `(0, 0)` sent immediately;
    /// a deferred value is sent by a trailing timer so the last position is never lost.
    static let moveInterval: Duration = .milliseconds(33)
}

// MARK: - State (state/reducer.ts)

enum ConnectionStatus: Sendable { case idle, connecting, open, closed }

/// Wire `ErrorCode` plus client-only codes (`ClientErrorCode` in `state/errors.ts`).
struct UiErrorCode: OpenStringEnum {
    let rawValue: String
    init(rawValue: String) { self.rawValue = rawValue }
    init(_ code: ErrorCode) { self.init(rawValue: code.rawValue) }
    static let connectionFailed: Self = "connection-failed"
    static let connectionLost: Self = "connection-lost"
    /// Close 4003: another device/connection took over the slot. No auto reconnect.
    static let replaced: Self = "replaced"
    /// `out-of-phase` answering `join`: the game already runs, joining is lobby-only.
    static let gameRunning: Self = "game-running"
    static let known: [Self] =
        ErrorCode.known.map { Self($0) } + [.connectionFailed, .connectionLost, .replaced, .gameRunning]

    enum Severity: Sendable { case silent, toast, code, blocking }
    enum Remedy: Sendable { case retry, updateApp }

    /// Like `errorSeverity`: `code` = back to the join screen, `blocking` = full error screen.
    var severity: Severity {
        switch rawValue {
        case "bad-token", "stale-seq", "paused": .silent
        case "bad-join-code": .code
        case "version-mismatch", "not-joined", "session-full", "host-taken",
            "connection-failed", "connection-lost", "replaced", "game-running":
            .blocking
        default: .toast
        }
    }

    var remedy: Remedy { rawValue == "version-mismatch" ? .updateApp : .retry }

    /// German player-facing text (`errorText`), reworded where the web says "reload the page".
    var text: String {
        switch rawValue {
        case "bad-message", "too-large": "Da ist etwas schiefgelaufen. Verbinde dich neu, falls es hakt."
        case "version-mismatch":
            "App und Spiel passen nicht zusammen. Bitte aktualisiere die App oder nimm den Browser-Controller."
        case "not-joined": "Du bist noch nicht im Spiel. Bitte verbinde dich neu."
        case "bad-join-code": "Diesen Code gibt es nicht. Schau noch mal auf den Fernseher."
        case "session-full": "Das Spiel ist schon voll. Mehr als vier Spieler gehen nicht."
        case "bad-token": "Deine alte Sitzung ist abgelaufen. Du trittst neu bei."
        case "host-taken": "Auf diesem Spiel läuft schon ein anderer Bildschirm."
        case "not-your-slot": "Das ist nicht dein Platz."
        case "out-of-phase": "Das geht gerade nicht. Warte kurz."
        case "stale-seq": "Eine Eingabe kam zu spät an."
        case "rate-limited": "Nicht so hastig! Kurz durchatmen."
        case "invalid-choice": "Zu spät – die Entscheidung ist schon gefallen."
        case "invalid-result": "Das Minispiel-Ergebnis wurde nicht angenommen."
        case "character-taken": "Die Figur hat sich gerade jemand anderes geschnappt."
        case "paused": "Das Spiel ist pausiert."
        case "connection-failed": "Der Spiel-PC ist nicht erreichbar. Bist du im selben WLAN?"
        case "connection-lost": "Die Verbindung zum Spiel-PC ist weg."
        case "replaced": "Dein Platz wird gerade auf einem anderen Gerät oder im Browser gespielt."
        case "game-running":
            "Das Spiel läuft schon. Neue Spieler können erst wieder in der Lobby beitreten."
        default: "Der Spiel-PC hat ein Problem. Versuch es gleich noch mal."
        }
    }
}

/// Open decision with a local deadline (`board/countdown.ts`). Display only: the server
/// alone decides the deadline and answers late choices with `invalid-choice`.
struct ActivePrompt: Equatable, Sendable {
    var info: Prompt
    /// `receivedAt + remainingMs` on the monotonic clock, `nil` = unlimited.
    var deadline: ContinuousClock.Instant?
    /// Full bar length: `remainingMs` of the *first* context with this prompt id.
    var totalMs: Int?

    /// Bar fill 0…1, `nil` without deadline.
    func fraction(at now: ContinuousClock.Instant) -> Double? {
        guard let deadline else { return nil }
        guard let totalMs, totalMs > 0 else { return 0 }
        let left = max(0, Double((deadline - now) / .milliseconds(1)))
        return min(1, left / Double(totalMs))
    }
}

/// Last `context` of a slot (replaces the previous one completely).
struct SlotContext: Equatable, Sendable {
    var phase: Phase
    var layout: Layout
    var actions: [Action]
    var prompt: ActivePrompt?
    var board: ControllerBoardInfo?
    var minigame: ControllerMinigameInfo?
    var lobby: ControllerLobbyInfo?
}

/// A sent, unanswered `choose`: locks the buttons of that prompt.
struct PendingChoice: Equatable, Sendable {
    var promptId: Int
    var option: String
}

/// A sent `pick-character` with its `seq` (`pickSeqs` in `state/reducer.ts`).
struct PickSeq: Equatable, Sendable {
    var seq: Int
    var slot: Int
}

/// Toast; `id` distinguishes equal codes in a row.
struct Notice: Equatable, Sendable {
    var code: UiErrorCode
    var id: Int
    var slot: Int?
}

/// Feedback for a slot (haptic + flash); a new `id` restarts the effect.
struct FeedbackPulse: Equatable, Sendable {
    var kind: FeedbackKind
    var id: Int
}

/// Whole controller state (`ControllerState` in `state/reducer.ts`). Slot-keyed so the
/// shared-iPad step can reuse it; the iPhone shows `players.first`.
struct ControllerState: Equatable, Sendable {
    /// Server + code of the current session, `nil` = join screen.
    var target: JoinTarget?
    var connection: ConnectionStatus = .idle
    /// `welcome` received on the current connection.
    var welcomed = false
    var players: [PlayerInfo] = []
    var contexts: [Int: SlotContext] = [:]
    var feedback: [Int: FeedbackPulse] = [:]
    /// Sent `choose` per slot; released by a context with another/no prompt,
    /// `invalid-choice` or connection loss.
    var choices: [Int: PendingChoice] = [:]
    /// Sent, unconfirmed `pick-character` per slot (highlighted immediately).
    var picks: [Int: CharacterId] = [:]
    /// `seq` of the last sent picks (at most 8): maps `character-taken` to a slot.
    var pickSeqs: [PickSeq] = []
    /// Session token (kept after a connection loss for `reconnect`).
    var sessionToken: String?
    /// Error that owns the whole screen (join screen for `.code`, else error screen).
    var fatal: UiErrorCode?
    var notice: Notice?
    /// Last heartbeat round trip.
    var rttMs: Double?
    /// Running automatic reconnect attempt since the last `welcome` (1, 2, …).
    var attempt = 0
    /// Running counter for `Notice.id` and `FeedbackPulse.id`.
    var counter = 0

    /// The iPhone's own slot.
    var ownSlot: Int? { players.first?.slot }
    var ownContext: SlotContext? { ownSlot.flatMap { contexts[$0] } }
}

// MARK: - Selectors (state/reducer.ts, state/screen.ts)

enum Screen: Equatable, Sendable { case join, connecting, error, controller }

/// Connection indicator: nothing, first connect, online pill, or reconnect overlay.
enum LinkView: Equatable, Sendable {
    case hidden
    case connecting
    case online(rttMs: Double?)
    /// `hadSession` distinguishes "Verbindung verloren" from "PC nicht erreichbar".
    case reconnecting(attempt: Int, hadSession: Bool)
}

/// What a slot shows. Priority: pause, then final results, then layout.
enum SlotScreen: Equatable, Sendable {
    case wait, lobby, lobbyBasic, play, pause, final, minigame, board
}

extension ControllerState {
    var screen: Screen {
        if target == nil { return .join }
        if fatal != nil { return .error }
        if !welcomed && players.isEmpty { return .connecting }
        return .controller
    }

    var link: LinkView {
        if target == nil || fatal != nil { return .hidden }
        if welcomed && connection == .open { return .online(rttMs: rttMs) }
        let hadSession = !players.isEmpty
        if hadSession || attempt > 0 { return .reconnecting(attempt: attempt, hadSession: hadSession) }
        return .connecting
    }

    /// Error text shown on the join screen (wrong code only).
    var joinError: UiErrorCode? { fatal == UiErrorCode(.badJoinCode) ? fatal : nil }

    func slotScreen(_ slot: Int) -> SlotScreen {
        guard let context = contexts[slot] else { return .wait }
        if context.phase == .lobby {
            if context.lobby != nil { return .lobby }
            return context.layout == .lobby ? .lobbyBasic : .wait
        }
        if context.board?.paused == true { return .pause }
        if context.board?.gamePhase == .gameResults && context.layout == .board { return .final }
        switch context.layout {
        case .joystickButtons: return .play
        case .board: return context.minigame != nil ? .minigame : .board
        case .lobby: return .lobbyBasic
        default: return .wait
        }
    }

    /// Own prompt of a slot: only in layout `board` and only if addressed to this slot.
    func ownPrompt(_ slot: Int) -> ActivePrompt? {
        guard let context = contexts[slot], context.layout == .board,
            let prompt = context.prompt, prompt.info.slot == slot
        else { return nil }
        return prompt
    }

    /// Minigame run the slot may rate right now (CHAOS-87): results shown and `rate` offered.
    /// `round` is `board.round` (0 without board info, like the web controller).
    func ratableRun(_ slot: Int) -> (minigameId: String, round: Int)? {
        guard let context = contexts[slot], context.actions.contains(.rate),
            let minigame = context.minigame, minigame.stage == .results
        else { return nil }
        return (minigame.id, context.board?.round ?? 0)
    }

    /// Buttons of the slot's prompt are locked (choice sent, unanswered).
    func isLocked(_ slot: Int) -> Bool {
        guard let prompt = ownPrompt(slot) else { return false }
        return choices[slot]?.promptId == prompt.info.id
    }
}

// MARK: - Session contract

/// What the SwiftUI layer may observe and call. All intents are fire-and-forget: the server
/// answers with a new `context`, `feedback` or `error`, which lands in `state`.
@MainActor
protocol ControllerSessionProtocol: AnyObject, Observable {
    var state: ControllerState { get }

    /// Connect and join (or `reconnect` with a stored token for this target). `name` goes
    /// into `join.names` – the only way to name a player; must satisfy `PlayerName.isValid`
    /// (pass `nil` to keep the slot's color name). Ignored on `reconnect`.
    func join(_ target: JoinTarget, name: String?)
    /// "Jetzt neu verbinden": skip the backoff wait, resume after giving up.
    func retry()
    /// Leave the game: close, forget the token, back to the join screen.
    func leave()
    /// App became active again (`scenePhase == .active`) or the network came back:
    /// probe the socket with a heartbeat (`probeTimeout`) or reconnect immediately.
    func wake()

    /// Sends `ready`: in the lobby, and in the minigame intro while the context offers the
    /// action `ready` (CHAOS-214).
    func setReady(slot: Int)
    func pickCharacter(slot: Int, _ character: CharacterId)
    /// Sends `choose` for the slot's current prompt; `false` if not offered, already locked
    /// or not connected. A sent choice locks the prompt (`state.choices`).
    @discardableResult
    func choose(slot: Int, promptId: Int, option: String) -> Bool
    /// Sends `rate` (thumbs, CHAOS-87/CHAOS-219) for the minigame of the slot's results;
    /// `false` if the context does not offer `rate` or the session is not connected. Sending
    /// again changes the vote; the server confirms it in `minigame.vote`.
    @discardableResult
    func rate(slot: Int, _ vote: Vote) -> Bool
    /// Joystick position, `x²+y² ≤ 1`, screen up = positive `y` (screen y mirrored, `input/joystick.ts`). Throttled
    /// inside the session (`SessionTiming.moveInterval`); call it on every drag change.
    func moveStick(slot: Int, x: Double, y: Double)
    func press(slot: Int, _ button: Button)
    func release(slot: Int, _ button: Button)
    func dismissNotice(id: Int)
}

// MARK: - Fake for previews and UI tests

/// Scripted session: no networking. Set `state` (or pick a `ControllerState` sample) and
/// inspect `sent` for the intents the UI produced.
@MainActor
@Observable
final class FakeControllerSession: ControllerSessionProtocol {
    var state: ControllerState
    private(set) var sent: [String] = []

    init(_ state: ControllerState = ControllerState()) {
        self.state = state
    }

    func join(_ target: JoinTarget, name: String?) {
        sent.append("join \(target.joinCode) \(name ?? "-")")
        state = .lobbySample
    }

    func retry() { sent.append("retry") }
    func leave() {
        sent.append("leave")
        state = ControllerState()
    }
    func wake() { sent.append("wake") }

    func setReady(slot: Int) {
        sent.append("ready \(slot)")
        state.contexts[slot]?.actions.removeAll { $0 == .ready }
        // Like the server: the lobby switches to `wait`, the minigame intro (CHAOS-214)
        // stays and reports the own ready state.
        if state.contexts[slot]?.phase == .lobby {
            state.contexts[slot]?.layout = .wait
        } else if state.contexts[slot]?.minigame?.stage == .intro {
            state.contexts[slot]?.minigame?.ready = true
        }
    }

    func pickCharacter(slot: Int, _ character: CharacterId) {
        sent.append("pick-character \(slot) \(character.rawValue)")
        state.picks[slot] = character
    }

    @discardableResult
    func choose(slot: Int, promptId: Int, option: String) -> Bool {
        guard state.ownPrompt(slot)?.info.id == promptId, !state.isLocked(slot) else { return false }
        sent.append("choose \(slot) \(promptId) \(option)")
        state.choices[slot] = PendingChoice(promptId: promptId, option: option)
        return true
    }

    @discardableResult
    func rate(slot: Int, _ vote: Vote) -> Bool {
        guard let run = state.ratableRun(slot) else { return false }
        sent.append("rate \(slot) \(run.minigameId) \(run.round) \(vote.rawValue)")
        // Like the server: the own vote comes back in the next context.
        state.contexts[slot]?.minigame?.vote = vote
        return true
    }

    func moveStick(slot: Int, x: Double, y: Double) { sent.append("move \(slot) \(x) \(y)") }
    func press(slot: Int, _ button: Button) { sent.append("press \(slot) \(button.rawValue)") }
    func release(slot: Int, _ button: Button) { sent.append("release \(slot) \(button.rawValue)") }

    func dismissNotice(id: Int) {
        if state.notice?.id == id { state.notice = nil }
    }
}

// MARK: - Samples (realistic, schema-valid values)

extension ControllerState {
    private static let sampleTarget = JoinTarget.manual(address: "192.168.1.20", code: "AB12")!
    private static let samplePlayer = PlayerInfo(slot: 1, color: "#0072B2", label: "Blau")

    private static func online(_ context: SlotContext) -> ControllerState {
        var state = ControllerState(target: sampleTarget, connection: .open, welcomed: true)
        state.players = [samplePlayer]
        state.contexts[1] = context
        state.rttMs = 18
        return state
    }

    private static func board(
        _ gamePhase: GamePhase, activeSlot: Int? = 1, paused: Bool = false, place: Int? = nil
    ) -> ControllerBoardInfo {
        ControllerBoardInfo(
            gamePhase: gamePhase, round: 2, rounds: 5, coins: 12, trophies: 1,
            items: [.doubleDice, .shield], activeSlot: activeSlot, place: place, paused: paused,
            character: .cactus, minigameWins: 1, tied: place == nil ? nil : false,
            endedEarly: place == nil ? nil : false)
    }

    private static let sampleMinigame = ControllerMinigameInfo(
        id: "pump-race", title: "Pump-Rennen", tagline: "Wer pumpt am schnellsten?",
        instructions: ["Tippe A so schnell du kannst", "Mit dem Stick lenken"],
        controls: MinigameControls(joystick: "Lenken", a: "Pumpen", b: nil), stage: .intro,
        place: nil, score: nil, scoreUnit: "Pumpstöße", tied: false, aborted: false, reward: nil)

    static let joinSample = ControllerState()

    static let connectingSample = ControllerState(target: sampleTarget, connection: .connecting)

    static let lobbySample = online(
        SlotContext(
            phase: .lobby, layout: .lobby, actions: [.ready, .pickCharacter],
            lobby: ControllerLobbyInfo(
                character: nil, takenCharacters: [.robot],
                takenBy: [TakenCharacter(character: .robot, slot: 2)], rounds: 5)))

    static let lobbyReadySample = online(
        SlotContext(
            phase: .lobby, layout: .wait, actions: [.pickCharacter],
            lobby: ControllerLobbyInfo(
                character: .cactus, takenCharacters: [.robot],
                takenBy: [TakenCharacter(character: .robot, slot: 2)], rounds: 5)))

    static let boardWaitingSample = online(
        SlotContext(phase: .board, layout: .board, actions: [], board: board(.roll, activeSlot: 2)))

    static let rollPromptSample = online(
        SlotContext(
            phase: .board, layout: .board, actions: [.choose],
            prompt: ActivePrompt(
                info: Prompt(
                    id: 7, slot: 1, kind: .roll, title: "Du bist dran!",
                    options: [
                        PromptOption(id: "roll", label: "Würfeln"),
                        PromptOption(id: "item:double-dice", label: "Doppelwürfel", detail: "Zwei Würfel"),
                    ], remainingMs: 15_000),
                deadline: .now + .seconds(15), totalMs: 15_000),
            board: board(.roll)))

    static let targetPromptSample = online(
        SlotContext(
            phase: .board, layout: .board, actions: [.choose],
            prompt: ActivePrompt(
                info: Prompt(
                    id: 8, slot: 1, kind: .target, title: "Wen beklaust du?",
                    options: [
                        PromptOption(id: "slot:2", label: "Orange", slot: 2),
                        PromptOption(id: "slot:3", label: "Grün", slot: 3),
                        PromptOption(id: "cancel", label: "Abbrechen"),
                    ], remainingMs: nil),
                deadline: nil, totalMs: nil),
            board: board(.chooseTarget)))

    static let minigameIntroSample = online(
        SlotContext(
            phase: .board, layout: .board, actions: [], board: board(.minigameIntro, activeSlot: nil),
            minigame: sampleMinigame))

    /// Second run of the same minigame (CHAOS-128): short intro.
    static let minigameIntroRepeatSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.`repeat` = true
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [], board: board(.minigameIntro, activeSlot: nil),
                minigame: minigame))
    }()

    /// CHAOS-214: the intro waits for „Bereit“; the button is offered.
    static let minigameIntroReadySample: ControllerState = {
        var minigame = sampleMinigame
        minigame.ready = false
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [.ready],
                board: board(.minigameIntro, activeSlot: nil), minigame: minigame))
    }()

    /// CHAOS-214: „Bereit“ pressed, waiting for the others.
    static let minigameIntroWaitingSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.ready = true
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [],
                board: board(.minigameIntro, activeSlot: nil), minigame: minigame))
    }()

    static let minigamePlaySample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .play
        return online(
            SlotContext(
                phase: .board, layout: .joystickButtons, actions: [.move, .buttonA],
                board: board(.minigamePlay, activeSlot: nil), minigame: minigame))
    }()

    static let minigameResultsSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .results
        minigame.place = 1
        minigame.score = 42
        minigame.reward = 10
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [],
                board: board(.minigameResults, activeSlot: nil), minigame: minigame))
    }()

    /// Last place with consolation prize (CHAOS-51, CHAOS-127).
    static let minigameConsolationSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .results
        minigame.place = 4
        minigame.score = 17
        minigame.reward = 0
        minigame.prizes = [.trap]
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [],
                board: board(.minigameResults, activeSlot: nil), minigame: minigame))
    }()

    /// Thumbs offered after the minigame (CHAOS-87, CHAOS-219), own vote already given.
    static let minigameVoteSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .results
        minigame.place = 2
        minigame.score = 30
        minigame.reward = 5
        minigame.vote = .up
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [.rate],
                board: board(.minigameResults, activeSlot: nil), minigame: minigame))
    }()

    /// Practice round from the gallery (CHAOS-87): no coin line, back to the lobby.
    static let minigamePracticeSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .results
        minigame.place = 1
        minigame.score = 42
        minigame.practice = true
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [.rate],
                board: board(.minigameResults, activeSlot: nil), minigame: minigame))
    }()

    static let minigameAbortedSample: ControllerState = {
        var minigame = sampleMinigame
        minigame.stage = .results
        minigame.aborted = true
        return online(
            SlotContext(
                phase: .board, layout: .board, actions: [],
                board: board(.minigameResults, activeSlot: nil), minigame: minigame))
    }()

    static let pausedSample = online(
        SlotContext(phase: .board, layout: .board, actions: [], board: board(.roll, paused: true)))

    static let finalSample = online(
        SlotContext(
            phase: .board, layout: .board, actions: [],
            board: board(.gameResults, activeSlot: nil, place: 1)))

    static let reconnectingSample: ControllerState = {
        var state = boardWaitingSample
        state.connection = .closed
        state.welcomed = false
        state.attempt = 2
        return state
    }()

    static let toastSample: ControllerState = {
        var state = lobbySample
        state.notice = Notice(code: UiErrorCode(.characterTaken), id: 1)
        return state
    }()

    static let sessionFullSample = ControllerState(
        target: sampleTarget, connection: .closed, fatal: UiErrorCode(.sessionFull))

    static let versionMismatchSample = ControllerState(
        target: sampleTarget, connection: .closed, fatal: UiErrorCode(.versionMismatch))

    static let badCodeSample = ControllerState(connection: .closed, fatal: UiErrorCode(.badJoinCode))
}
