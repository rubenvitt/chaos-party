import AVFoundation
import Foundation
import QuartzCore

/// Klänge der Minispiele (CHAOS-190). Die Klänge kommen fertig aus dem JS-Kern (`renderState().minigame.sounds`):
/// `ctx.fx.sound` der Minispiele, „minigame-start“ und Countdown-„tick“ in der Anleitung, „cheer“ im Ergebnis, wie im
/// Browser-Host. Gespielt wird die Aufnahme aus `SoundBank` (CHAOS-223), ersatzweise das Rezept mit derselben Synthese
/// wie die Brett-Klänge (`BoardSounds.synthesize`).
///
/// Anders als auf dem Brett kommen hier viele Klänge kurz hintereinander. Darum 16 eigene Stimmen (`SoundVoices`): Ist
/// keine frei, entfällt der Klang, statt dem Spiel hinterherzulaufen. Summe: Der Browser-Host legt einen Kompressor auf den
/// Master; hier begrenzt Apples Peak-Limiter hinter dem Mischer, damit viele gleichzeitige Klänge (Kuckucks-Klatsche mit
/// vier Spielern) nicht übersteuern.
///
/// `--stumm` schaltet die Klänge ab. Die Audio-Engine startet erst beim ersten Klang.
@MainActor
final class MinigameSounds {
    /// Gleichzeitige Klänge; mehr verwirft der Browser-Host erst bei 32 Stimmen (ein Klang hat 1–5 Stimmen).
    static let voices = 16
    /// So viele Puffer hält der Zwischenspeicher; Minispiele variieren die Tonhöhe auch zufällig.
    private static let cacheLimit = 96

    private let synth = BoardSounds()
    private let muted = CommandLine.arguments.contains("--stumm")
    private let voices = SoundVoices(count: MinigameSounds.voices, limiter: true, label: "Minispiel-Klänge")
    private var cache: [String: AVAudioPCMBuffer] = [:]
    /// Gezeigtes Minispiel (`<runde>-<id>`) und höchste gespielte ID darin.
    private var gameKey = ""
    private var lastId = 0
    private var gamePlayed = 0
    private var gameDropped = 0
    /// Davon als Aufnahme gespielt (CHAOS-223); der Rest als Rezept.
    private var gameFiles = 0
    private var gameNames: [String: Int] = [:]
    /// Gespielte Klänge seit dem Start (auch stumm gezählt).
    private(set) var played = 0

    /// Je Bild: das gezeigte Minispiel (Spiel oder Pause), `nil` außerhalb (Brett, Lobby, Finale).
    func apply(_ m: RenderState.Minigame?) {
        guard let m else {
            finish()
            return
        }
        let key = "\(m.round ?? 0)-\(m.id)"
        if key != gameKey {
            finish()
            gameKey = key
        }
        play(m.sounds ?? [])
    }

    /// Messzeile je Minispiel (Belege ohne Lautsprecher: Simulator, `--bild`).
    private func finish() {
        guard !gameKey.isEmpty else { return }
        let names = gameNames.sorted { $0.key < $1.key }.map { "\($0.key)×\($0.value)" }.joined(separator: " ")
        hostLog("Minispiel-Klänge \(gameKey): \(gamePlayed) gespielt (\(gameFiles) aus Dateien), \(gameDropped) verworfen\(muted ? " (stumm)" : "") – \(names)")
        gameKey = ""
        lastId = 0
        gamePlayed = 0
        gameDropped = 0
        gameFiles = 0
        gameNames = [:]
    }

    private func play(_ cues: [RenderState.SoundCue]) {
        for cue in cues.sorted(by: { $0.id < $1.id }) where cue.id > lastId {
            lastId = cue.id
            played += 1
            gamePlayed += 1
            gameNames[cue.name, default: 0] += 1
            guard !muted else { continue }
            let started: Bool
            if let sample = cue.sample, let buffer = SoundBank.shared.buffer(sample.file) {
                started = voices.play(buffer, rate: sample.rate, volume: sample.gain * BoardSounds.masterVolume)
                gameFiles += 1
            } else {
                let key = "\(cue.name)|\(cue.voices)"
                if cache[key] == nil {
                    if cache.count >= Self.cacheLimit { cache.removeAll(keepingCapacity: true) }
                    cache[key] = synth.synthesize(cue.voices)
                }
                guard let buffer = cache[key] else { continue }
                started = voices.play(buffer)
            }
            if !started { gameDropped += 1 }
        }
    }
}
