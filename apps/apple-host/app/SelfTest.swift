#if os(macOS)
import Foundation
import Network

/// `ChaosHost.app/Contents/MacOS/ChaosHost --selftest` (CHAOS-118): checks the built app as it ships, without a
/// window, so CI can run it on the signed bundle with the Hardened Runtime:
/// the bundled JS core loads in JavaScriptCore, Havok instantiates, the listener serves the controller page and a
/// real WebSocket client (Network.framework, not the app's own code) joins the lobby and gets `welcome`.
/// Exit 0 with `SELBSTTEST OK`, else exit 1 with the missing step. Fails on any problem line in the log.
@MainActor
enum SelfTest {
    private static let timeout: TimeInterval = 60
    private static let minTicks = 300 // 5 s at 60 Hz

    private static let runtime = HostRuntime(deferScene: false)
    private static var started = Date()
    private static var port: UInt16?
    private static var code = ""
    private static var httpOk = false
    private static var welcomeOk = false
    private static var httpCheck: HttpCheck?
    private static var wsCheck: WsCheck?

    static func run() -> Never {
        hostLog("SELBSTTEST startet (\(Bundle.main.bundlePath))")
        #if APP_STORE
        // CHAOS-200: App-Store-Variante ohne Sparkle, dafür in der App Sandbox.
        let sandboxed = ProcessInfo.processInfo.environment["APP_SANDBOX_CONTAINER_ID"] != nil
        hostLog("SELBSTTEST App Store, Sandbox \(sandboxed ? "an" : "aus")")
        if !sandboxed { finish(false, "App Sandbox nicht aktiv") }
        #else
        // CHAOS-156: Sparkle.framework ist eingebettet, signiert und lädt unter der Hardened Runtime.
        hostLog("SELBSTTEST Sparkle \(Updates.sparkleVersion), Feed \(Updates.feed?.url ?? "aus")")
        if Updates.sparkleVersion == "?" { finish(false, "Sparkle.framework nicht geladen") }
        #endif
        // CHAOS-223: Klang-Dateien liegen im Bündel und lassen sich dekodieren (sonst nur Rezepte, unbemerkt).
        let (sounds, unreadable) = SoundBank.decodeAll()
        hostLog("SELBSTTEST Klang-Dateien \(sounds.count)\(unreadable.isEmpty ? "" : ", nicht lesbar: \(unreadable.joined(separator: ", "))")")
        if sounds.isEmpty { finish(false, "keine Klang-Dateien in payload/sounds") }
        if !unreadable.isEmpty { finish(false, "Klang-Dateien nicht lesbar") }
        started = Date()
        runtime.start()
        let timer = Timer(timeInterval: 1.0 / 60, repeats: true) { _ in MainActor.assumeIsolated { step() } }
        RunLoop.main.add(timer, forMode: .common)
        RunLoop.main.run()
        finish(false, "Run-Loop beendet")
    }

    private static func step() {
        runtime.frame(dtMs: 1000.0 / 60) { _ in }
        let problems = hostProblems.withLock { $0 }
        if problems > 0 { finish(false, "\(problems) Problemzeile(n) im Log") }
        if port == nil, let url = URLComponents(string: runtime.overlay.joinUrl), let p = url.port {
            port = UInt16(p)
            code = url.queryItems?.first { $0.name == "code" }?.value ?? ""
            hostLog("SELBSTTEST Port \(p), Code \(code)")
            httpCheck = HttpCheck(port: UInt16(p), path: "/?code=\(code)") { status in
                hostLog("SELBSTTEST HTTP \(status)")
                if status.hasPrefix("HTTP/1.1 200"), status.lowercased().contains("content-type: text/html") {
                    httpOk = true
                } else {
                    finish(false, "Controller-Seite nicht ausgeliefert")
                }
            }
            wsCheck = WsCheck(port: UInt16(p), code: code) { type in
                hostLog("SELBSTTEST WebSocket: \(type)")
                if type == "welcome" { welcomeOk = true } else { finish(false, "Beitritt per WebSocket: \(type)") }
            }
        }
        if httpOk, welcomeOk, runtime.ticks >= minTicks { finish(true, "\(runtime.ticks) Ticks, HTTP 200, welcome") }
        if Date().timeIntervalSince(started) > timeout {
            finish(false, "Zeitlimit \(Int(timeout)) s: Port \(port.map(String.init) ?? "–"), HTTP \(httpOk), welcome \(welcomeOk), Ticks \(runtime.ticks)")
        }
    }

    private static func finish(_ ok: Bool, _ detail: String) -> Never {
        hostLog(ok ? "SELBSTTEST OK – \(detail)" : "SELBSTTEST NICHT OK – \(detail)")
        exit(ok ? 0 : 1)
    }
}

/// Plain HTTP GET over TCP (no URLSession, so App Transport Security plays no part); reports the response head.
private final class HttpCheck {
    private let conn: NWConnection
    private var buffer = Data()
    private let done: @MainActor (String) -> Void

    init(port: UInt16, path: String, done: @escaping @MainActor (String) -> Void) {
        self.done = done
        conn = NWConnection(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
        conn.start(queue: .main)
        let request = "GET \(path) HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
        conn.send(content: Data(request.utf8), completion: .contentProcessed { [weak self] _ in self?.read() })
    }

    private func read() {
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, complete, error in
            guard let self else { return }
            if let data { buffer.append(data) }
            if let end = buffer.range(of: Data("\r\n\r\n".utf8)) {
                report(String(decoding: buffer[..<end.lowerBound], as: UTF8.self))
            } else if complete || error != nil || buffer.count > 65536 {
                report("keine Antwort (\(error.map { "\($0)" } ?? "Verbindung zu"))")
            } else {
                read()
            }
        }
    }

    private func report(_ head: String) {
        conn.cancel()
        MainActor.assumeIsolated { done(head) }
    }
}

/// WebSocket client from Network.framework: joins with one seat and reports `welcome` or the first `error`.
private final class WsCheck {
    private let conn: NWConnection
    private let done: @MainActor (String) -> Void
    private var reported = false

    init(port: UInt16, code: String, done: @escaping @MainActor (String) -> Void) {
        self.done = done
        let parameters = NWParameters.tcp
        parameters.defaultProtocolStack.applicationProtocols.insert(NWProtocolWebSocket.Options(), at: 0)
        conn = NWConnection(to: .url(URL(string: "ws://127.0.0.1:\(port)/ws")!), using: parameters)
        conn.stateUpdateHandler = { [weak self] state in
            switch state {
            case .ready: self?.join(code)
            case .failed(let error), .waiting(let error): self?.report("Verbindung: \(error)")
            default: break
            }
        }
        conn.start(queue: .main)
    }

    private func join(_ code: String) {
        // Protocol version as in packages/protocol/src/version.ts (the harness sends the same).
        let message: [String: Any] = ["v": 4, "type": "join", "joinCode": code, "seats": 1, "names": ["Selbsttest"]]
        let data = try! JSONSerialization.data(withJSONObject: message)
        let context = NWConnection.ContentContext(identifier: "join", metadata: [NWProtocolWebSocket.Metadata(opcode: .text)])
        conn.send(content: data, contentContext: context, isComplete: true, completion: .contentProcessed { [weak self] error in
            if let error { self?.report("Senden: \(error)") } else { self?.receive() }
        })
    }

    private func receive() {
        conn.receiveMessage { [weak self] data, _, _, error in
            guard let self else { return }
            if let error { return report("Empfang: \(error)") }
            guard let data, let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = object["type"] as? String
            else { return receive() } // control frames or empty reads
            switch type {
            case "welcome": report(type)
            case "error": report("error \(object)")
            default: receive() // e.g. lobby broadcasts
            }
        }
    }

    private func report(_ text: String) {
        guard !reported else { return }
        reported = true
        MainActor.assumeIsolated { done(text) }
    }
}
#endif
