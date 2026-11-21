// Harness für den JS-Kern (CHAOS-138/139): lädt dist/chaos-host.js in ein JSContext (macOS), spielt
// mit zwei simulierten Controllern (echte Protokoll-Nachrichten) eine Partie bis zum ersten
// angenommenen Minispiel-Ergebnis (mit `full`: bis zum Endstand, alle Minispiele der Rotation) und
// misst die Rechenzeit je Tick. Virtuelle Uhr: 60 Ticks je Spielsekunde, ohne zu warten.
// Dekodiert außerdem die Beispielnachrichten (Fixtures/render-state) und jedes geprüfte
// `renderState` mit `app/RenderState.swift`, also genau dem Typ der App.
//
//   apps/apple-host/harness/run.sh [full] [hz=10]  (baut mit swiftc und startet; vorher `pnpm build`)
//   apps/apple-host/harness/run.sh uebung stimmen=<datei> [vorher=N]
//
// `uebung` (CHAOS-220): statt einer Partie eine Übungsrunde aus der Minispiel-Galerie (`practice:<id>`).
// Die Bots stimmen im Ergebnis ab, danach muss die Lobby wiederkommen. Die Stimmen gehen über
// `RatingsStorage` (dieselbe Datei wie in der App) nach `stimmen=<datei>`; ein zweiter Lauf mit derselben
// Datei lädt sie wieder (App-Neustart). `vorher=N`: so viele Stimmen müssen beim Start schon da sein.
//
// `hz=N` (CHAOS-205): nur N Ticks je Spielsekunde wie ein gedrosselter Takt; dann muss jede
// Minispiel-Bühne vor dem Ende des Countdowns fertig sein, sonst Exit 1.
//
// Die Zeiten sind CPU-Zeit dieses Threads. JSC lief hier faktisch ohne JIT (EXP-024); die CI setzt
// zusätzlich JSC_useJIT=false. Ein Apple TV hat einen langsameren Kern, die Zahlen sind also eine
// Untergrenze für tvOS. Exit 1 bei jeder JS-Ausnahme, Problemzeile im Log oder Vertragsbruch.
import Foundation
import JavaScriptCore
import Security

let harnessDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
let dist = harnessDir.deletingLastPathComponent().appendingPathComponent("dist")
let fixtures = harnessDir.appendingPathComponent("Fixtures/render-state")
let full = CommandLine.arguments.contains("full")
/// Übungsrunde aus der Galerie statt einer Partie (CHAOS-220).
let practiceMode = CommandLine.arguments.contains("uebung")
let ratingsStorage = RatingsStorage.standard(
  arguments: CommandLine.arguments.map { $0.hasPrefix("stimmen=") ? "--\($0)" : $0 },
  log: { print("  stimmen: \($0)"); fflush(stdout) })
let votesBeforeArg = CommandLine.arguments.first { $0.hasPrefix("vorher=") }.flatMap { Int($0.dropFirst(7)) }
// Nie die echten Stimmen des Macs anfassen (Application Support): `uebung` braucht eine eigene Datei.
if practiceMode && !CommandLine.arguments.contains(where: { $0.hasPrefix("stimmen=") && $0.count > 8 }) {
  print("FEHLER uebung braucht stimmen=<datei>"); exit(1)
}
/// Ticks je Spielsekunde (`hz=N`); ohne Angabe 60 wie die App.
let hzArg = CommandLine.arguments.first { $0.hasPrefix("hz=") }.flatMap { Double($0.dropFirst(3)) }
let hz = hzArg ?? 60
let joinCode = "AB12"

/// CPU-Zeit dieses Threads in ms: robust, wenn andere Prozesse die Maschine auslasten.
func cpuMs() -> Double {
  var ts = timespec()
  clock_gettime(CLOCK_THREAD_CPUTIME_ID, &ts)
  return Double(ts.tv_sec) * 1000 + Double(ts.tv_nsec) / 1_000_000
}
func out(_ s: String) { print(s); fflush(stdout) }
func fail(_ s: String) -> Never { out("FEHLER " + s); exit(1) }

// Beispielnachrichten des Vertrags (scripts/export-apple-host-fixtures.mjs) mit dem Typ der App dekodieren.
let fixtureFiles = (try? FileManager.default.contentsOfDirectory(at: fixtures, includingPropertiesForKeys: nil))?
  .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent } ?? []
if fixtureFiles.isEmpty { fail("keine Fixtures in \(fixtures.path)") }
for file in fixtureFiles {
  guard let text = try? String(contentsOf: file, encoding: .utf8) else { fail("\(file.lastPathComponent) unlesbar") }
  do {
    let state = try RenderState.decode(text)
    if !RenderState.phases.contains(state.phase) { fail("\(file.lastPathComponent): Phase \(state.phase) unbekannt") }
  } catch { fail("\(file.lastPathComponent): \(error)") }
}
// CHAOS-157: die Einblendung „Sabotage wird stärker!“ kommt in der App an.
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "board-sabotage-notice.json" }) {
  let state = try RenderState.decode(String(contentsOf: file, encoding: .utf8))
  if state.board?.notice?.title != "Sabotage wird stärker!" { fail("board-sabotage-notice.json: Einblendung fehlt") }
} else { fail("board-sabotage-notice.json fehlt") }
// CHAOS-166: Lobby-Einstellungen, 12 ist kein Vorschlag. CHAOS-197: Brett „Zufall“ gewählt.
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "lobby-settings.json" }) {
  let settings = try RenderState.decode(String(contentsOf: file, encoding: .utf8)).lobby?.settings
  if settings?.rounds != 12 || settings?.roundPresets != [10, 16, 20] || settings?.moreReactionTime != true
    || settings?.board != "zufall" || settings?.boards?.filter({ $0.selected }).map({ $0.id }) != ["zufall"] {
    fail("lobby-settings.json: Einstellungen \(String(describing: settings))")
  }
} else { fail("lobby-settings.json fehlt") }
// CHAOS-144: Minispiel-Darstellung – Geometrie dekodiert (z gespiegelt), Figuren, Bildschirme.
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "minigame-play.json" }),
   let m = try RenderState.decode(String(contentsOf: file, encoding: .utf8)).minigame {
  guard let g = m.geometry?.first?.decoded() else { fail("minigame-play.json: Geometrie nicht dekodierbar") }
  if g.positions.count != 4 || g.indices != [0, 1, 2, 0, 2, 3] || g.positions[0] != SIMD3(-0.5, 0, 0.5)
    || g.normals[0] != SIMD3(0, 1, 0) || g.extent != SIMD3(1, 0, 1) {
    fail("minigame-play.json: Geometrie falsch dekodiert: \(g)")
  }
  if m.figures?.count != 2 || m.camera == nil || m.backdrop?.surface != "decke" || m.scoreboard?.scores?.count != 2
    || m.info?.title.isEmpty != false || m.bodies?.first?.mesh != "g1" {
    fail("minigame-play.json: Minispiel-Felder fehlen")
  }
} else { fail("minigame-play.json fehlt") }
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "minigame-results.json" }),
   let rows = try RenderState.decode(String(contentsOf: file, encoding: .utf8)).minigame?.results?.rows {
  if rows.count != 2 || rows[0].coins != 10 || rows[1].prizes != ["Schild"] { fail("minigame-results.json: Ergebnis falsch") }
} else { fail("minigame-results.json: Ergebnis fehlt") }
// CHAOS-220: Übungsergebnis ohne Münzen, mit Hinweis.
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "minigame-practice-results.json" }),
   let state = try? RenderState.decode(String(contentsOf: file, encoding: .utf8)), let results = state.minigame?.results {
  if results.practice != true || results.practiceNote?.isEmpty != false || results.rows?.contains(where: { $0.coins != nil }) != false
    || state.lobby?.galleryRevision != 3 {
    fail("minigame-practice-results.json: Übungsergebnis falsch")
  }
} else { fail("minigame-practice-results.json fehlt") }
// CHAOS-190: Minispiel-Klänge kommen als fertige Rezepte an (Countdown-Tick bei 1 s um × 1,25 höher).
if let file = fixtureFiles.first(where: { $0.lastPathComponent == "minigame-countdown.json" }),
   let sounds = try RenderState.decode(String(contentsOf: file, encoding: .utf8)).minigame?.sounds {
  if sounds.map(\.name) != ["tick", "tick"] || sounds.map({ $0.voices.first?.freq ?? 0 }) != [740, 925] {
    fail("minigame-countdown.json: Klänge falsch: \(sounds)")
  }
} else { fail("minigame-countdown.json: Klänge fehlen") }
out("Fixtures dekodiert: \(fixtureFiles.count) Dateien mit RenderState.swift")

let ctx = JSContext()!
var jsErrors = 0
ctx.exceptionHandler = { _, e in jsErrors += 1; out("JS-EXCEPTION \(e?.toString() ?? "?")") }

// --- env -----------------------------------------------------------------------------------
var outbox: [(Int, String)] = []
var closedByHost: [(Int, Int, String)] = []
var logLines: [String] = []
let send: @convention(block) (Int, String) -> Void = { id, text in outbox.append((id, text)) }
let close: @convention(block) (Int, Int, String) -> Void = { id, code, reason in
  closedByHost.append((id, code, reason))
}
let log: @convention(block) (String) -> Void = { line in logLines.append(line); out("  js: \(line)") }
let randomBytes: @convention(block) (Int) -> [NSNumber] = { n in
  var bytes = [UInt8](repeating: 0, count: n)
  guard SecRandomCopyBytes(kSecRandomDefault, n, &bytes) == errSecSuccess else { fail("SecRandom") }
  return bytes.map { NSNumber(value: $0) }
}
// `env.storage` wie in der App (`hostStorage` in `HostRuntime.swift`, CHAOS-216), nur mit einem Dictionary.
var storedItems: [String: String] = [:]
let getItem: @convention(block) (String) -> String? = { key in storedItems[key] }
let setItem: @convention(block) (String, String) -> Void = { key, value in storedItems[key] = value }
let storage = JSValue(newObjectIn: ctx)!
storage.setValue(unsafeBitCast(getItem, to: AnyObject.self), forProperty: "getItem")
storage.setValue(unsafeBitCast(setItem, to: AnyObject.self), forProperty: "setItem")
ctx.setObject(storage, forKeyedSubscript: "__storage" as NSString)
// Daumen-Stimmen (CHAOS-220) wie in der App über `RatingsStorage`.
var ratingsSaved = 0
var ratingsUnreadableCount = 0
let saveRatings: @convention(block) (String) -> Void = { json in
  if ratingsStorage.save(json) { ratingsSaved += 1 }
}
let ratingsUnreadable: @convention(block) (String) -> Void = { reason in
  ratingsUnreadableCount += 1
  ratingsStorage.setAside(reason: reason)
}
let storedRatings = practiceMode ? ratingsStorage.load() : nil
for (name, value) in [("__send", send as Any), ("__close", close), ("__log", log), ("__randomBytes", randomBytes),
                      ("__saveRatings", saveRatings), ("__ratingsUnreadable", ratingsUnreadable)] {
  ctx.setObject(value, forKeyedSubscript: name as NSString)
}

// Havok-Bytes ohne Kopie als Uint8Array (2 MB als NSNumber-Array wären langsam).
guard let wasm = try? Data(contentsOf: dist.appendingPathComponent("HavokPhysics.wasm")) else {
  fail("dist/HavokPhysics.wasm fehlt – erst `pnpm --filter @chaos-party/apple-host build`")
}
let wasmPtr = UnsafeMutableRawPointer.allocate(byteCount: wasm.count, alignment: 16)
wasm.copyBytes(to: wasmPtr.assumingMemoryBound(to: UInt8.self), count: wasm.count)
let wasmArray = JSObjectMakeTypedArrayWithBytesNoCopy(
  ctx.jsGlobalContextRef, kJSTypedArrayTypeUint8Array, wasmPtr, wasm.count, nil, nil, nil)
ctx.setObject(JSValue(jsValueRef: wasmArray, in: ctx), forKeyedSubscript: "__havokWasm" as NSString)
ctx.setObject(storedRatings.map { $0 as Any } ?? NSNull(), forKeyedSubscript: "__ratings" as NSString)

guard let bundle = try? String(contentsOf: dist.appendingPathComponent("chaos-host.js"), encoding: .utf8)
else { fail("dist/chaos-host.js fehlt – erst `pnpm --filter @chaos-party/apple-host build`") }
var t0 = Date()
ctx.evaluateScript(bundle, withSourceURL: dist.appendingPathComponent("chaos-host.js"))
out("Bündel geladen: \(bundle.utf8.count / 1024) KiB in \(Int(Date().timeIntervalSince(t0) * 1000)) ms")

// Selbstprüfung des base64url-Shims gegen Foundation.
let sample: [UInt8] = [0, 1, 2, 250, 251, 252, 253, 254, 255, 42, 7]
for n in 0...sample.count {
  let bytes = Array(sample.prefix(n))
  let js = ctx.objectForKeyedSubscript("ChaosHostInternals").invokeMethod("base64url", withArguments: [
    ctx.evaluateScript("Uint8Array.from(\(bytes))")!,
  ])!.toString()!
  let swift = Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
    .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  if js != swift { fail("base64url(\(bytes)) = \(js), erwartet \(swift)") }
}
out("base64url-Shim stimmt mit Foundation überein")
let rotation = (ctx.objectForKeyedSubscript("ChaosHostInternals").objectForKeyedSubscript("rotation").toArray() ?? [])
  .compactMap { $0 as? String }
if rotation.isEmpty { fail("ChaosHostInternals.rotation fehlt") }
out("Rotation: \(rotation.joined(separator: ", "))")

t0 = Date()
let host = ctx.evaluateScript("""
  ChaosHost.create({ send: __send, close: __close, log: __log, randomBytes: __randomBytes,
    havokWasm: __havokWasm, joinUrl: 'http://192.168.0.2:8080/?code=\(joinCode)', joinCode: '\(joinCode)',
    storage: __storage, ratings: __ratings, saveRatings: __saveRatings, ratingsUnreadable: __ratingsUnreadable })
  """)!
out("create in \(Int(Date().timeIntervalSince(t0) * 1000)) ms")
if host.isUndefined { fail("ChaosHost.create lieferte nichts") }

// CHAOS-216: Minispiel umschalten über `hostCommand`, Stand in `env.storage`. Sperren, dann Favorit (hebt die Sperre
// auf), dann Favorit zurück: Am Ende ist nichts markiert, damit die ganze Partie jedes Minispiel aufbaut.
func lobbyMinigames() -> [RenderState.LobbyMinigame] {
  guard let json = host.invokeMethod("renderState", withArguments: [])?.toString(),
        let state = try? RenderState.decode(json) else { fail("renderState in der Lobby nicht dekodierbar") }
  return state.lobby?.settings?.minigames ?? []
}
if lobbyMinigames().map(\.id) != rotation { fail("lobby.settings.minigames \(lobbyMinigames().map(\.id)) ≠ Rotation \(rotation)") }
let storageKey = "chaos-party:minigame-rotation"
for (cmd, blocked, favorite) in [("minigame:blocked=\(rotation[0])", true, false),
                                 ("minigame:favorite=\(rotation[0])", false, true),
                                 ("minigame:favorite=\(rotation[0])", false, false)] {
  _ = host.invokeMethod("hostCommand", withArguments: [cmd])
  let game = lobbyMinigames().first { $0.id == rotation[0] }
  if game?.blocked != blocked || game?.favorite != favorite { fail("\(cmd): Stand \(String(describing: game))") }
  guard let saved = storedItems[storageKey].flatMap({ try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: [String]] })
  else { fail("\(cmd): nichts in env.storage[\(storageKey)]") }
  if saved["blocklist"] != (blocked ? [rotation[0]] : []) || saved["favorites"] != (favorite ? [rotation[0]] : []) {
    fail("\(cmd): env.storage \(saved)")
  }
}
out("Minispiel-Rotation: Sperren/Favorit über hostCommand, Stand in env.storage")

// --- Controller ------------------------------------------------------------------------------
final class Controller {
  let id: Int
  let name: String
  let character: String
  var seq = 0
  var slot: Int?
  var actions: [String] = []
  var answered = Set<Int>()
  var lastHeartbeat = 0.0
  var lastInput = 0.0
  var pressed = false
  var picked = false
  /// Minispiel und Runde, zu denen der Bot schon abgestimmt hat (CHAOS-220).
  var voted: String?
  init(id: Int, name: String, character: String) {
    self.id = id; self.name = name; self.character = character
  }
  func nextSeq() -> Int { seq += 1; return seq }
}

func json(_ object: [String: Any]) -> String {
  String(data: try! JSONSerialization.data(withJSONObject: object), encoding: .utf8)!
}
func callHost(_ method: String, _ args: [Any]) -> JSValue? { host.invokeMethod(method, withArguments: args) }
func sendTo(_ c: Controller, _ type: String, _ fields: [String: Any]) {
  var message: [String: Any] = ["v": 4, "type": type]
  message.merge(fields) { _, new in new }
  _ = callHost("message", [c.id, json(message)])
}

let controllers = [Controller(id: 1, name: "Anna", character: "raccoon"),
                   Controller(id: 2, name: "Ben", character: "sock")]
var now = 0.0
var minigameAccepted = false
var errorsFromServer = 0

func handle(_ c: Controller, _ text: String) {
  guard let m = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
        let type = m["type"] as? String else { fail("unlesbar: \(text)") }
  switch type {
  case "welcome":
    let players = m["players"] as! [[String: Any]]
    c.slot = players[0]["slot"] as? Int
    out("[\(Int(now)) ms] \(c.name): welcome, Slot \(c.slot!)")
  case "context":
    c.actions = m["actions"] as? [String] ?? []
    guard let slot = c.slot else { return }
    if c.actions.contains("pick-character") && !c.picked {
      c.picked = true
      sendTo(c, "pick-character", ["slot": slot, "seq": c.nextSeq(), "character": c.character])
    } else if c.actions.contains("ready") && c.picked {
      sendTo(c, "ready", ["slot": slot, "seq": c.nextSeq()])
    }
    // CHAOS-220: in der Übung stimmen die Bots im Ergebnis ab (Anna hoch, Ben runter) wie der Web-Controller.
    if practiceMode, c.actions.contains("rate"), let minigame = m["minigame"] as? [String: Any],
       let id = minigame["id"] as? String, let round = (m["board"] as? [String: Any])?["round"] as? Int,
       c.voted != "\(id):\(round)" {
      c.voted = "\(id):\(round)"
      sendTo(c, "rate", ["slot": slot, "seq": c.nextSeq(), "minigameId": id, "round": round, "vote": c.id == 1 ? "up" : "down"])
    }
    if c.actions.contains("choose"), let prompt = m["prompt"] as? [String: Any],
       let promptId = prompt["id"] as? Int, !c.answered.contains(promptId),
       let option = (prompt["options"] as? [[String: Any]])?.first?["id"] as? String {
      c.answered.insert(promptId)
      sendTo(c, "choose", ["slot": slot, "seq": c.nextSeq(), "promptId": promptId, "option": option])
    }
  case "error":
    errorsFromServer += 1
    out("[\(Int(now)) ms] \(c.name): error \(m["code"] ?? "?") \(m["message"] ?? "")")
  default:
    break
  }
}

func drain() {
  while !outbox.isEmpty || !closedByHost.isEmpty {
    let batch = outbox; outbox = []
    for (id, text) in batch {
      guard let c = controllers.first(where: { $0.id == id }) else { fail("send an unbekannte Verbindung \(id)") }
      handle(c, text)
    }
    for (id, code, reason) in closedByHost { fail("Host schließt Verbindung \(id): \(code) \(reason)") }
  }
}

/// Eingaben im Minispiel: Stick im Kreis (10/s), A alle 0,4 s abwechselnd drücken/loslassen.
func play(_ c: Controller) {
  guard let slot = c.slot else { return }
  if now - c.lastHeartbeat >= 5000 {
    c.lastHeartbeat = now
    sendTo(c, "heartbeat", ["t": now])
  }
  guard now - c.lastInput >= 100 else { return }
  c.lastInput = now
  if c.actions.contains("move") {
    let angle = now / 700 + Double(slot)
    sendTo(c, "move", ["slot": slot, "seq": c.nextSeq(), "x": cos(angle), "y": sin(angle)])
  }
  if c.actions.contains("button-a"), Int(now / 100) % 4 == slot {
    c.pressed.toggle()
    sendTo(c, c.pressed ? "press" : "release", ["slot": slot, "seq": c.nextSeq(), "button": "a"])
  }
}

// --- Ablauf ----------------------------------------------------------------------------------
struct Stat { var n = 0; var sum = 0.0; var max = 0.0
  mutating func add(_ v: Double) { n += 1; sum += v; max = Swift.max(max, v) }
  var text: String { n == 0 ? "-" : String(format: "Ø %.3f ms, max %.2f ms (n=%d)", sum / Double(n), max, n) }
}
var tickStats: [String: Stat] = [:]
var renderStats: [String: Stat] = [:]
/// JS-Zeit je Bild: `tick` + `renderState` (CHAOS-205, Bildbudget 16,7 ms bei 60 Hz).
var frameStats: [String: Stat] = [:]
var lastPhase = ""
var lastStage = ""
var started = false
var printedMidPlay = false
var resultsSeenAfterAccept = false
var frame = 0
var maxRound = 0
var plannedRounds = 0
/// Rundenzahl über `configure` (CHAOS-166); `full` bleibt bei 10, damit alle Minispiele der Rotation drankommen.
let configuredRounds = full ? 10 : 12
var configured = false
/// `renderState` mit dem Typ der App dekodieren und die Lobby-Einstellungen prüfen.
func expectSettings(_ rounds: Int, _ more: Bool, _ label: String) {
  let text = callHost("renderState", [])!.toString()!
  guard let settings = (try? RenderState.decode(text))?.lobby?.settings else { fail("\(label): lobby.settings fehlt") }
  if settings.rounds != rounds || settings.moreReactionTime != more || settings.roundPresets?.isEmpty != false {
    fail("\(label): \(settings), erwartet \(rounds) Runden, mehr Zeit \(more)")
  }
}
let step = 1000.0 / hz
/// CHAOS-205: Minispiele, deren Bühne beim Wechsel Anleitung → Spiel schon stand, und alle.
var readyAtPlay = 0
var playsSeen = 0
let limitMs = full ? 30 * 60_000.0 : 5 * 60_000.0

for c in controllers {
  _ = callHost("open", [c.id])
  sendTo(c, "join", ["joinCode": joinCode, "seats": 1, "names": [c.name]])
}
drain()

/// CHAOS-220: Galerie mit dem Typ der App holen.
func fetchGallery(_ label: String) -> GalleryState {
  let text = callHost("gallery", [])?.toString() ?? ""
  do { return try GalleryState.decode(text) } catch { fail("\(label): gallery() nicht dekodierbar: \(error) – \(text.prefix(200))") }
}
/// Stimmen in einer gespeicherten Datei (`{ version, votes }`), ohne den Kern.
func storedVoteCount(_ text: String?) -> Int {
  guard let text, let data = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any],
        let votes = data["votes"] as? [Any] else { return 0 }
  return votes.count
}
var practiceTarget: String?
var practiceVotesBefore = 0
var practiceTargetBefore = 0
var practiceResultsOk = false
var practiceBackInLobby = false

var geometryDecoded = 0
/// CHAOS-190: Klänge je Minispiel, jede ID einmal (wie die App sie spielt).
var soundsByGame: [String: [String: Int]] = [:]
var lastSoundId = 0
while now < limitMs {
  now += step
  RunLoop.current.run(until: Date())  // GC-Zeitgeber von JSC laufen über die Run-Loop (wie in der App)
  var t = cpuMs()
  _ = callHost("tick", [now + 123_456_789])  // großer Startwert wie CACurrentMediaTime()*1000
  let tickMs = cpuMs() - t
  drain()
  for c in controllers { play(c) }
  drain()
  t = cpuMs()
  let stateText = callHost("renderState", [])!.toString()!
  let renderMs = cpuMs() - t
  guard let state = try? JSONSerialization.jsonObject(with: Data(stateText.utf8)) as? [String: Any],
        let phase = state["phase"] as? String else { fail("renderState unlesbar: \(stateText.prefix(200))") }
  let minigame = state["minigame"] as? [String: Any]
  if logLines.contains(where: { $0.contains("angenommen") }) { minigameAccepted = true }
  let stageName = minigame?["stage"] as? String ?? ""
  let key = phase == "minigame" ? "minigame-\(stageName)" : phase
  tickStats[key, default: Stat()].add(tickMs)
  renderStats[key, default: Stat()].add(renderMs)
  frameStats[key, default: Stat()].add(tickMs + renderMs)

  frame += 1
  // CHAOS-144: jede Geometrie kommt genau einmal; alle müssen mit RenderState.swift dekodierbar sein.
  if let entries = minigame?["geometry"] as? [Any], !entries.isEmpty {
    guard let decoded = try? RenderState.decode(stateText), let list = decoded.minigame?.geometry else {
      fail("renderState mit Geometrie nicht dekodierbar")
    }
    for entry in list {
      if entry.decoded() == nil { fail("Geometrie \(entry.id) (\(decoded.minigame?.id ?? "?")) nicht dekodierbar") }
      geometryDecoded += 1
    }
  }
  if let cues = minigame?["sounds"] as? [[String: Any]], let game = minigame?["id"] as? String {
    for cue in cues {
      guard let id = cue["id"] as? Int, id > lastSoundId, let name = cue["name"] as? String else { continue }
      lastSoundId = id
      soundsByGame[game, default: [:]][name, default: 0] += 1
    }
  }
  if phase != lastPhase || stageName != lastStage || frame % 60 == 0 {
    do {
      let decoded = try RenderState.decode(stateText)
      if !RenderState.phases.contains(decoded.phase) { fail("renderState: Phase \(decoded.phase) unbekannt") }
      maxRound = max(maxRound, decoded.board?.round ?? 0)
      if let rounds = decoded.board?.rounds { plannedRounds = rounds }
    } catch {
      fail("renderState passt nicht zu RenderState.swift: \(error) – \(stateText.prefix(300))")
    }
  }
  if phase == "minigame", stageName == "play", lastStage != "play" {
    playsSeen += 1
    let ready = minigame?["ready"] as? Bool == true
    if ready { readyAtPlay += 1 } else { out("  Bühne \(minigame?["id"] ?? "?") beim Spielstart noch nicht fertig") }
  }
  if phase != lastPhase || stageName != lastStage {
    out("[\(Int(now)) ms] Phase \(lastPhase.isEmpty ? "-" : lastPhase) → \(phase)\(stageName.isEmpty ? "" : " (\(stageName))")")
    if phase == "board" && lastPhase == "lobby", let board = state["board"] as? [String: Any] {
      let spaces = (board["spaces"] as? [Any])?.count ?? 0
      out("  board: Runde \(board["round"]!)/\(board["rounds"]!), \(spaces) Felder, Figuren \(json(["p": board["pawns"]!]))")
    }
    if phase == "minigame", stageName == "results" {
      out("  minigame: \(minigame?["id"] ?? "?") hud=\(minigame?["hud"] ?? "")")
      if minigameAccepted { resultsSeenAfterAccept = true }
    }
    lastPhase = phase; lastStage = stageName
  }
  // CHAOS-220: Übungsrunde aus der Galerie statt einer Partie.
  if practiceMode, !started, let lobby = state["lobby"] as? [String: Any], let players = lobby["players"] as? [[String: Any]],
     players.count == 2, players.allSatisfy({ $0["ready"] as? Bool == true }) {
    started = true
    configured = true
    let gallery = fetchGallery("Lobby")
    let stored = storedVoteCount(storedRatings)
    out("[\(Int(now)) ms] Galerie: \(gallery.rows.count) Minispiele, \(gallery.votes ?? -1) Stimmen (Datei: \(stored), \(ratingsStorage.description))")
    if gallery.rows.isEmpty { fail("Galerie leer") }
    if gallery.votes != stored { fail("Galerie hat \(gallery.votes ?? -1) Stimmen, Datei \(stored)") }
    if let expected = votesBeforeArg, stored != expected { fail("vorher \(stored) Stimmen, erwartet \(expected)") }
    // Ein Spiel der Rotation (die Team-Testspiele der Galerie kann der Apple-Host erst mit CHAOS-230 werten).
    guard let target = gallery.rows.first(where: { $0.status == "rotation" && rotation.contains($0.id) }) else {
      fail("kein Spiel der Rotation in der Galerie")
    }
    practiceTarget = target.id
    practiceVotesBefore = gallery.votes ?? 0
    practiceTargetBefore = (target.up ?? 0) + (target.down ?? 0)
    _ = callHost("hostCommand", ["practice:gibt-es-nicht"])
    if !logLines.contains("Host-Befehl practice:gibt-es-nicht ignoriert: Minispiel nicht in der Galerie") {
      fail("practice mit unbekanntem Spiel nicht abgewiesen")
    }
    out("[\(Int(now)) ms] Übe \(target.title) (\(target.id)), vorher \(practiceTargetBefore) Stimmen")
    _ = callHost("hostCommand", ["practice:\(target.id)"])
    drain()
  }
  if practiceMode, phase == "minigame", stageName == "results", !practiceResultsOk,
     let results = try? RenderState.decode(stateText).minigame?.results, results.headline != nil {
    let rows = results.rows ?? []
    if results.practice != true || results.practiceNote?.isEmpty != false { fail("Übungsergebnis ohne practice/practiceNote") }
    if rows.isEmpty || rows.contains(where: { $0.coins != nil }) { fail("Übungsergebnis mit Münzen oder ohne Plätze: \(rows)") }
    practiceResultsOk = true
    out("[\(Int(now)) ms] Übungsergebnis: \(results.headline ?? "") – \(results.practiceNote ?? "")")
  }
  if practiceMode, practiceResultsOk, phase == "lobby" {
    practiceBackInLobby = true
    out("[\(Int(now)) ms] zurück in der Lobby")
    break
  }
  if !practiceMode, !started, let lobby = state["lobby"] as? [String: Any], let players = lobby["players"] as? [[String: Any]],
     players.count == 2, players.allSatisfy({ $0["ready"] as? Bool == true }) {
    started = true
    out("[\(Int(now)) ms] Lobby: \(json(["players": players]))")
    // CHAOS-166: Einstellungen wie die Lobby der App (beides, dann nur die Runden), Ungültiges ändert nichts.
    expectSettings(10, false, "Lobby vor configure")
    _ = callHost("hostCommand", ["configure:rounds=16,moreReactionTime=1"])
    drain()
    expectSettings(16, true, "configure:rounds=16,moreReactionTime=1")
    _ = callHost("hostCommand", ["configure:rounds=\(configuredRounds)"])
    _ = callHost("hostCommand", ["configure:rounds=99"])
    drain()
    expectSettings(configuredRounds, true, "configure:rounds=\(configuredRounds)")
    if !logLines.contains("Ungültiger Host-Befehl: configure:rounds=99") { fail("configure:rounds=99 nicht abgewiesen") }
    configured = true
    out("[\(Int(now)) ms] configure: \(configuredRounds) Runden, mehr Zeit zum Reagieren an")
    _ = callHost("hostCommand", ["start"])
    drain()
    // In der Brettphase geht configure ins Leere (kein Server-Fehler).
    _ = callHost("hostCommand", ["configure:rounds=3"])
    drain()
    if !logLines.contains("Host-Befehl configure:rounds=3 ignoriert: nur in der Lobby") { fail("configure im Brett gesendet") }
  }
  if stageName == "play", !printedMidPlay, (minigame?["elapsedMs"] as? Double ?? 0) > 1500 {
    printedMidPlay = true
    let bodies = minigame?["bodies"] as? [[String: Any]] ?? []
    let shapes = Dictionary(grouping: bodies, by: { $0["shape"] as? String ?? "?" }).mapValues(\.count)
    out("  minigame \(minigame?["id"] ?? "?") nach \(minigame?["elapsedMs"] ?? 0) ms: \(bodies.count) Körper \(shapes), hud=\(minigame?["hud"] ?? "")")
    for body in bodies.prefix(4) { out("    \(json(body))") }
    out("  renderState: \(stateText.utf8.count / 1024) KiB")
  }
  if !full && !practiceMode && resultsSeenAfterAccept { break }
  if full && phase == "final" { out("[\(Int(now)) ms] Endstand erreicht"); break }
}

if practiceMode {
  // CHAOS-220: Übungsrunde, Daumen gespeichert, zurück in der Lobby; die Datei überlebt den Prozess.
  guard let target = practiceTarget else { fail("Übung nie gestartet") }
  if !practiceResultsOk { fail("kein Übungsergebnis gesehen") }
  if !practiceBackInLobby { fail("nach der Übung nicht zurück in der Lobby") }
  let gallery = fetchGallery("nach der Übung")
  let row = gallery.rows.first { $0.id == target }
  let after = (row?.up ?? 0) + (row?.down ?? 0)
  let stored = storedVoteCount(ratingsStorage.load())
  out("Galerie nach der Übung: \(target) \(row?.up ?? 0)× hoch, \(row?.down ?? 0)× runter (\(row?.votesText ?? "")), insgesamt \(gallery.votes ?? 0) Stimmen, Datei \(stored), gespeichert \(ratingsSaved)×")
  if after != practiceTargetBefore + 2 || gallery.votes != practiceVotesBefore + 2 { fail("Daumen der Bots fehlen in der Galerie") }
  if stored != practiceVotesBefore + 2 || ratingsSaved != 2 { fail("Stimmen nicht gespeichert (Datei \(stored), gespeichert \(ratingsSaved)×)") }
  let problems = logLines.filter { line in ["Fehler", "ERROR", "fehlgeschlagen", "abgelehnt", "noch nicht geladen"].contains { line.contains($0) } }
  for line in problems.prefix(10) { out("  PROBLEM \(line.prefix(200))") }
  let ok = problems.isEmpty && jsErrors == 0 && errorsFromServer == 0 && ratingsUnreadableCount == 0
  out(ok ? "ERGEBNIS: OK" : "ERGEBNIS: NICHT OK (Probleme \(problems.count), JS-Ausnahmen \(jsErrors), Server-Fehler \(errorsFromServer))")
  exit(ok ? 0 : 1)
}
if geometryDecoded == 0 { fail("keine Minispiel-Geometrie dekodiert") }
// CHAOS-190: je Minispiel Start der Anleitung, „go“, „win“ und Jubel im Ergebnis. Ticks: In der
// wartenden Anleitung (CHAOS-214) tickt jedes „Bereit“ statt des Countdowns, bei zwei Bots also 2×.
out("Minispiel-Klänge (jede ID einmal):")
for (game, names) in soundsByGame.sorted(by: { $0.key < $1.key }) {
  out("  \(game): " + names.sorted { $0.key < $1.key }.map { "\($0.key)×\($0.value)" }.joined(separator: " "))
  let expected = ["minigame-start": 1, "tick": 2, "go": 1, "win": 1, "cheer": 1]
  for (name, count) in expected where (names[name] ?? 0) < count {
    fail("\(game): Klang \(name) \(names[name] ?? 0)×, erwartet mindestens \(count)×")
  }
}
if soundsByGame.isEmpty { fail("keine Minispiel-Klänge im renderState") }
out("Minispiel-Geometrien dekodiert: \(geometryDecoded)")
out("Bühne vor Countdown-Ende fertig: \(readyAtPlay)/\(playsSeen) bei \(Int(hz)) Hz")
if hzArg != nil && readyAtPlay < playsSeen { fail("Bühne nicht immer vor dem Countdown-Ende fertig (\(Int(hz)) Hz)") }
out("\nCPU-Zeit je Tick (macOS-JSC, faktisch ohne JIT; Apple TV langsamer):")
for key in tickStats.keys.sorted() {
  out("  \(key): tick \(tickStats[key]!.text); renderState \(renderStats[key]!.text); Bild max \(String(format: "%.2f", frameStats[key]!.max)) ms")
}
out("Virtuelle Spielzeit \(Int(now / 1000)) s, Server-Fehler an Controller: \(errorsFromServer), JS-Ausnahmen: \(jsErrors)")
// Fehler, die der Kern nur loggt (die Partie liefe trotzdem bis zum Ende weiter).
let problems = logLines.filter { line in
  ["Fehler", "ERROR", "fehlgeschlagen", "Laufzeit wertet", "nicht mehr gebraucht", "abgelehnt",
   "noch nicht geladen"].contains { line.contains($0) }
}
let builtIds = logLines.compactMap { line -> String? in
  guard line.hasPrefix("Minispiel "), line.contains("aufgebaut") else { return nil }
  return line.split(separator: " ").dropFirst().first.map(String.init)
}
let built = builtIds.count
let missing = rotation.filter { !builtIds.contains($0) }
let accepted = logLines.filter { $0.contains("angenommen") }.count
out("Runden: \(maxRound)/\(plannedRounds), Minispiele aufgebaut: \(built) (\(builtIds.joined(separator: ", "))), Ergebnisse angenommen: \(accepted), Problemzeilen: \(problems.count)")
if full && !missing.isEmpty { out("FEHLT aus der Rotation: \(missing.joined(separator: ", "))") }
for line in problems.prefix(10) { out("  PROBLEM \(line.prefix(200))") }
if plannedRounds != configuredRounds { fail("Partie hat \(plannedRounds) Runden, configure sagte \(configuredRounds)") }
let fullOk = lastPhase == "final" && built == accepted && missing.isEmpty && plannedRounds > 0 && maxRound == plannedRounds
let ok = configured && problems.isEmpty && accepted >= 1 && minigameAccepted && resultsSeenAfterAccept && jsErrors == 0
  && errorsFromServer == 0 && (!full || fullOk)
out(ok ? "ERGEBNIS: OK" : "ERGEBNIS: NICHT OK (Ergebnis angenommen: \(minigameAccepted), Ergebnisanzeige: \(resultsSeenAfterAccept))")
exit(ok ? 0 : 1)
