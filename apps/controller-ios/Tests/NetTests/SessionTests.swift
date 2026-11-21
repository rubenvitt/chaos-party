import Foundation
import Testing

@testable import ChaosControllerKit

@MainActor
final class Harness {
    let network = FakeNetwork()
    let scheduler = ManualScheduler()
    let defaults: UserDefaults
    let session: LiveControllerSession

    init() {
        let suite = "chaos-tests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        // Jitter midpoint: waits are exactly 0.5 s, 1 s, 2 s, 4 s, 5 s.
        session = LiveControllerSession(
            defaults: defaults, makeTransport: network.factory, scheduler: scheduler, random: { 0.5 },
            watchesNetwork: false)
    }

    var tokens: TokenStore { TokenStore(defaults: defaults) }
    var socket: FakeTransport { network.last }
    var state: ControllerState { session.state }

    /// Join and receive `welcome` plus a lobby context.
    func joined(name: String? = nil) {
        session.join(testTarget, name: name)
        socket.open()
        socket.receive(Msg.welcome())
        socket.receive(Msg.lobby())
    }
}

@MainActor
@Suite struct SessionHandshakeTests {
    @Test func joinsAndStoresToken() throws {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        #expect(h.network.transports.count == 1)
        #expect(h.socket.url == testTarget.socketURL)
        #expect(h.state.screen == .connecting)
        h.socket.open()
        #expect(h.socket.messages == [.join(Join(joinCode: "ABCD", seats: 1, names: nil))])
        h.socket.receive(Msg.welcome())
        #expect(h.state.screen == .controller)
        #expect(h.tokens.load(testTarget.storageKey) == testToken)
    }

    @Test func sendsValidNameOnly() {
        let h = Harness()
        h.session.join(testTarget, name: "Jörg")
        h.socket.open()
        #expect(h.socket.messages == [.join(Join(joinCode: "ABCD", seats: 1, names: ["Jörg"]))])
        h.session.join(testTarget, name: " Jörg")
        h.socket.open()
        #expect(h.socket.messages == [.join(Join(joinCode: "ABCD", seats: 1, names: nil))])
    }

    @Test func usesStoredTokenForReconnect() {
        let h = Harness()
        h.tokens.save(testTarget.storageKey, token: "tok_old")
        h.session.join(testTarget, name: "Egal")
        h.socket.open()
        #expect(h.socket.messages == [.reconnect(sessionToken: "tok_old")])
    }

    @Test func ignoresTokenOfOtherTarget() {
        let h = Harness()
        h.tokens.save(otherTarget.storageKey, token: "tok_old")
        h.session.join(testTarget, name: nil)
        h.socket.open()
        #expect(h.socket.types == ["join"])
    }

    @Test func badTokenRejoinsOnNewSocket() {
        let h = Harness()
        h.tokens.save(testTarget.storageKey, token: "tok_old")
        h.session.join(testTarget, name: nil)
        let first = h.socket
        first.open()
        first.receive(Msg.error(.badToken))
        #expect(first.closed)
        #expect(h.network.transports.count == 2)
        #expect(h.tokens.load(testTarget.storageKey) == nil)
        h.socket.open()
        #expect(h.socket.types == ["join"])
        #expect(h.state.fatal == nil)
    }

    @Test func badJoinCodeGivesUpAndReturnsToJoinScreen() {
        let h = Harness()
        h.tokens.save(testTarget.storageKey, token: "tok_old")
        h.session.join(testTarget, name: nil)
        h.socket.open()
        h.socket.receive(Msg.error(.badJoinCode))
        #expect(h.state.screen == .join)
        #expect(h.state.joinError == UiErrorCode(.badJoinCode))
        #expect(h.tokens.load(testTarget.storageKey) == nil)
        #expect(h.socket.closed)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
        h.session.join(otherTarget, name: nil)
        #expect(h.network.transports.count == 2)
        #expect(h.state.screen == .connecting)
    }

    @Test func sessionFullGivesUpUntilRetry() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.socket.open()
        h.socket.receive(Msg.error(.sessionFull))
        #expect(h.state.fatal == UiErrorCode(.sessionFull))
        #expect(h.state.screen == .error)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
        h.session.retry()
        #expect(h.network.transports.count == 2)
        #expect(h.state.fatal == nil)
    }

    @Test func versionMismatchGivesUp() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.socket.open()
        h.socket.receive(Msg.error(.versionMismatch))
        #expect(h.state.fatal == UiErrorCode(.versionMismatch))
        #expect(h.state.fatal?.remedy == .updateApp)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
    }

    @Test func outOfPhaseOnJoinMeansGameRunning() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.socket.open()
        h.socket.receive(Msg.error(.outOfPhase))
        #expect(h.state.fatal == .gameRunning)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
    }

    @Test func toastErrorAfterWelcomeStaysToast() {
        let h = Harness()
        h.joined()
        h.socket.receive(Msg.error(.outOfPhase))
        #expect(h.state.notice?.code == UiErrorCode(.outOfPhase))
        #expect(h.state.screen == .controller)
        #expect(!h.socket.closed)
    }
}

@MainActor
@Suite struct SessionConnectionTests {
    @Test func replacedSlotDoesNotPushBack() {
        let h = Harness()
        h.joined()
        h.socket.drop(code: ProtocolConstants.closeReplaced)
        #expect(h.state.fatal == .replaced)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
        h.session.retry()
        #expect(h.network.transports.count == 2)
        h.socket.open()
        #expect(h.socket.types == ["reconnect"])
    }

    @Test func lossKeepsControllerAndReconnectsWithTokenAndFreshSeq() {
        let h = Harness()
        h.joined()
        h.session.press(slot: 1, .a)
        h.session.release(slot: 1, .a)
        #expect(h.socket.seqs == [1, 2])
        h.socket.drop()
        #expect(h.state.screen == .controller)
        #expect(h.state.link == .reconnecting(attempt: 1, hadSession: true))
        h.session.press(slot: 1, .a)
        h.scheduler.advance(ms: 499)
        #expect(h.network.transports.count == 1)
        h.scheduler.advance(ms: 1)
        #expect(h.network.transports.count == 2)
        h.socket.open()
        #expect(h.socket.messages == [.reconnect(sessionToken: testToken)])
        h.socket.receive(Msg.welcome())
        #expect(h.state.link == .online(rttMs: nil))
        h.session.press(slot: 1, .b)
        #expect(h.socket.seqs == [1])
    }

    @Test func backoffSequenceCountsAttempts() {
        let h = Harness()
        h.joined()
        h.socket.drop()
        var waits: [Int] = []
        for attempt in 1...6 {
            #expect(h.state.attempt == attempt)
            let before = h.network.transports.count
            var waited = 0
            while h.network.transports.count == before && waited < 10_000 {
                h.scheduler.advance(ms: 1)
                waited += 1
            }
            waits.append(waited)
            h.socket.drop()
        }
        #expect(waits == [500, 1000, 2000, 4000, 5000, 5000])
    }

    @Test func heartbeatEveryFiveSecondsAndRtt() throws {
        let h = Harness()
        h.joined()
        h.scheduler.advance(ms: 4_999)
        #expect(!h.socket.types.contains("heartbeat"))
        h.scheduler.advance(ms: 1)
        guard case .heartbeat(let t)? = h.socket.messages.last else {
            Issue.record("kein Herzschlag")
            return
        }
        #expect(t == 5_000)
        h.scheduler.advance(ms: 20)
        h.socket.receive(.heartbeatAck(HeartbeatAck(t: t)))
        #expect(h.state.rttMs == 20)
        h.scheduler.advance(ms: 4_980)
        #expect(h.socket.types.filter { $0 == "heartbeat" }.count == 2)
    }

    @Test func silentSocketIsDeadAfterTenSeconds() {
        let h = Harness()
        h.joined()
        h.scheduler.advance(ms: 9_999)
        #expect(!h.socket.closed)
        h.scheduler.advance(ms: 1)
        #expect(h.socket.closed)
        #expect(h.state.connection == .closed)
        #expect(h.state.attempt == 1)
    }

    @Test func anyServerMessageFeedsTheWatchdog() {
        let h = Harness()
        h.joined()
        h.scheduler.advance(ms: 9_000)
        h.socket.receive(.heartbeatAck(HeartbeatAck(t: 5_000)))
        h.scheduler.advance(ms: 9_000)
        #expect(!h.socket.closed)
    }

    @Test func hangingConnectTimesOutAfterFiveSeconds() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.scheduler.advance(ms: 4_999)
        #expect(!h.socket.closed)
        h.scheduler.advance(ms: 1)
        #expect(h.socket.closed)
        #expect(h.state.link == .reconnecting(attempt: 1, hadSession: false))
    }

    @Test func wakeProbesOpenSocket() {
        let h = Harness()
        h.joined()
        h.session.wake()
        #expect(h.socket.types.last == "heartbeat")
        h.scheduler.advance(ms: 1_999)
        #expect(!h.socket.closed)
        h.scheduler.advance(ms: 1)
        #expect(h.socket.closed)
        #expect(h.state.attempt == 1)
    }

    @Test func wakeProbeAnsweredKeepsSocket() {
        let h = Harness()
        h.joined()
        h.session.wake()
        h.scheduler.advance(ms: 100)
        h.socket.receive(.heartbeatAck(HeartbeatAck(t: 0)))
        h.scheduler.advance(ms: 5_000)
        #expect(!h.socket.closed)
    }

    @Test func wakeDuringBackoffConnectsNow() {
        let h = Harness()
        h.joined()
        h.socket.drop()
        h.scheduler.advance(ms: 1)
        h.session.wake()
        #expect(h.network.transports.count == 2)
        h.scheduler.advance(ms: 1_000)
        #expect(h.network.transports.count == 2)
    }

    @Test func wakeWhileConnectingDoesNothing() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.session.wake()
        #expect(h.network.transports.count == 1)
        #expect(h.socket.sent.isEmpty)
    }

    @Test func retrySkipsBackoffWait() {
        let h = Harness()
        h.joined()
        h.socket.drop()
        h.session.retry()
        #expect(h.network.transports.count == 2)
        h.scheduler.advance(ms: 1_000)
        #expect(h.network.transports.count == 2)
    }

    @Test func leaveClosesForgetsTokenAndStops() {
        let h = Harness()
        h.joined()
        h.session.leave()
        #expect(h.socket.closed)
        #expect(h.state == ControllerState())
        #expect(h.tokens.load(testTarget.storageKey) == nil)
        h.scheduler.advance(by: .seconds(60))
        #expect(h.network.transports.count == 1)
        #expect(h.scheduler.pendingCount == 0)
    }
}

@MainActor
@Suite struct SessionInputTests {
    @Test func nothingIsSentBeforeWelcome() {
        let h = Harness()
        h.session.join(testTarget, name: nil)
        h.socket.open()
        h.session.press(slot: 1, .a)
        h.session.setReady(slot: 1)
        h.session.moveStick(slot: 1, x: 0.5, y: 0)
        #expect(h.socket.types == ["join"])
    }

    @Test func readyAndPickCarrySeq() {
        let h = Harness()
        h.joined()
        h.session.pickCharacter(slot: 1, .cactus)
        h.session.setReady(slot: 1)
        #expect(
            h.socket.messages.suffix(2)
                == [.intent(.pickCharacter(slot: 1, character: .cactus), seq: 1), .intent(.ready(slot: 1), seq: 2)])
        #expect(h.state.picks[1] == .cactus)
        #expect(h.state.pickSeqs == [PickSeq(seq: 1, slot: 1)])
    }

    @Test func chooseOncePerPromptUntilInvalidChoice() {
        let h = Harness()
        h.joined()
        h.socket.receive(Msg.prompt(id: 7))
        #expect(!h.session.choose(slot: 1, promptId: 6, option: "roll"))
        #expect(h.session.choose(slot: 1, promptId: 7, option: "roll"))
        #expect(!h.session.choose(slot: 1, promptId: 7, option: "roll"))
        #expect(h.state.isLocked(1))
        h.socket.receive(Msg.error(.invalidChoice))
        #expect(h.session.choose(slot: 1, promptId: 7, option: "roll"))
        #expect(h.socket.types.filter { $0 == "choose" }.count == 2)
    }

    /// CHAOS-219: thumbs only while the results offer `rate`; `minigameId` and `round` come
    /// from the context, sending again changes the vote.
    @Test func rateOnlyWhileOfferedAndCarriesTheRun() {
        let h = Harness()
        h.joined()
        #expect(!h.session.rate(slot: 1, .up))
        h.socket.receive(Msg.results(actions: []))
        #expect(!h.session.rate(slot: 1, .up))
        h.socket.receive(Msg.results(round: 4))
        #expect(h.session.rate(slot: 1, .up))
        #expect(h.session.rate(slot: 1, .down))
        #expect(!h.session.rate(slot: 2, .up))
        #expect(
            h.socket.messages.suffix(2)
                == [
                    .intent(.rate(slot: 1, minigameId: "pump-race", round: 4, vote: .up), seq: 1),
                    .intent(.rate(slot: 1, minigameId: "pump-race", round: 4, vote: .down), seq: 2),
                ])
        h.socket.receive(Msg.results(round: 4, vote: .down))
        #expect(h.state.contexts[1]?.minigame?.vote == .down)
        h.socket.drop()
        #expect(!h.session.rate(slot: 1, .up))
    }

    @Test func chooseWithoutConnectionLocksNothing() {
        let h = Harness()
        h.joined()
        h.socket.receive(Msg.prompt(id: 7))
        h.socket.drop()
        #expect(!h.session.choose(slot: 1, promptId: 7, option: "roll"))
        #expect(h.state.choices.isEmpty)
    }

    @Test func quickInterleavedInputsKeepStrictlyIncreasingSeq() {
        let h = Harness()
        h.joined()
        h.socket.receive(Msg.play())
        h.session.press(slot: 1, .a)
        h.session.moveStick(slot: 1, x: 0.2, y: 0.1)
        h.session.press(slot: 1, .b)
        h.session.moveStick(slot: 1, x: 0.3, y: 0.1)
        h.session.release(slot: 1, .a)
        h.scheduler.advance(ms: 40)
        h.session.moveStick(slot: 1, x: 0, y: 0)
        h.session.release(slot: 1, .b)
        let seqs = h.socket.seqs
        #expect(seqs == Array(1...seqs.count))
        #expect(
            h.socket.types.filter { $0 != "join" }
                == ["press", "move", "press", "release", "move", "move", "release"])
    }

    @Test func moveIsClampedToUnitLength() {
        let h = Harness()
        h.joined()
        h.session.moveStick(slot: 1, x: 3, y: 4)
        guard case .intent(.move(_, let x, let y), _)? = h.socket.messages.last else {
            Issue.record("kein move")
            return
        }
        #expect((x * x + y * y).squareRoot() <= 1 + ProtocolConstants.stickEpsilon)
        #expect(abs(x - 0.6) < 1e-9 && abs(y - 0.8) < 1e-9)
    }

    @Test func moveThrottleResetsOnNewSocket() {
        let h = Harness()
        h.joined()
        h.session.moveStick(slot: 1, x: 0.5, y: 0)
        h.socket.drop()
        h.session.retry()
        h.socket.open()
        h.socket.receive(Msg.welcome())
        h.session.moveStick(slot: 1, x: 0.5, y: 0)
        #expect(h.socket.types == ["reconnect", "move"])
    }
}

@MainActor
@Suite struct SessionMalformedInputTests {
    @Test func malformedFramesAreDroppedAndSessionStays() throws {
        let h = Harness()
        h.joined()
        let before = h.state
        h.socket.receiveRaw("kein json")
        h.socket.receiveRaw("[1,2]")
        h.socket.receiveRaw(#"{"v":3,"type":"context","slot":1}"#)
        h.socket.receiveRaw(#"{"v":"4","type":"welcome"}"#)
        h.socket.receiveRaw(#"{"type":"welcome"}"#)
        h.socket.receiveRaw(#"{"v":4,"type":"context","slot":1,"phase":"lobby","actions":[]}"#)
        h.socket.receiveRaw(#"{"v":4,"type":"welcome","sessionToken":"x","players":{}}"#)
        h.socket.receiveRaw(String(repeating: " ", count: ProtocolConstants.maxServerMessageLength + 1))
        h.socket.receiveBinary()
        for name in Fixtures.names("invalid") {
            h.socket.receiveRaw(try Fixtures.text("invalid", name))
        }
        #expect(h.state == before)
        #expect(!h.socket.closed)
        #expect(h.state.link == .online(rttMs: nil))
        h.session.setReady(slot: 1)
        #expect(h.socket.types.last == "ready")
    }

    @Test func unknownEnumValuesInContextDecodeAndShowWait() {
        let h = Harness()
        h.joined()
        h.socket.receiveRaw(
            #"{"v":4,"type":"context","slot":1,"phase":"space","layout":"hologram","actions":["teleport"]}"#)
        #expect(h.state.contexts[1]?.layout == Layout(rawValue: "hologram"))
        #expect(h.state.slotScreen(1) == .wait)
        #expect(!h.socket.closed)
        h.socket.receiveRaw(#"{"v":4,"type":"error","code":"brand-new","message":"x"}"#)
        #expect(h.state.notice?.code == UiErrorCode(rawValue: "brand-new"))
        #expect(h.state.screen == .controller)
    }

    @Test func unknownMessageTypeIsIgnored() {
        let h = Harness()
        h.joined()
        let before = h.state
        h.socket.receiveRaw(#"{"v":4,"type":"confetti","amount":3}"#)
        #expect(h.state == before)
    }
}
