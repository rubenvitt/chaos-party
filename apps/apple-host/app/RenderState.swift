import Foundation

/// `renderState()` of the JS core (ADR-019 §2). Source of truth: `apps/apple-host/src/contract.ts`
/// (`RenderStateSchema`); examples in `harness/Fixtures/render-state`, decoded by the harness in CI.
/// Lenient on purpose: everything the renderer can live without is optional, unknown fields are ignored.
/// Shared by the app and the harness, so it must only depend on Foundation.
struct RenderState: Decodable, Equatable {
    var phase: String
    var lobby: Lobby?
    var board: Board?
    var minigame: Minigame?
    /// Finale (CHAOS-145): Trophäenzählung, Siegerbildschirm, Podest; nur in der Phase `final`.
    var final: Final?
    /// Pause (CHAOS-145): Server-Stand, ob Pausieren gerade geht, Rundentext, Klänge.
    var pause: Pause?

    struct Lobby: Decodable, Equatable {
        var joinUrl: String?
        var joinCode: String?
        var players: [Player]?
        /// Einstellungen der nächsten Partie (CHAOS-166); null, bis die Host-Rolle ihre erste `lobby` hat.
        var settings: LobbySettings?
    }

    /// Server-Stand der Lobby-Einstellungen; ändern über `hostCommand("configure:…")`.
    struct LobbySettings: Decodable, Equatable {
        var rounds: Int?
        /// Vorschläge für die Rundenwahl, aufsteigend (Server: 10, 16, 20).
        var roundPresets: [Int]?
        /// „Mehr Zeit zum Reagieren“ (CHAOS-124): Reaktionsfenster 5 s statt 3 s.
        var moreReactionTime: Bool?
        /// Brett-Wahl (CHAOS-197): Brett-ID oder „zufall“; ändern über `hostCommand("configure:board=<id>")`.
        var board: String?
        /// Knöpfe der Brett-Auswahl in Lobby-Reihenfolge, zuletzt „Zufall“; genau einer ist gewählt.
        var boards: [BoardChoice]?
    }

    /// Ein Brett der Lobby-Auswahl (CHAOS-197), fertig beschriftet vom Kern (`boardOptions`).
    struct BoardChoice: Decodable, Equatable, Hashable {
        var id: String
        /// „Wackelwald“, „Zufall“.
        var name: String
        /// Zweite Zeile: „74 Felder“, „Überraschung!“.
        var detail: String
        var selected: Bool
        var random: Bool
    }

    struct Player: Decodable, Equatable {
        var slot: Int
        var name: String?
        var color: String?
        var connected: Bool?
        var ready: Bool?
        var character: String?
    }

    struct Board: Decodable, Equatable {
        /// Played board (CHAOS-212), already resolved by the core; selects the scenery `bretter/<boardId>/`.
        var boardId: String?
        var round: Int?
        var rounds: Int?
        var activeSlot: Int?
        var spaces: [Space]?
        var pawns: [Pawn]?
        var messages: [String]?
        /// Big banner at the top centre (CHAOS-157), e.g. „Sabotage wird stärker!“; 4 s, else null.
        var notice: Notice?
        // Board direction from the shared director (CHAOS-143): what the scene and HUD show this frame.
        var popups: [Popup]?
        var ticker: [TickerEntry]?
        var hud: Hud?
        /// Camera pose from the shared direction (`camera.ts`, CHAOS-194), already eased; Babylon coordinates (flip x).
        var camera: Camera?
        var trophySpaces: [String]?
        var traps: [Trap]?
        /// Sound cues of the last 1.5 s; play every id once.
        var sounds: [SoundCue]?
        /// Lichtstimmung der gezeigten Runde, beim Rundenwechsel überblendet (CHAOS-193).
        var light: Light?
        /// Rides of the scenery (CHAOS-199): node in the USDZ, axis (`y`/`z`) and angle in Babylon coordinates (rad).
        var rides: [Ride]?
    }

    /// Lichtstimmung (CHAOS-193): `LightState` des Browser-Hosts, im JS-Kern gerechnet. Farben `#rrggbb` (sRGB),
    /// Intensitäten in Babylon-Einheiten; Umsetzung in `app/SceneLight.swift`.
    struct Light: Decodable, Equatable {
        struct Environment: Decodable, Equatable {
            var mood: String
            var sky: String
            var ground: String
            var skyIntensity: Float?
            var fillIntensity: Float?
        }

        var mood: String
        var keyIntensity: Float
        var keyTint: String
        /// Sinus der Sonnenhöhe.
        var keyElevation: Float
        var skyIntensity: Float
        var fillIntensity: Float
        var fillSky: String
        var fillGround: String
        /// Stimmung, deren Himmelslicht gerade gilt, mit ihren reinen Bodenlicht-Farben.
        var environment: Environment
        var haze: String
        var exposure: Float
        /// Laternen an (0…1), Glas leuchtet ab 0,25.
        var lampsOn: Float
        var lanternColor: String
        var lanternIntensity: Float
        var lanternRange: Float
        var grassTip: String?
    }

    struct Point: Decodable, Equatable {
        var x: Float
        var z: Float
    }

    struct Ride: Decodable, Equatable {
        var node: String
        var axis: String
        var angle: Float
    }

    struct Trap: Decodable, Equatable {
        var spaceId: String
        var owner: Int
    }

    /// Hop or flight of a pawn: walk = hop to the neighbour field, gust/swap = one flight from `from` to `to`.
    struct Hop: Decodable, Equatable {
        var from: String
        var to: String
        var t: Float
        var style: String
    }

    /// Popup above a pawn (`slot`) or a field (`spaceId`); kinds coins, dice, item, trap, trophy, event, shield, steal.
    struct Popup: Decodable, Equatable {
        var id: Int
        var kind: String
        var slot: Int?
        var spaceId: String?
        var text: String
        /// good, bad, neutral, gold
        var tone: String
        /// 0 when it appears … 1 when it is gone.
        var progress: Float
        /// Stack level (CHAOS-189): 0 = bottom; simultaneous popups over the same spot are offset by `stack × popupStackHeight` along the camera's up axis.
        var stack: Int?
        /// One-shot clip of the pawn `slot`: cheer, hit, jump.
        var reaction: String?
    }

    struct TickerEntry: Decodable, Equatable {
        var id: Int
        var text: String
        var slot: Int?
        var tone: String?
    }

    struct Hud: Decodable, Equatable {
        var boardName: String?
        var roundText: String?
        var banner: String?
        var bannerSlot: Int?
        var status: Status?
        var players: [HudPlayer]?
        var tailwind: Tailwind?

        struct Status: Decodable, Equatable {
            var slot: Int
            var kind: String?
            var text: String
            var detail: String?
            var countdown: String?
        }

        struct HudPlayer: Decodable, Equatable {
            var slot: Int
            var name: String
            var color: String?
            var coins: Int
            var trophies: Int
            var items: [Item]?
            var connected: Bool?
            var active: Bool?
        }

        struct Item: Decodable, Equatable {
            var id: String
            var name: String
        }

        struct Tailwind: Decodable, Equatable {
            var lead: String?
            var rows: [Row]

            struct Row: Decodable, Equatable {
                var slot: Int
                var name: String
                var amount: String
            }
        }
    }

    /// Sound cue: procedural recipe (`apps/host/src/fx/sounds.ts`, volume and pitch already applied) as fallback, and since
    /// CHAOS-223 the recorded file to play (`payload/sounds/<file>`), chosen by the JS core like the browser host does.
    struct SoundCue: Decodable, Equatable {
        var id: Int
        var name: String
        var voices: [Voice]
        var sample: Sample?
    }

    struct Sample: Decodable, Equatable {
        /// File name under `payload/sounds/`, e.g. `coin-2.mp3`.
        var file: String
        /// Playback rate (pitch incl. variation), like WebAudio `playbackRate`.
        var rate: Double
        /// Volume 0…2 before the master volume.
        var gain: Double
    }

    struct Voice: Decodable, Equatable {
        /// sine, triangle, square, sawtooth, noise
        var wave: String
        var freq: Double
        var freqEnd: Double?
        var delay: Double?
        var attack: Double
        var duration: Double
        var gain: Double
        var filter: Filter?

        struct Filter: Decodable, Equatable {
            /// lowpass, bandpass, highpass
            var type: String
            var freq: Double
            var freqEnd: Double?
            var q: Double?
        }
    }

    struct Notice: Decodable, Equatable {
        var title: String
        var detail: String?
    }

    /// World coordinates as in the Babylon host (left-handed: flip z for RealityKit).
    struct Space: Decodable, Equatable {
        var id: String
        var x: Float
        var z: Float
        /// `SpaceKind` from game-core: start, coins-plus, coins-minus, event, item, trophy.
        var kind: String?
    }

    struct Pawn: Decodable, Equatable {
        var slot: Int
        var spaceId: String?
        /// Shown position (Babylon coordinates): field centre plus spread, or the point on the hop/flight path.
        var x: Float
        var z: Float
        var character: String?
        /// Height above the field surface (hop or flight arc).
        var y: Float?
        var hop: Hop?
        /// Babylon yaw `atan2(dx, dz)` (RealityKit: negate); null = standing, face the camera.
        var heading: Float?
        var connected: Bool?
    }

    struct Minigame: Decodable, Equatable {
        var id: String
        /// intro, play, results
        var stage: String?
        var elapsedMs: Double?
        var bodies: [Body]?
        var hud: String?
        // CHAOS-144: real graphics and the shared screens (intro, HUD, results).
        /// Stage built in the JS core (bodies and geometry follow).
        var ready: Bool?
        var info: Info?
        var round: Int?
        /// Ran before in this match: short instructions (CHAOS-66).
        var `repeat`: Bool?
        /// Intro: whole seconds until the start; nil while the intro waits for „Bereit“ (`readiness`).
        var countdown: Int?
        /// CHAOS-214: the intro waits until every connected player pressed „Bereit“ on the phone; chips instead of
        /// the countdown. nil = fixed intro time.
        var readiness: Readiness?
        var camera: Camera?
        var backdrop: Backdrop?
        var figures: [Figure]?
        var scoreboard: Scoreboard?
        var results: Results?
        var effects: [Effect]?
        /// New geometry since the last frame; each entry arrives exactly once.
        var geometry: [Geometry]?
        var geometryTotal: Int?
        /// Sound cues of the last 1.5 s (CHAOS-190): the minigame's `ctx.fx.sound`, start and countdown ticks in the
        /// intro, cheer in the results. Ids rise over the core's lifetime; play every id once.
        var sounds: [SoundCue]?
        /// Lichtstimmung der Runde (CHAOS-193).
        var light: Light?
    }

    /// One mesh of the headless minigame scene: centre of its world bounding box, world rotation (x, y, z, w),
    /// local extent × scale. Shapes: sphere, box, cylinder.
    struct Body: Decodable, Equatable {
        var id: String
        var shape: String
        var pos: [Float]
        var rot: [Float]?
        var size: [Float]?
        var color: String?
        /// Geometry id (`minigame.geometry`); scale = size / geometry extent per axis (CHAOS-144).
        var mesh: String?
        /// Visual role (`markVisual`, CHAOS-149) and its key; nil = scenery of the minigame.
        var role: String?
        var key: String?
        var alpha: Float?
        var glow: String?
        /// matt, lack (default), glanz, metall, stoff
        var finish: String?
        var twoSided: Bool?
    }

    struct Info: Decodable, Equatable {
        var title: String
        var tagline: String? = nil
        var instructions: [String]? = nil
        var controls: Controls? = nil
        var scoreUnit: String? = nil
    }

    struct Controls: Decodable, Equatable {
        var joystick: String?
        var a: String?
        var b: String?
    }

    /// Babylon coordinates (flip z); `fov` in radians on `fovAxis` (vertical, horizontal).
    struct Camera: Decodable, Equatable {
        var pos: [Float]
        var target: [Float]
        var fov: Float?
        var fovAxis: String?
    }

    /// `LookArea`: free play area around the origin; surface wiese or decke.
    struct Backdrop: Decodable, Equatable {
        var halfX: Float
        var halfZ: Float
        var groundY: Float?
        var surface: String?
    }

    /// A player's figure: root (feet) in Babylon coordinates, last animation and its counter.
    struct Figure: Decodable, Equatable {
        var slot: Int
        var character: String?
        var pos: [Float]
        var rot: [Float]?
        var scale: [Float]?
        var visible: Bool?
        var anim: String?
        var animSeq: Int?
    }

    struct Scoreboard: Decodable, Equatable {
        var seconds: Int?
        var banner: String?
        var waiting: Bool?
        var scores: [Score]?
    }

    struct Score: Decodable, Equatable {
        var slot: Int
        var name: String?
        var character: String?
        var color: String?
        var symbol: String?
        var score: Double?
        var status: String?
        var connected: Bool?
    }

    /// CHAOS-214: `introReadiness` (`apps/host/src/minigame/readiness.ts`).
    struct Readiness: Decodable, Equatable {
        var headline: String?
        var players: [ReadyPlayer]?
    }

    struct ReadyPlayer: Decodable, Equatable {
        var slot: Int
        var name: String?
        var character: String?
        var color: String?
        var symbol: String?
        var ready: Bool?
        var connected: Bool?
        /// ready, waiting, disconnected
        var state: String?
        /// „Bereit“, „Drückt Bereit …“, „getrennt“
        var text: String?
    }

    struct Results: Decodable, Equatable {
        var aborted: Bool?
        var headline: String?
        var rows: [ResultRow]?
        var highlights: [String]?
    }

    struct ResultRow: Decodable, Equatable {
        var slot: Int
        var name: String?
        var character: String?
        var color: String?
        var symbol: String?
        var place: Int?
        var tied: Bool?
        var scoreText: String?
        var coins: Int?
        var prizes: [String]?
    }

    /// Particle burst (`VfxId`) or camera shake (`shake`); play each `seq` once.
    struct Effect: Decodable, Equatable {
        var seq: Int
        var kind: String
        var pos: [Float]?
        var color: String?
        var strength: Float?
    }

    /// Mesh geometry as base64 of little-endian bytes: positions Float32×3 (centred on the local bounding box),
    /// normals Int8×3 (÷127), indices UInt16 (`wideIndices`: UInt32). Babylon coordinates (left-handed).
    struct Geometry: Decodable, Equatable {
        var id: String
        var vertices: Int
        var positions: String
        var normals: String
        var indices: String
        var wideIndices: Bool?
        var extent: [Float]?
    }

    /// Finale like `Finale.tsx` in the browser host; the timeline runs in the JS core (`src/finaleView.ts`).
    struct Final: Decodable, Equatable {
        /// intro, reveal, tiebreak, winner
        var beat: String
        var beatIndex: Int?
        var progress: Float?
        /// Winner screen reached (stays until the rematch).
        var done: Bool
        var elapsedMs: Double?
        var winnerAtMs: Double?
        var endedEarly: Bool?
        var kicker: String?
        var title: String?
        var lead: String?
        var cards: [FinaleCard]?
        var winner: FinaleWinner?
        var podium: [PodiumEntry]?
        var canRematch: Bool?
        var sounds: [SoundCue]?
    }

    /// Tally card, values already counted up.
    struct FinaleCard: Decodable, Equatable {
        var slot: Int
        var name: String?
        var character: String?
        var characterName: String?
        var color: String?
        var symbol: String?
        var place: Int?
        var badge: String?
        var revealed: Bool?
        var active: Bool?
        var trophies: Int?
        var coins: Int?
        var placeShown: Bool?
    }

    struct FinaleWinner: Decodable, Equatable {
        var headline: String?
        var reason: String?
        var earlyNote: String?
        var ranking: [FinaleRank]?
        var awards: [FinaleAward]?
    }

    struct FinaleRank: Decodable, Equatable {
        var slot: Int
        var name: String?
        var character: String?
        var characterName: String?
        var color: String?
        var symbol: String?
        var place: Int?
        var badge: String?
        var trophies: Int?
        var coins: Int?
    }

    struct FinaleAward: Decodable, Equatable {
        var id: String
        var title: String
        var detail: String?
        var names: String?
    }

    /// One block of the winners' podium (Babylon coordinates: flip z; the camera looks from -z).
    struct PodiumEntry: Decodable, Equatable {
        var slot: Int
        var character: String?
        var color: String?
        var symbol: String?
        var place: Int
        var x: Float
        var height: Float
        var blockColor: String?
        /// cheer, sad, jump
        var anim: String?
    }

    struct Pause: Decodable, Equatable {
        var paused: Bool
        var canPause: Bool?
        var roundText: String?
        var sounds: [SoundCue]?
    }

    /// The phases the contract knows (`CONTRACT_PHASES`).
    static let phases: Set<String> = ["lobby", "board", "minigame", "final", "paused"]

    static func decode(_ json: String) throws -> RenderState {
        try JSONDecoder().decode(RenderState.self, from: Data(json.utf8))
    }
}

/// Geometry in RealityKit space (right-handed): z mirrored on positions and normals.
struct DecodedGeometry {
    var positions: [SIMD3<Float>]
    var normals: [SIMD3<Float>]
    var indices: [UInt32]
    var extent: SIMD3<Float>
}

extension RenderState.Geometry {
    /// Decodes the base64 buffers (CHAOS-144); nil if a buffer is missing or has the wrong length.
    func decoded() -> DecodedGeometry? {
        guard vertices > 0, let p = Data(base64Encoded: positions), let n = Data(base64Encoded: normals),
              let i = Data(base64Encoded: indices), p.count == vertices * 12, n.count == vertices * 3 else { return nil }
        let wide = wideIndices ?? false
        let indexCount = i.count / (wide ? 4 : 2)
        guard indexCount >= 3, indexCount % 3 == 0, i.count == indexCount * (wide ? 4 : 2) else { return nil }
        var positions = [SIMD3<Float>](repeating: .zero, count: vertices)
        var normals = [SIMD3<Float>](repeating: .zero, count: vertices)
        var indices = [UInt32](repeating: 0, count: indexCount)
        p.withUnsafeBytes { raw in
            for v in 0..<vertices {
                let x = Float(bitPattern: UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: v * 12, as: UInt32.self)))
                let y = Float(bitPattern: UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: v * 12 + 4, as: UInt32.self)))
                let z = Float(bitPattern: UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: v * 12 + 8, as: UInt32.self)))
                positions[v] = SIMD3(x, y, -z)
            }
        }
        n.withUnsafeBytes { raw in
            for v in 0..<vertices {
                let x = Float(raw.load(fromByteOffset: v * 3, as: Int8.self))
                let y = Float(raw.load(fromByteOffset: v * 3 + 1, as: Int8.self))
                let z = Float(raw.load(fromByteOffset: v * 3 + 2, as: Int8.self))
                let length = (x * x + y * y + z * z).squareRoot()
                normals[v] = length > 0 ? SIMD3(x, y, -z) / length : SIMD3(0, 1, 0)
            }
        }
        var valid = true
        i.withUnsafeBytes { raw in
            for k in 0..<indexCount {
                let value = wide ? UInt32(littleEndian: raw.loadUnaligned(fromByteOffset: k * 4, as: UInt32.self))
                    : UInt32(UInt16(littleEndian: raw.loadUnaligned(fromByteOffset: k * 2, as: UInt16.self)))
                if value >= UInt32(vertices) { valid = false }
                indices[k] = value
            }
        }
        guard valid else { return nil }
        // Babylon's front faces wind clockwise (left-handed); mirroring z turns them counter-clockwise, which is what
        // RealityKit expects. Indices stay as they are.
        let e = extent ?? []
        return DecodedGeometry(positions: positions, normals: normals, indices: indices,
                               extent: e.count == 3 ? SIMD3(e[0], e[1], e[2]) : .zero)
    }
}
