// Real controller session: port of `createControllerSession` (`net/session.ts`, ADR-009).
import Foundation
import Network
import Observation
import os

@MainActor
@Observable
final class LiveControllerSession: ControllerSessionProtocol {
    private(set) var state = ControllerState()

    /// One socket; `seq` starts at 1 per socket and is shared across slots.
    @MainActor
    private final class Connection {
        var transport: (any Transport)?
        var isOpen = false
        var seq = 0
    }

    private enum Handshake { case join, reconnect }

    @ObservationIgnored private let tokens: TokenStore
    @ObservationIgnored private let makeTransport: TransportFactory
    @ObservationIgnored private let scheduler: Scheduler
    @ObservationIgnored private let random: () -> Double
    /// Origin of the heartbeat clock `t` (ms since this instant).
    @ObservationIgnored private let start: ContinuousClock.Instant
    @ObservationIgnored private let log = Logger(subsystem: "dev.rubeen.chaosparty.controller", category: "net")
    @ObservationIgnored private var connection: Connection?
    @ObservationIgnored private var heartbeat: ScheduledTimer?
    @ObservationIgnored private var watchdog: ScheduledTimer?
    @ObservationIgnored private var retryTimer: ScheduledTimer?
    @ObservationIgnored private var handshake = Handshake.join
    @ObservationIgnored private var attempt = 0
    /// After a final error no automatic reconnect until `join`/`retry`.
    @ObservationIgnored private var stopped = false
    @ObservationIgnored private var name: String?
    @ObservationIgnored private var moveSenders: [Int: MoveSender] = [:]
    @ObservationIgnored private var pathMonitor: NWPathMonitor?

    init(
        defaults: UserDefaults = .standard,
        makeTransport: @escaping TransportFactory = URLSessionTransport.make,
        scheduler: Scheduler = LiveScheduler(),
        random: @escaping () -> Double = { Double.random(in: 0..<1) },
        watchesNetwork: Bool = true
    ) {
        tokens = TokenStore(defaults: defaults)
        self.makeTransport = makeTransport
        self.scheduler = scheduler
        self.random = random
        start = scheduler.now
        if watchesNetwork {
            let monitor = NWPathMonitor()
            monitor.pathUpdateHandler = { [weak self] path in
                guard path.status == .satisfied else { return }
                MainActor.assumeIsolated { self?.wake() }
            }
            monitor.start(queue: .main)
            pathMonitor = monitor
        }
    }

    isolated deinit {
        pathMonitor?.cancel()
        closeConnection()
        retryTimer?.cancel()
    }

    // MARK: - ControllerSessionProtocol

    func join(_ target: JoinTarget, name: String?) {
        self.name = name.flatMap { PlayerName.isValid($0) ? $0 : nil }
        stopped = false
        attempt = 0
        open(target)
    }

    func retry() {
        stopped = false
        if let target = state.target { open(target) }
    }

    func leave() {
        stopped = true
        attempt = 0
        clearRetry()
        closeConnection()
        tokens.clear()
        state = ControllerState()
    }

    func wake() {
        guard !stopped, let target = state.target else { return }
        if let connection, connection.isOpen {
            // The socket may look open after a freeze but be dead: probe with a heartbeat.
            sendHeartbeat(on: connection)
            armWatchdog(SessionTiming.probeTimeout)
            return
        }
        // Otherwise a connect is running; its timeout applies.
        if connection == nil { open(target) }
    }

    func setReady(slot: Int) {
        send(.ready(slot: slot))
    }

    func pickCharacter(slot: Int, _ character: CharacterId) {
        guard let seq = send(.pickCharacter(slot: slot, character: character)) else { return }
        dispatch(.pickSent(slot: slot, character: character, seq: seq))
    }

    func setAiSeat(slot: Int, seat: Int, strength: String?) {
        send(.aiSeat(slot: slot, seat: seat, strength: strength))
    }

    @discardableResult
    func choose(slot: Int, promptId: Int, option: String) -> Bool {
        // At most one choice per prompt (two fingers, double tap).
        guard state.ownPrompt(slot)?.info.id == promptId, !state.isLocked(slot),
            send(.choose(slot: slot, promptId: promptId, option: option)) != nil
        else { return false }
        dispatch(.choiceSent(slot: slot, promptId: promptId, option: option))
        return true
    }

    @discardableResult
    func rate(slot: Int, _ vote: Vote) -> Bool {
        guard let run = state.ratableRun(slot) else { return false }
        return send(.rate(slot: slot, minigameId: run.minigameId, round: run.round, vote: vote)) != nil
    }

    func moveStick(slot: Int, x: Double, y: Double) {
        let sender =
            moveSenders[slot]
            ?? MoveSender(scheduler: scheduler) { [weak self] stick in
                self?.send(.move(slot: slot, x: stick.x, y: stick.y))
            }
        moveSenders[slot] = sender
        sender.update(Stick(x: x, y: y).clamped)
    }

    func press(slot: Int, _ button: Button) {
        send(.press(slot: slot, button: button))
    }

    func release(slot: Int, _ button: Button) {
        send(.release(slot: slot, button: button))
    }

    func dismissNotice(id: Int) {
        dispatch(.noticeDismissed(id: id))
    }

    // MARK: - Connection

    private func dispatch(_ event: ControllerEvent) {
        let next = ControllerReducer.reduce(state, event)
        if next != state { state = next }
    }

    private func open(_ target: JoinTarget) {
        closeConnection()
        clearRetry()
        dispatch(.connect(target))
        let current = Connection()
        connection = current
        current.transport = makeTransport(target.socketURL) { [weak self, weak current] event in
            guard let self, let current, current === self.connection else { return }
            self.handle(event, on: current, target: target)
        }
        armWatchdog(SessionTiming.connectTimeout)
    }

    private func handle(_ event: TransportEvent, on current: Connection, target: JoinTarget) {
        switch event {
        case .opened:
            current.isOpen = true
            dispatch(.socketOpen)
            if let token = tokens.load(target.storageKey) {
                handshake = .reconnect
                sendRaw(.reconnect(sessionToken: token), on: current)
            } else {
                handshake = .join
                let names = name.map { [$0] }
                sendRaw(.join(Join(joinCode: target.joinCode, seats: 1, names: names)), on: current)
            }
            scheduleHeartbeat(on: current)
            armWatchdog(SessionTiming.deadAfter)
        case .text(let text):
            armWatchdog(SessionTiming.deadAfter)
            do {
                handleMessage(try ServerMessage.decode(text), target: target)
            } catch {
                log.warning("Ungültige Server-Nachricht verworfen: \(String(describing: error), privacy: .public)")
            }
        case .binary:
            armWatchdog(SessionTiming.deadAfter)
            log.warning("Binäre Server-Nachricht verworfen")
        case .closed(let code):
            connection = nil
            if code == ProtocolConstants.closeReplaced {
                // Another device/tab plays this slot now: do not push it back.
                giveUp(.replaced)
            } else {
                lose()
            }
        }
    }

    private func handleMessage(_ message: ServerMessage, target: JoinTarget) {
        let receivedAt = scheduler.now
        switch message {
        case .welcome(let welcome):
            attempt = 0
            tokens.save(target.storageKey, token: welcome.sessionToken)
        case .heartbeatAck(let ack):
            dispatch(.rttMeasured((receivedAt - start) / .milliseconds(1) - ack.t))
        case .error(let error) where !state.welcomed:
            switch error.code {
            case .badToken where handshake == .reconnect:
                // Old token is gone (server restarted, slot released): join anew.
                tokens.clear()
                open(target)
                return
            case .badJoinCode, .sessionFull:
                tokens.clear()
                dispatch(.server(message, receivedAt: receivedAt))
                giveUp(nil)
                return
            case .versionMismatch:
                dispatch(.server(message, receivedAt: receivedAt))
                giveUp(nil)
                return
            case .outOfPhase where handshake == .join:
                // Joining is lobby-only; the game is already running.
                giveUp(.gameRunning)
                return
            default:
                break
            }
        default:
            break
        }
        dispatch(.server(message, receivedAt: receivedAt))
    }

    /// Connection is gone: report it and plan the next attempt.
    private func lose() {
        closeConnection()
        dispatch(.socketClosed)
        scheduleReconnect()
    }

    private func scheduleReconnect() {
        guard !stopped, let target = state.target, retryTimer == nil else { return }
        attempt += 1
        dispatch(.reconnectScheduled(attempt: attempt))
        let delay = backoffDelayMs(attempt: attempt, random: random())
        retryTimer = scheduler.after(.milliseconds(delay)) { [weak self] in
            self?.retryTimer = nil
            self?.open(target)
        }
    }

    private func giveUp(_ reason: UiErrorCode?) {
        stopped = true
        attempt = 0
        clearRetry()
        closeConnection()
        dispatch(reason.map { .gaveUp($0) } ?? .socketClosed)
    }

    private func closeConnection() {
        heartbeat?.cancel()
        heartbeat = nil
        watchdog?.cancel()
        watchdog = nil
        connection?.transport?.close()
        connection = nil
        for sender in moveSenders.values { sender.reset() }
    }

    private func clearRetry() {
        retryTimer?.cancel()
        retryTimer = nil
    }

    private func armWatchdog(_ delay: Duration) {
        watchdog?.cancel()
        // Connect hangs or the socket died silently (frozen app, Wi-Fi gone).
        watchdog = scheduler.after(delay) { [weak self] in
            self?.watchdog = nil
            self?.lose()
        }
    }

    private func scheduleHeartbeat(on current: Connection) {
        heartbeat = scheduler.after(SessionTiming.heartbeat) { [weak self, weak current] in
            guard let self, let current, current === self.connection else { return }
            self.sendHeartbeat(on: current)
            self.scheduleHeartbeat(on: current)
        }
    }

    private func sendHeartbeat(on current: Connection) {
        sendRaw(.heartbeat(t: (scheduler.now - start) / .milliseconds(1)), on: current)
    }

    private func sendRaw(_ message: ControllerMessage, on current: Connection) {
        guard current.isOpen, let transport = current.transport, let text = try? message.encoded() else { return }
        transport.send(text)
    }

    /// Slot input with the next `seq`; `nil` while not joined.
    @discardableResult
    private func send(_ intent: SlotIntent) -> Int? {
        guard state.welcomed, let current = connection, current.isOpen else { return nil }
        current.seq += 1
        sendRaw(.intent(intent, seq: current.seq), on: current)
        return current.seq
    }
}
