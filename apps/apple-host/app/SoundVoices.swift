import AVFoundation
import Foundation
import QuartzCore

/// Stimmen für Klänge (CHAOS-223): je Stimme ein `AVAudioPlayerNode` hinter einem `AVAudioUnitVarispeed`, damit die
/// Abspiel-Rate (Tonhöhe samt Streuung aus dem JS-Kern) dieselbe Bedeutung hat wie `playbackRate` im Browser-Host.
///
/// Ein Klang geht nur an eine Stimme, deren letzter Puffer abgespielt ist; sind alle belegt, entfällt er (wie `MAX_VOICES`
/// im Browser-Host). In eine belegte Stimme eingereiht, käme er zu spät und der Ton liefe dem Spiel hinterher.
///
/// Mit `limiter` begrenzt Apples Peak-Limiter die Summe hinter dem Mischer (Minispiele: viele Klänge auf einmal; der
/// Browser-Host hat dort einen Kompressor). Die Engine startet erst beim ersten Klang; ohne Ausgabegerät bleibt es still.
@MainActor
final class SoundVoices {
    private let count: Int
    private let limiter: Bool
    private let label: String
    private var engine: AVAudioEngine?
    private var players: [AVAudioPlayerNode] = []
    private var speeds: [AVAudioUnitVarispeed] = []
    private var busyUntil: [CFTimeInterval] = []
    private var failed = false

    init(count: Int, limiter: Bool, label: String) {
        self.count = count
        self.limiter = limiter
        self.label = label
    }

    /// Puffer abspielen. `rate` 0,25…4, `volume` 0…1. `false`, wenn keine Stimme frei war (oder kein Ton geht).
    @discardableResult
    func play(_ buffer: AVAudioPCMBuffer, rate: Double = 1, volume: Double = 1) -> Bool {
        if engine == nil, !failed { start() }
        guard !failed, !players.isEmpty else { return false }
        let now = CACurrentMediaTime()
        guard let index = busyUntil.firstIndex(where: { $0 <= now }) else { return false }
        let speed = Float(min(4, max(0.25, rate.isFinite ? rate : 1)))
        busyUntil[index] = now + Double(buffer.frameLength) / buffer.format.sampleRate / Double(speed)
        speeds[index].rate = speed
        let player = players[index]
        player.volume = Float(min(1, max(0, volume.isFinite ? volume : 1)))
        player.scheduleBuffer(buffer, at: nil, options: [])
        if !player.isPlaying { player.play() }
        return true
    }

    private func start() {
        #if os(tvOS) || os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.ambient)
        #endif
        let engine = AVAudioEngine()
        let format = AVAudioFormat(standardFormatWithSampleRate: BoardSounds.sampleRate, channels: 1)!
        var nodes: [AVAudioPlayerNode] = []
        var units: [AVAudioUnitVarispeed] = []
        for _ in 0..<count {
            let node = AVAudioPlayerNode()
            let speed = AVAudioUnitVarispeed()
            engine.attach(node)
            engine.attach(speed)
            engine.connect(node, to: speed, format: format)
            engine.connect(speed, to: engine.mainMixerNode, format: format)
            nodes.append(node)
            units.append(speed)
        }
        if limiter {
            let unit = AVAudioUnitEffect(audioComponentDescription: AudioComponentDescription(
                componentType: kAudioUnitType_Effect, componentSubType: kAudioUnitSubType_PeakLimiter,
                componentManufacturer: kAudioUnitManufacturer_Apple, componentFlags: 0, componentFlagsMask: 0))
            // Format des Ausgangs (meist Stereo) auf beiden Seiten des Limiters: So bleibt die Lautstärke wie ohne ihn.
            // Ohne gültiges Ausgabeformat (kein Gerät) bleibt es beim Standard-Weg; `connect` würfe sonst.
            let outFormat = engine.outputNode.inputFormat(forBus: 0)
            if outFormat.channelCount > 0, outFormat.sampleRate > 0 {
                engine.attach(unit)
                engine.connect(engine.mainMixerNode, to: unit, format: outFormat)
                engine.connect(unit, to: engine.outputNode, format: outFormat)
            }
        }
        do {
            try engine.start()
            self.engine = engine
            players = nodes
            speeds = units
            busyUntil = Array(repeating: 0, count: nodes.count)
        } catch {
            failed = true
            hostLog("\(label) aus: Audio-Engine startet nicht (\(error.localizedDescription))")
        }
    }
}
