import Foundation
import Testing

@testable import ChaosControllerKit

private final class BundleToken {}

enum Fixtures {
    static let root: URL = {
        guard let url = Bundle(for: BundleToken.self).url(forResource: "Fixtures", withExtension: nil) else {
            preconditionFailure("Fixtures-Ordner fehlt im Test-Bundle")
        }
        return url
    }()

    static func files(_ folder: String) throws -> [URL] {
        try FileManager.default
            .contentsOfDirectory(at: root.appendingPathComponent(folder), includingPropertiesForKeys: nil)
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    static func names(_ folder: String) -> [String] {
        ((try? files(folder)) ?? []).map(\.lastPathComponent)
    }

    static func text(_ folder: String, _ name: String) throws -> String {
        try String(contentsOf: root.appendingPathComponent(folder).appendingPathComponent(name), encoding: .utf8)
    }
}

/// Swift treats `null` and a missing key alike, so compare without `null` values.
private func stripNulls(_ value: Any) -> Any {
    if let object = value as? [String: Any] {
        return object.filter { !($0.value is NSNull) }.mapValues(stripNulls)
    }
    if let array = value as? [Any] { return array.map(stripNulls) }
    return value
}

private func jsonObject(_ data: Data) throws -> NSDictionary {
    try #require(stripNulls(try JSONSerialization.jsonObject(with: data)) as? NSDictionary)
}

@Suite struct FixtureTests {
    @Test func corpusIsPresent() {
        #expect(Fixtures.names("server-to-controller").count >= 20)
        #expect(Fixtures.names("controller-to-server").count >= 13)
        #expect(!Fixtures.names("invalid").isEmpty)
    }

    @Test(arguments: Fixtures.names("server-to-controller"))
    func serverMessageRoundTrips(_ name: String) throws {
        let text = try Fixtures.text("server-to-controller", name)
        let message = try ServerMessage.decode(text)
        if case .unknown(let type) = message { Issue.record("unbekannter Typ \(type)") }
        let encoded = try JSONEncoder().encode(message)
        #expect(try jsonObject(encoded) == jsonObject(Data(text.utf8)))
    }

    @Test(arguments: Fixtures.names("controller-to-server"))
    func controllerMessageRoundTrips(_ name: String) throws {
        let data = Data(try Fixtures.text("controller-to-server", name).utf8)
        let message = try JSONDecoder().decode(ControllerMessage.self, from: data)
        let encoded = Data(try message.encoded().utf8)
        let original = try #require(try JSONSerialization.jsonObject(with: data) as? NSDictionary)
        let back = try #require(try JSONSerialization.jsonObject(with: encoded) as? NSDictionary)
        #expect(back == original)
    }

    @Test(arguments: Fixtures.names("unknown-type"))
    func unknownTypeIsSkipped(_ name: String) throws {
        let message = try ServerMessage.decode(try Fixtures.text("unknown-type", name))
        #expect(message == .unknown(type: "lobby"))
    }

    @Test(arguments: Fixtures.names("invalid"))
    func invalidMessageIsRejected(_ name: String) throws {
        let text = try Fixtures.text("invalid", name)
        let base = (name as NSString).deletingPathExtension
        do {
            _ = try ServerMessage.decode(text)
            Issue.record("angenommen: \(name)")
        } catch let error as ProtocolDecodingError {
            switch error {
            case .tooLarge: #expect(base == "too-large")
            case .badMessage: #expect(base.hasPrefix("bad-message-"))
            case .versionMismatch: #expect(base.hasPrefix("version-mismatch-"))
            }
        }
    }

    /// Consolation prize (CHAOS-51, CHAOS-127): `prizes` decodes; without it the field is `nil`.
    @Test func minigamePrizesAreDecoded() throws {
        let withPrize = try ServerMessage.decode(
            try Fixtures.text("server-to-controller", "context-minigame-results-prize.json"))
        guard case .context(let context) = withPrize else {
            Issue.record("kein Kontext")
            return
        }
        #expect(context.minigame?.prizes == [.trap])
        #expect(context.minigame?.reward == 0)

        let withoutPrize = try ServerMessage.decode(
            try Fixtures.text("server-to-controller", "context-minigame-results.json"))
        guard case .context(let plain) = withoutPrize else {
            Issue.record("kein Kontext")
            return
        }
        #expect(plain.minigame?.prizes == nil)
    }

    /// v4 addendum (CHAOS-66/CHAOS-128): optional `repeat`, missing = full intro.
    @Test func minigameRepeatFlagIsDecoded() throws {
        func minigame(_ name: String) throws -> ControllerMinigameInfo? {
            guard case .context(let context) = try ServerMessage.decode(try Fixtures.text("server-to-controller", name))
            else { return nil }
            return context.minigame
        }
        #expect(try minigame("context-minigame-intro-repeat.json")?.`repeat` == true)
        let full = try #require(try minigame("context-minigame-intro.json"))
        #expect(full.`repeat` == nil)
    }

    /// v4 addendum (CHAOS-214): optional `ready` in the intro plus the offered action `ready`;
    /// missing = intro with fixed timer.
    @Test func minigameIntroReadyIsDecoded() throws {
        func context(_ name: String) throws -> Context? {
            guard case .context(let context) = try ServerMessage.decode(try Fixtures.text("server-to-controller", name))
            else { return nil }
            return context
        }
        let offered = try #require(try context("context-minigame-intro-ready.json"))
        #expect(offered.minigame?.ready == false)
        #expect(offered.actions == [.ready])
        let done = try #require(try context("context-minigame-intro-ready-done.json"))
        #expect(done.minigame?.ready == true)
        #expect(done.actions.isEmpty)
        #expect(try context("context-minigame-intro.json")?.minigame?.ready == nil)
    }

    /// v4 addendum (CHAOS-89, Swift: CHAOS-229): own role in team and koop minigames, shaped
    /// like the server integration test (`minigameTeams.integration.test.ts`).
    @Test func minigameTeamIsDecoded() throws {
        func team(_ name: String) throws -> ControllerMinigameTeam? {
            guard case .context(let context) = try ServerMessage.decode(try Fixtures.text("server-to-controller", name))
            else { return nil }
            return context.minigame?.team
        }
        let twoVsTwo = try #require(try team("context-minigame-team-2v2-intro.json"))
        #expect(twoVsTwo.layout == .twoVsTwo)
        #expect(twoVsTwo.role == .team)
        #expect(twoVsTwo.index == 1)
        #expect(twoVsTwo.mates == [3])
        #expect(twoVsTwo.opponents == [2, 4])
        #expect(!twoVsTwo.advantage)
        #expect(twoVsTwo.result == nil)
        #expect(twoVsTwo.tier == nil)

        let solo = try #require(try team("context-minigame-team-1v2-advantage-intro.json"))
        #expect(solo.layout == .oneVsTwo)
        #expect(solo.role == .solo)
        #expect(solo.mates.isEmpty)
        #expect(solo.opponents == [2, 3])
        #expect(solo.advantage)

        let won = try #require(try team("context-minigame-team-2v2-results.json"))
        #expect(won.result == .won)
        #expect(won.tier == nil)

        let koop = try #require(try team("context-minigame-koop-results.json"))
        #expect(koop.layout == .koop)
        #expect(koop.role == .koop)
        #expect(koop.opponents.isEmpty)
        #expect(koop.tier == 2)
        #expect(koop.result == nil)
    }

    /// Older servers and every-player-for-themselves minigames send no `team`: nothing changes.
    @Test func minigameWithoutTeamStaysPlain() throws {
        for name in ["context-minigame-intro.json", "context-minigame-results.json"] {
            guard case .context(let context) = try ServerMessage.decode(try Fixtures.text("server-to-controller", name))
            else {
                Issue.record("kein Kontext: \(name)")
                continue
            }
            #expect(context.minigame != nil)
            #expect(context.minigame?.team == nil)
        }
    }

    @Test func enumsMatchProtocolConstants() throws {
        let data = Data(try Fixtures.text(".", "protocol-constants.json").utf8)
        let constants = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let enums = try #require(constants["enums"] as? [String: [String]])
        let swift: [String: [String]] = [
            "phases": Phase.known.map(\.rawValue),
            "layouts": Layout.known.map(\.rawValue),
            "actions": Action.known.map(\.rawValue),
            "feedbackKinds": FeedbackKind.known.map(\.rawValue),
            "errorCodes": ErrorCode.known.map(\.rawValue),
            "gamePhases": GamePhase.known.map(\.rawValue),
            "itemKinds": ItemKind.known.map(\.rawValue),
            "promptKinds": PromptKind.known.map(\.rawValue),
            "characterIds": CharacterId.known.map(\.rawValue),
            "minigameStages": MinigameStage.known.map(\.rawValue),
            "minigameTeamLayouts": MinigameTeamLayout.known.map(\.rawValue),
            "buttons": Button.allCases.map(\.rawValue),
            "gestureKinds": GestureKind.allCases.map(\.rawValue),
        ]
        #expect(Set(enums.keys) == Set(swift.keys))
        for (key, values) in swift { #expect(enums[key] == values, "\(key)") }
        #expect(constants["version"] as? Int == ProtocolConstants.version)
        let limits = try #require(constants["limits"] as? [String: Double])
        #expect(limits["maxMessageLength"] == Double(ProtocolConstants.maxMessageLength))
        #expect(limits["maxServerMessageLength"] == Double(ProtocolConstants.maxServerMessageLength))
        #expect(limits["maxNameLength"] == Double(ProtocolConstants.maxNameLength))
        #expect(limits["maxPlayers"] == Double(ProtocolConstants.maxPlayers))
        #expect(limits["stickEpsilon"] == ProtocolConstants.stickEpsilon)
        #expect(limits["minigameKoopMaxTier"] == Double(ProtocolConstants.minigameKoopMaxTier))
    }
}

@Suite struct JoinTargetTests {
    @Test func qrLinkUppercasesCode() throws {
        let target = try #require(JoinTarget.fromScannedURL("http://192.168.1.20:8787/?code=ab12"))
        #expect(target.socketURL.absoluteString == "ws://192.168.1.20:8787/ws")
        #expect(target.joinCode == "AB12")
    }

    @Test func httpsLinkUsesWss() throws {
        let target = try #require(JoinTarget.fromScannedURL("https://pc.local:9443/?code=AB12&seats=2"))
        #expect(target.socketURL.absoluteString == "wss://pc.local:9443/ws")
    }

    @Test func ipv6KeepsBrackets() throws {
        let target = try #require(JoinTarget.fromScannedURL("http://[fe80::1]:8787/?code=AB12"))
        #expect(target.socketURL.absoluteString == "ws://[fe80::1]:8787/ws")
    }

    @Test func manualEntryDefaultsPortAndNormalizesCode() throws {
        let target = try #require(JoinTarget.manual(address: " 192.168.1.20 ", code: " ab-12 "))
        #expect(target.socketURL.absoluteString == "ws://192.168.1.20:8787/ws")
        #expect(target.joinCode == "AB12")
        let withPort = try #require(JoinTarget.manual(address: "192.168.1.20:9000", code: "AB12"))
        #expect(withPort.socketURL.absoluteString == "ws://192.168.1.20:9000/ws")
    }

    @Test(arguments: [
        "http://192.168.1.20:8787/?code=A",
        "http://192.168.1.20:8787/?code=AB-12",
        "http://192.168.1.20:8787/",
        "ftp://192.168.1.20/?code=AB12",
        "http:///?code=AB12",
        "kein link",
    ])
    func invalidLinkIsRejected(_ text: String) {
        #expect(JoinTarget.fromScannedURL(text) == nil)
    }

    @Test func invalidManualEntryIsRejected() {
        #expect(JoinTarget.manual(address: "192.168.1.20", code: "A1") == nil)
        #expect(JoinTarget.manual(address: "ftp://192.168.1.20", code: "AB12") == nil)
        #expect(JoinTarget.manual(address: "", code: "AB12") == nil)
    }

    @Test func storageKeySeparatesServerAndCode() throws {
        let a = try #require(JoinTarget.manual(address: "192.168.1.20", code: "AB12"))
        let b = try #require(JoinTarget.manual(address: "192.168.1.21", code: "AB12"))
        #expect(a.storageKey != b.storageKey)
        #expect(a.storageKey.hasSuffix("|AB12"))
    }

    @Test func playerNameRules() {
        #expect(PlayerName.isValid("Jörg"))
        #expect(!PlayerName.isValid(" x"))
        #expect(!PlayerName.isValid(""))
        #expect(!PlayerName.isValid(String(repeating: "😀", count: 9)))
        #expect(PlayerName.isValid(String(repeating: "😀", count: 8)))
        #expect(!PlayerName.isValid("a\u{202E}b"))
        #expect(!PlayerName.isValid("a\nb"))
    }
}
