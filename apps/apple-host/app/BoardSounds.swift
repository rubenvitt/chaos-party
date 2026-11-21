import AVFoundation
import Foundation

/// Klänge der Brett-Regie (CHAOS-143), auch Pause und Finale. Die Klänge kommen fertig aus dem JS-Kern
/// (`renderState().board.sounds`, Quelle `apps/host/src/fx/sounds.ts` samt Zuordnung `boardSounds.ts`), in dem Moment,
/// in dem die Regie das Ereignis abspielt.
///
/// Seit CHAOS-223 spielt jeder Klang eine echte Aufnahme (CC0, `SoundBank`, Wahl samt Tonhöhe und Lautstärke aus dem Kern
/// wie im Browser-Host). Das Rezept bleibt als Ersatz, solange die Dateien laden oder wenn eine fehlt; es wird synthetisiert
/// wie `apps/host/src/fx/audio.ts` es mit WebAudio tut: Oszillator oder Rauschen, Tonhöhe gleitet exponentiell, Hüllkurve
/// (linear an, exponentiell aus), optional ein Biquad-Filter.
///
/// `--stumm` schaltet die Klänge ab (Sichtprüfung am Mac). Die Audio-Engine startet erst beim ersten Klang; ohne
/// Ausgabegerät bleibt es still (Logzeile ohne „FEHLER“, damit `--selftest` nicht scheitert).
@MainActor
final class BoardSounds {
    static let sampleRate = 44_100.0
    /// Gesamtlautstärke wie `DEFAULT_VOLUME` im Browser-Host.
    static let masterVolume = 0.7

    private let muted = CommandLine.arguments.contains("--stumm")
    private let voices = SoundVoices(count: 8, limiter: false, label: "Klänge")
    /// Höchste gespielte ID; jede Partie zählt neu ab 1 (`reset()` in der Lobby).
    private var lastId = 0
    private var cache: [String: AVAudioPCMBuffer] = [:]
    private let format = AVAudioFormat(standardFormatWithSampleRate: BoardSounds.sampleRate, channels: 1)!
    /// Gespielte Klänge seit dem Start (auch stumm gezählt), für die Messzeile.
    private(set) var played = 0

    func reset() { lastId = 0 }

    func play(_ cues: [RenderState.SoundCue]) {
        for cue in cues.sorted(by: { $0.id < $1.id }) where cue.id > lastId {
            lastId = cue.id
            played += 1
            guard !muted else { continue }
            if let sample = cue.sample, let buffer = SoundBank.shared.buffer(sample.file) {
                voices.play(buffer, rate: sample.rate, volume: sample.gain * Self.masterVolume)
                continue
            }
            let key = "\(cue.name)|\(cue.voices)"
            let buffer = cache[key] ?? synthesize(cue.voices)
            cache[key] = buffer
            if let buffer { voices.play(buffer) }
        }
    }

    /// Ein Rezept → Puffer (mono, 44,1 kHz). Weiches Begrenzen statt Kompressor.
    func synthesize(_ voices: [RenderState.Voice]) -> AVAudioPCMBuffer? {
        let sr = Self.sampleRate
        let length = voices.map { ($0.delay ?? 0) + $0.duration }.max() ?? 0
        let frames = AVAudioFrameCount(max(1, (length + 0.02) * sr))
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let out = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        var mix = [Double](repeating: 0, count: Int(frames))
        var seed: UInt32 = 0x9E37_79B9
        for voice in voices {
            render(voice, into: &mix, seed: &seed)
        }
        for i in 0..<Int(frames) { out[i] = Float(tanh(mix[i] * Self.masterVolume)) }
        return buffer
    }

    private func render(_ v: RenderState.Voice, into mix: inout [Double], seed: inout UInt32) {
        let sr = Self.sampleRate
        let start = Int((v.delay ?? 0) * sr)
        let count = Int(v.duration * sr)
        guard count > 1 else { return }
        let peak = max(0.0002, v.gain)
        let attack = max(0.001, v.attack)
        let decay = max(0.001, v.duration - attack)
        let f0 = max(1, v.freq), f1 = max(20, v.freqEnd ?? v.freq)
        var phase = 0.0
        var filter = v.filter.map { Biquad(type: $0.type, q: $0.q) }
        for i in 0..<count where start + i < mix.count {
            let t = Double(i) / sr
            let k = t / v.duration
            let env = t < attack
                ? 0.0001 + (peak - 0.0001) * t / attack
                : peak * pow(0.0001 / peak, min(1, (t - attack) / decay))
            var sample: Double
            if v.wave == "noise" {
                seed = seed &* 1_664_525 &+ 1_013_904_223
                sample = Double(seed) / Double(UInt32.max) * 2 - 1
            } else {
                let freq = v.freqEnd == nil ? f0 : f0 * pow(f1 / f0, k)
                phase += freq / sr
                phase -= floor(phase)
                switch v.wave {
                case "triangle": sample = 1 - 4 * abs(phase - 0.5)
                case "square": sample = phase < 0.5 ? 1 : -1
                case "sawtooth": sample = 2 * phase - 1
                default: sample = sin(2 * .pi * phase)
                }
            }
            if let f = v.filter, filter != nil {
                if i % 16 == 0 {
                    let freq = f.freqEnd.map { f.freq * pow(max(1, $0) / max(1, f.freq), k) } ?? f.freq
                    filter!.tune(freq: freq, sampleRate: sr)
                }
                sample = filter!.process(sample)
            }
            mix[start + i] += sample * env
        }
    }
}

/// Biquad nach dem Audio-EQ-Cookbook, wie `BiquadFilterNode` (Tiefpass/Hochpass: Q in dB, Bandpass: Q linear).
private struct Biquad {
    let type: String
    let q: Double?
    var b0 = 1.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0
    var x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0

    init(type: String, q: Double?) {
        self.type = type
        self.q = q
    }

    mutating func tune(freq: Double, sampleRate: Double) {
        let w = 2 * .pi * min(max(10, freq), sampleRate * 0.45) / sampleRate
        let cosw = cos(w), sinw = sin(w)
        let linearQ = type == "bandpass" ? max(0.05, q ?? 1) : pow(10, (q ?? 1) / 20)
        let alpha = sinw / (2 * linearQ)
        let a0 = 1 + alpha
        switch type {
        case "highpass":
            b0 = (1 + cosw) / 2 / a0; b1 = -(1 + cosw) / a0; b2 = b0
        case "bandpass":
            b0 = alpha / a0; b1 = 0; b2 = -alpha / a0
        default:
            b0 = (1 - cosw) / 2 / a0; b1 = (1 - cosw) / a0; b2 = b0
        }
        a1 = -2 * cosw / a0
        a2 = (1 - alpha) / a0
    }

    mutating func process(_ x: Double) -> Double {
        let y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2 = x1; x1 = x
        y2 = y1; y1 = y
        return y
    }
}
