import Foundation
import Testing

@testable import ChaosControllerKit

let testTarget = JoinTarget.manual(address: "192.168.1.20", code: "ABCD")!
let otherTarget = JoinTarget.manual(address: "192.168.1.20", code: "WXYZ")!
let testToken = "tok_ABCDEFGHIJKLMNOP"
let blue = PlayerInfo(slot: 1, color: "#0072B2", label: "Blau")

enum Msg {
    static func welcome(_ players: [PlayerInfo] = [blue], token: String = testToken) -> ServerMessage {
        .welcome(Welcome(sessionToken: token, players: players))
    }

    static func lobby(
        slot: Int = 1, layout: Layout = .lobby, character: CharacterId? = nil, taken: [CharacterId] = []
    ) -> ServerMessage {
        .context(
            Context(
                slot: slot, phase: .lobby, layout: layout,
                actions: layout == .lobby ? [.ready, .pickCharacter] : [.pickCharacter],
                lobby: ControllerLobbyInfo(
                    character: character, takenCharacters: taken,
                    takenBy: taken.enumerated().map { TakenCharacter(character: $1, slot: $0 + 2) },
                    rounds: 5)))
    }

    static func board(slot: Int = 1, paused: Bool = false, gamePhase: GamePhase = .roll) -> ControllerBoardInfo {
        ControllerBoardInfo(
            gamePhase: gamePhase, round: 1, rounds: 5, coins: 10, trophies: 0, items: [],
            activeSlot: slot, place: nil, paused: paused, character: .robot, minigameWins: 0,
            tied: nil, endedEarly: nil)
    }

    static func prompt(id: Int, slot: Int = 1, remainingMs: Int? = 10_000) -> ServerMessage {
        .context(
            Context(
                slot: slot, phase: .board, layout: .board, actions: [.choose],
                prompt: Prompt(
                    id: id, slot: slot, kind: .roll, title: "Du bist dran!",
                    options: [PromptOption(id: "roll", label: "Würfeln")], remainingMs: remainingMs),
                board: board(slot: slot)))
    }

    static func boardWaiting(slot: Int = 1) -> ServerMessage {
        .context(Context(slot: slot, phase: .board, layout: .board, actions: [], board: board(slot: 2)))
    }

    static func play(slot: Int = 1) -> ServerMessage {
        .context(
            Context(
                slot: slot, phase: .board, layout: .joystickButtons,
                actions: [.move, .buttonA, .buttonB], board: board(slot: slot, gamePhase: .minigamePlay)))
    }

    /// Minigame results (CHAOS-87): `rate` offered unless `actions` says otherwise.
    static func results(
        slot: Int = 1, actions: [Action] = [.rate], round: Int = 3, vote: Vote? = nil
    ) -> ServerMessage {
        var info = board(slot: slot, gamePhase: .minigameResults)
        info.round = round
        info.activeSlot = nil
        return .context(
            Context(
                slot: slot, phase: .board, layout: .board, actions: actions, board: info,
                minigame: ControllerMinigameInfo(
                    id: "pump-race", title: "Pump-Rennen", tagline: "Wer pumpt am schnellsten?",
                    instructions: ["Tippe A"], controls: MinigameControls(joystick: nil, a: "Pumpen", b: nil),
                    stage: .results, place: 1, score: 42, scoreUnit: "Pumpstöße", tied: false,
                    aborted: false, reward: 10, vote: vote)))
    }

    static func error(_ code: ErrorCode, seq: Int? = nil) -> ServerMessage {
        .error(ServerError(code: code, message: "x", seq: seq))
    }

    static func json(_ message: ServerMessage) -> String {
        String(decoding: try! JSONEncoder().encode(message), as: UTF8.self)
    }
}

/// Manual monotonic time: `advance` fires due timers in order, also ones scheduled while firing.
@MainActor
final class ManualScheduler: Scheduler {
    private let origin = ContinuousClock.now
    private var elapsed: Duration = .zero
    private var timers: [(id: Int, at: Duration, action: @MainActor () -> Void)] = []
    private var nextId = 0

    var now: ContinuousClock.Instant { origin + elapsed }
    var pendingCount: Int { timers.count }

    func after(_ delay: Duration, _ action: @escaping @MainActor () -> Void) -> ScheduledTimer {
        nextId += 1
        let id = nextId
        timers.append((id, elapsed + delay, action))
        return ScheduledTimer { [weak self] in self?.timers.removeAll { $0.id == id } }
    }

    func advance(by duration: Duration) {
        let end = elapsed + duration
        while let next = timers.filter({ $0.at <= end }).min(by: { ($0.at, $0.id) < ($1.at, $1.id) }) {
            timers.removeAll { $0.id == next.id }
            elapsed = next.at
            next.action()
        }
        elapsed = end
    }

    func advance(ms: Int) { advance(by: .milliseconds(ms)) }
}

@MainActor
final class FakeTransport: Transport {
    let url: URL
    private let emit: @MainActor (TransportEvent) -> Void
    private(set) var sent: [String] = []
    private(set) var closed = false

    init(url: URL, emit: @escaping @MainActor (TransportEvent) -> Void) {
        self.url = url
        self.emit = emit
    }

    func send(_ text: String) { sent.append(text) }
    func close() { closed = true }

    func open() { emit(.opened) }
    func receive(_ message: ServerMessage) { emit(.text(Msg.json(message))) }
    func receiveRaw(_ text: String) { emit(.text(text)) }
    func receiveBinary() { emit(.binary) }
    func drop(code: Int? = 1006) { emit(.closed(code: code)) }

    var messages: [ControllerMessage] {
        sent.compactMap { try? JSONDecoder().decode(ControllerMessage.self, from: Data($0.utf8)) }
    }
    var types: [String] { messages.map(\.type) }
    var seqs: [Int] {
        messages.compactMap { if case .intent(_, let seq) = $0 { seq } else { nil } }
    }
}

@MainActor
final class FakeNetwork {
    private(set) var transports: [FakeTransport] = []
    var last: FakeTransport { transports[transports.count - 1] }

    var factory: TransportFactory {
        { [unowned self] url, emit in
            let transport = FakeTransport(url: url, emit: emit)
            self.transports.append(transport)
            return transport
        }
    }
}
