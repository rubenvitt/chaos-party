// Root of the controller UI (CHAOS-115, ADR-017): routing, connection indicator, toasts.
import SwiftUI
import UIKit

/// Whole app UI; the only public entry point of the kit.
public struct ControllerRoot: View {
    @State private var session = makeSession()

    public init() {}

    public var body: some View { RootView(session: session) }
}

/// Session behind the UI: the real one, or with launch argument `-sample <name>` the fake in a
/// sample state (previews, screenshots).
@MainActor
func makeSession() -> any ControllerSessionProtocol {
    guard let sample = UserDefaults.standard.string(forKey: "sample") else { return LiveControllerSession() }
    return FakeControllerSession(ControllerState.samples[sample] ?? .joinSample)
}

extension ControllerState {
    static let samples: [String: ControllerState] = [
        "join": .joinSample, "connecting": .connectingSample, "lobby": .lobbySample,
        "lobbyReady": .lobbyReadySample, "boardWaiting": .boardWaitingSample,
        "rollPrompt": .rollPromptSample, "targetPrompt": .targetPromptSample,
        "minigameIntro": .minigameIntroSample, "minigameIntroRepeat": .minigameIntroRepeatSample,
        "minigameIntroReady": .minigameIntroReadySample, "minigameIntroWaiting": .minigameIntroWaitingSample,
        "minigamePlay": .minigamePlaySample, "minigameResults": .minigameResultsSample,
        "minigameConsolation": .minigameConsolationSample, "minigameAborted": .minigameAbortedSample,
        "minigameVote": .minigameVoteSample, "minigamePractice": .minigamePracticeSample,
        "paused": .pausedSample, "final": .finalSample, "reconnecting": .reconnectingSample,
        "toast": .toastSample, "sessionFull": .sessionFullSample,
        "versionMismatch": .versionMismatchSample, "badCode": .badCodeSample,
    ]
}

struct RootView: View {
    let session: any ControllerSessionProtocol
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        let state = session.state
        ZStack {
            Backdrop()
            switch state.screen {
            case .join: JoinView(session: session)
            case .connecting: ConnectingView(onCancel: session.leave)
            case .error: ErrorView(code: state.fatal ?? UiErrorCode(.internal), session: session)
            case .controller:
                if let player = state.players.first {
                    SlotView(session: session, player: player)
                } else {
                    ConnectingView(onCancel: session.leave)
                }
            }
            LinkLayer(link: state.link, session: session)
            if let notice = state.notice, state.screen == .controller {
                ToastView(notice: notice, dismiss: session.dismissNotice)
            }
        }
        .preferredColorScheme(.dark)
        .tint(Palette.ink)
        // Big glanceable controls leave no room for accessibility text sizes; VoiceOver labels stay.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { session.wake() }
        }
        .onChange(of: state.screen == .controller, initial: true) { _, playing in
            UIApplication.shared.isIdleTimerDisabled = playing
        }
        #if DEBUG
            .task { forceOrientationForScreenshots() }
        #endif
    }
}

#if DEBUG
    /// Launch argument `-orientation landscape` rotates the simulator for screenshots.
    @MainActor
    private func forceOrientationForScreenshots() {
        guard UserDefaults.standard.string(forKey: "orientation") == "landscape",
            let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
        else { return }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscapeRight))
    }
#endif

// MARK: - Connection indicator (ui/ConnectionStatus.tsx)

/// Online pill, or a full-screen overlay while reconnecting so nobody presses into the void.
struct LinkLayer: View {
    let link: LinkView
    let session: any ControllerSessionProtocol

    var body: some View {
        switch link {
        case .online(let rttMs):
            HStack(spacing: 6) {
                Circle().fill(Color(hex: "#34c77b")).frame(width: 10, height: 10)
                Text(rttMs.map { "verbunden · \(Int($0.rounded())) ms" } ?? "verbunden")
                    .font(.footnote.weight(.semibold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Capsule().fill(.black.opacity(0.35)))
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.leading, 12)
            .padding(.top, 2)
            .allowsHitTesting(false)
            .accessibilityElement(children: .combine)
        case .reconnecting(let attempt, let hadSession):
            ZStack {
                Color.black.opacity(0.55).ignoresSafeArea()
                VStack(spacing: 14) {
                    ProgressView().controlSize(.large)
                    Text(hadSession ? "Verbindung verloren" : "Spiel-PC nicht erreichbar")
                        .font(.title2.bold())
                    Text("verbinde neu …" + (attempt > 0 ? " (Versuch \(attempt))" : ""))
                        .font(.body)
                        .foregroundStyle(Palette.dim)
                    if attempt >= 5 {
                        Text("Gleiches WLAN wie der Spiel-PC? Läuft das Spiel dort noch?")
                            .font(.callout)
                            .foregroundStyle(Palette.sun)
                    }
                    GlassButton(title: "Jetzt neu verbinden", action: session.retry)
                    SwiftUI.Button("Spiel verlassen", action: session.leave)
                        .font(.callout)
                        .foregroundStyle(Palette.dim)
                        .frame(minHeight: 44)
                }
                .multilineTextAlignment(.center)
                .padding(28)
                .frame(maxWidth: 380)
                .background(RoundedRectangle(cornerRadius: 28).fill(Color(red: 0.07, green: 0.09, blue: 0.08).opacity(0.94)))
                .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Palette.line))
                .padding(20)
            }
            .accessibilityAddTraits(.isModal)
        case .hidden, .connecting:
            EmptyView()
        }
    }
}

// MARK: - Toast (ui/screens.tsx)

struct ToastView: View {
    let notice: Notice
    let dismiss: (Int) -> Void

    var body: some View {
        Text(notice.code.text)
            .font(.callout.weight(.semibold))
            .multilineTextAlignment(.center)
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color(red: 0.07, green: 0.09, blue: 0.08).opacity(0.94)))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Palette.line))
            .frame(maxWidth: 360)
            .frame(maxHeight: .infinity, alignment: .bottom)
            .padding(.bottom, 12)
            .padding(.horizontal, 16)
            .allowsHitTesting(false)
            .transition(.opacity)
            .accessibilityAddTraits(.updatesFrequently)
            .task(id: notice.id) {
                UIAccessibility.post(notification: .announcement, argument: notice.code.text)
                try? await Task.sleep(for: .seconds(3))
                dismiss(notice.id)
            }
    }
}

// MARK: - Previews: one per `ControllerState` sample

private struct SamplePreview: View {
    @State private var session: FakeControllerSession
    init(_ state: ControllerState) { _session = State(initialValue: FakeControllerSession(state)) }
    var body: some View { RootView(session: session) }
}

#Preview("join") { SamplePreview(.joinSample) }
#Preview("connecting") { SamplePreview(.connectingSample) }
#Preview("lobby") { SamplePreview(.lobbySample) }
#Preview("lobbyReady") { SamplePreview(.lobbyReadySample) }
#Preview("boardWaiting") { SamplePreview(.boardWaitingSample) }
#Preview("rollPrompt") { SamplePreview(.rollPromptSample) }
#Preview("targetPrompt") { SamplePreview(.targetPromptSample) }
#Preview("minigameIntro") { SamplePreview(.minigameIntroSample) }
#Preview("minigameIntroReady") { SamplePreview(.minigameIntroReadySample) }
#Preview("minigameIntroWaiting") { SamplePreview(.minigameIntroWaitingSample) }
#Preview("minigamePlay", traits: .landscapeRight) { SamplePreview(.minigamePlaySample) }
#Preview("minigameResults") { SamplePreview(.minigameResultsSample) }
#Preview("minigameConsolation") { SamplePreview(.minigameConsolationSample) }
#Preview("minigameAborted") { SamplePreview(.minigameAbortedSample) }
#Preview("minigameVote") { SamplePreview(.minigameVoteSample) }
#Preview("minigamePractice") { SamplePreview(.minigamePracticeSample) }
#Preview("paused") { SamplePreview(.pausedSample) }
#Preview("final") { SamplePreview(.finalSample) }
#Preview("reconnecting") { SamplePreview(.reconnectingSample) }
#Preview("toast") { SamplePreview(.toastSample) }
#Preview("sessionFull") { SamplePreview(.sessionFullSample) }
#Preview("versionMismatch") { SamplePreview(.versionMismatchSample) }
#Preview("badCode") { SamplePreview(.badCodeSample) }
