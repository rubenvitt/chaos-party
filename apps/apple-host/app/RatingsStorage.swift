import Foundation

/// Daumen-Stimmen über App-Neustarts (CHAOS-220). Der JS-Kern hält die Stimmen wie der Node-Server (`apps/server/src/ratings.ts`)
/// und gibt nach jeder Stimme den ganzen Dateiinhalt heraus (`env.saveRatings`); beim Start bekommt er ihn zurück
/// (`env.ratings`). Format wie `~/.chaos-party/minispiel-stimmen.json` am PC, damit sich beide Dateien vergleichen lassen.
///
/// - macOS: `~/Library/Application Support/Chaos Party/minispiel-stimmen.json` (im App-Store-Build im Container der App),
///   geschrieben über eine Zwischendatei (atomar). `--stimmen=<pfad>` nimmt eine andere Datei (Tests, Nachstellen).
/// - tvOS: tvOS-Apps haben keinen dauerhaften Dateispeicher außer `UserDefaults` (höchstens etwa 500 KB). Die Stimmen liegen
///   dort unter `minispielStimmen`; ab `tvOSLimitBytes` bleiben neue Stimmen nur bis zum Beenden (Log-Hinweis).
///
/// Eine unlesbare Datei wird nicht überschrieben, sondern beiseitegelegt (`.kaputt-<ms>`), wie `readRatingsFile` am PC.
/// Nur Foundation: der Harness baut die Datei mit (`harness/run.sh`).
struct RatingsStorage {
    enum Location {
        case file(URL)
        case defaults(UserDefaults, key: String)
    }

    static let fileName = "minispiel-stimmen.json"
    static let defaultsKey = "minispielStimmen"
    /// Reserve unter der Grenze von `UserDefaults` auf tvOS.
    static let tvOSLimitBytes = 400_000

    let location: Location
    let log: (String) -> Void

    /// Ort für diese Plattform; `arguments` für `--stimmen=<pfad>` (nur macOS).
    static func standard(arguments: [String] = CommandLine.arguments, log: @escaping (String) -> Void) -> RatingsStorage {
        #if os(tvOS)
        return RatingsStorage(location: .defaults(.standard, key: defaultsKey), log: log)
        #else
        if let arg = arguments.last(where: { $0.hasPrefix("--stimmen=") }), arg.count > 10 {
            return RatingsStorage(location: .file(URL(fileURLWithPath: String(arg.dropFirst(10)))), log: log)
        }
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let url = base.appendingPathComponent("Chaos Party", isDirectory: true).appendingPathComponent(fileName)
        return RatingsStorage(location: .file(url), log: log)
        #endif
    }

    var description: String {
        switch location {
        case .file(let url): return url.path
        case .defaults(_, let key): return "UserDefaults \(key)"
        }
    }

    /// Gespeicherter Inhalt oder nil (noch nie abgestimmt).
    func load() -> String? {
        switch location {
        case .file(let url):
            guard FileManager.default.fileExists(atPath: url.path) else { return nil }
            do { return try String(contentsOf: url, encoding: .utf8) } catch {
                log("WARN Stimmen nicht lesbar: \(error.localizedDescription)")
                return nil
            }
        case .defaults(let defaults, let key):
            return defaults.string(forKey: key)
        }
    }

    /// Ganzen Inhalt speichern; false, wenn es nicht ging (die Stimmen bleiben im Kern, die Partie läuft weiter).
    @discardableResult
    func save(_ json: String) -> Bool {
        switch location {
        case .file(let url):
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try Data(json.utf8).write(to: url, options: .atomic)
                return true
            } catch {
                log("WARN Stimmen nicht gespeichert: \(error.localizedDescription)")
                return false
            }
        case .defaults(let defaults, let key):
            let bytes = json.utf8.count
            guard bytes <= Self.tvOSLimitBytes else {
                log("WARN Stimmen zu groß für den tvOS-Speicher (\(bytes / 1024) KB), neue bleiben nur bis zum Beenden – bitte exportieren")
                return false
            }
            defaults.set(json, forKey: key)
            return true
        }
    }

    /// Unlesbaren Inhalt beiseitelegen, statt ihn bei der nächsten Stimme zu überschreiben.
    func setAside(reason: String) {
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        switch location {
        case .file(let url):
            let aside = url.deletingLastPathComponent().appendingPathComponent("\(url.lastPathComponent).kaputt-\(stamp)")
            do {
                try FileManager.default.moveItem(at: url, to: aside)
                log("WARN Stimmen-Datei unlesbar (\(reason)), beiseitegelegt als \(aside.path)")
            } catch {
                log("WARN Stimmen-Datei unlesbar (\(reason)), Beiseitelegen ging nicht: \(error.localizedDescription)")
            }
        case .defaults(let defaults, let key):
            defaults.set(defaults.string(forKey: key), forKey: "\(key).kaputt-\(stamp)")
            defaults.removeObject(forKey: key)
            log("WARN Stimmen unlesbar (\(reason)), beiseitegelegt unter \(key).kaputt-\(stamp)")
        }
    }
}
