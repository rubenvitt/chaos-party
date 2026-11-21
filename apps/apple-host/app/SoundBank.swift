import AVFoundation
import Foundation

/// Klang-Dateien (CHAOS-223): die CC0-Aufnahmen aus `packages/assets/sounds/`, von `prepare.sh` nach `payload/sounds/`.
/// Welche Datei ein Klang spielt, entscheidet der JS-Kern (`SoundCue.sample`, wie im Browser-Host); hier liegen sie nur
/// dekodiert bereit: mono, 44,1 kHz, Float wie die synthetisierten Rezepte, damit beide über dieselben Stimmen laufen.
///
/// Geladen wird einmal beim Start auf einer Hintergrund-Queue (rund 40 kurze MP3s, wenige Millisekunden je Datei), nicht beim
/// ersten Abspielen: Das Dekodieren soll kein Bild kosten (CHAOS-141/209). Bis eine Datei da ist, spielt ihr Rezept.
/// `--stumm` lädt nichts.
@MainActor
final class SoundBank {
    static let shared = SoundBank()

    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var started = false
    /// Geladene Dateien (für Log und Selbsttest).
    var count: Int { buffers.count }

    func buffer(_ file: String) -> AVAudioPCMBuffer? { buffers[file] }

    /// Ordner mit den Klang-Dateien im Bündel.
    nonisolated static var directory: URL? {
        Bundle.main.url(forResource: "payload", withExtension: nil)?.appending(path: "sounds")
    }

    /// Im Hintergrund laden; mehrfacher Aufruf schadet nicht.
    func preload() {
        guard !started, !CommandLine.arguments.contains("--stumm") else { return }
        started = true
        DispatchQueue.global(qos: .utility).async {
            let start = Date()
            let (loaded, failed) = SoundBank.decodeAll()
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    SoundBank.shared.buffers = loaded
                    if loaded.isEmpty {
                        hostLog("Klang-Dateien: keine in payload/sounds – Rezepte als Ersatz")
                    } else {
                        hostLog("Klang-Dateien: \(loaded.count) geladen in \(ms) ms\(failed.isEmpty ? "" : ", nicht lesbar: \(failed.joined(separator: ", "))")")
                    }
                }
            }
        }
    }

    /// Alle Dateien dekodieren (Hintergrund oder Selbsttest). Liefert die Puffer und die Namen, die nicht lesbar waren.
    nonisolated static func decodeAll() -> ([String: AVAudioPCMBuffer], [String]) {
        guard let dir = directory,
              let names = try? FileManager.default.contentsOfDirectory(atPath: dir.path(percentEncoded: false))
        else { return ([:], []) }
        var loaded: [String: AVAudioPCMBuffer] = [:]
        var failed: [String] = []
        for name in names.sorted() where name.hasSuffix(".mp3") {
            if let buffer = decode(dir.appending(path: name)) {
                loaded[name] = buffer
            } else {
                failed.append(name)
            }
        }
        return (loaded, failed)
    }

    /// Datei → Puffer im Format der Stimmen (mono, `BoardSounds.sampleRate`, Float).
    nonisolated static func decode(_ url: URL) -> AVAudioPCMBuffer? {
        guard let file = try? AVAudioFile(forReading: url),
              let target = AVAudioFormat(standardFormatWithSampleRate: BoardSounds.sampleRate, channels: 1),
              let input = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)),
              (try? file.read(into: input)) != nil
        else { return nil }
        if input.format == target { return input }
        guard let converter = AVAudioConverter(from: input.format, to: target) else { return nil }
        let ratio = target.sampleRate / input.format.sampleRate
        let capacity = AVAudioFrameCount(Double(input.frameLength) * ratio) + 1024
        guard let output = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return nil }
        var fed = false
        var error: NSError?
        let status = converter.convert(to: output, error: &error) { _, outStatus in
            if fed {
                outStatus.pointee = .endOfStream
                return nil
            }
            fed = true
            outStatus.pointee = .haveData
            return input
        }
        return status == .error || output.frameLength == 0 ? nil : output
    }
}
