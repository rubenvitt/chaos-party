// One player's controller (ui/SlotController.tsx) and the lobby (lobby/view.ts, ui/lobby.tsx).
import SwiftUI

/// Player color and readable text color, handed to every panel of a slot.
struct Tint {
    let color: Color
    let on: Color
    init(hex: String) {
        color = Color(hex: hex)
        on = Color(hex: readableTextHex(on: hex))
    }
}

struct SlotView: View {
    let session: any ControllerSessionProtocol
    let player: PlayerInfo

    var body: some View {
        let state = session.state
        let slot = player.slot
        let context = state.contexts[slot]
        let screen = state.slotScreen(slot)
        let tint = Tint(hex: player.color)
        GeometryReader { geo in
            let landscape = geo.size.width > geo.size.height
            let compactBadge = landscape && screen == .play
            VStack(spacing: 12) {
                if !compactBadge {
                    PlayerBadge(player: player, character: ownCharacter(slot: slot, context: context))
                }
                content(screen: screen, context: context, tint: tint, landscape: landscape)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .overlay(alignment: .topTrailing) {
                if compactBadge {
                    PlayerBadge(player: player, character: ownCharacter(slot: slot, context: context), compact: true)
                }
            }
            // Room for the online pill above the centered badge.
            .padding(.top, landscape ? 0 : 30)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .overlay {
            Rectangle().strokeBorder(tint.color, lineWidth: 4).ignoresSafeArea().allowsHitTesting(false)
        }
        .overlay {
            if let pulse = state.feedback[slot] { FeedbackFlash(kind: pulse.kind, color: tint.color).id(pulse.id) }
        }
        .sensoryFeedback(trigger: state.feedback[slot]) { _, pulse in haptic(pulse?.kind) }
    }

    @ViewBuilder
    private func content(screen: SlotScreen, context: SlotContext?, tint: Tint, landscape: Bool) -> some View {
        let slot = player.slot
        let state = session.state
        switch screen {
        case .lobby:
            if let context, let model = LobbyModel(context: context, pending: state.picks[slot]) {
                LobbyPanel(model: model, tint: tint, landscape: landscape, contextKey: context.key) {
                    session.pickCharacter(slot: slot, $0)
                } onReady: {
                    session.setReady(slot: slot)
                }
            }
        case .lobbyBasic:
            LobbyBasicPanel(
                character: ownCharacter(slot: slot, context: context), tint: tint,
                canReady: context?.actions.contains(.ready) == true
            ) { session.setReady(slot: slot) }
            .id(context?.key)
        case .wait:
            VStack(spacing: 22) {
                WaitDots()
                Text(lookAtScreen).font(.title2.bold()).multilineTextAlignment(.center)
            }
        case .play:
            if let context {
                PlayPanel(session: session, slot: slot, context: context, tint: tint, landscape: landscape)
            }
        case .minigame:
            if let context, let minigame = context.minigame {
                MinigameCard(minigame: minigame, actions: context.actions, tint: tint, contextKey: context.key) {
                    session.setReady(slot: slot)
                } onVote: {
                    session.rate(slot: slot, $0)
                }
            }
        case .pause:
            (landscape ? AnyLayout(HStackLayout(spacing: 20)) : AnyLayout(VStackLayout(spacing: 18))) {
                if let board = context?.board { StatusBar(board: board).frame(maxWidth: landscape ? 300 : nil) }
                PauseCard().frame(maxHeight: .infinity)
            }
        case .final:
            if let board = context?.board { FinalCard(board: board, tint: tint) }
        case .board:
            if let context { BoardPanel(session: session, slot: slot, context: context, tint: tint, landscape: landscape) }
        }
    }
}

extension SlotContext {
    /// A new context with other actions resets local "sent" flags (`contextKey`).
    var key: String { "\(phase.rawValue):\(layout.rawValue):\(actions.map(\.rawValue).joined(separator: ","))" }
}

/// `feedback` → haptic pattern (ADR-017).
func haptic(_ kind: FeedbackKind?) -> SensoryFeedback? {
    switch kind {
    case .some(.confirm), .some(.hit): .impact
    case .some(.miss): .impact(flexibility: .soft, intensity: 0.6)
    case .some(.win): .success
    case .some(.lose): .warning
    default: nil
    }
}

/// Short color flash per feedback (`.feedback-*`).
private struct FeedbackFlash: View {
    let kind: FeedbackKind
    let color: Color
    @State private var opacity = 1.0

    var body: some View {
        let fill: Color =
            switch kind {
            case .confirm, .win: color.opacity(0.45)
            case .hit, .lose: Color(hex: "#ff3b30").opacity(0.4)
            default: .black.opacity(0.3)
            }
        fill
            .opacity(opacity)
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .onAppear { withAnimation(.easeOut(duration: 0.38)) { opacity = 0 } }
    }
}

struct PlayerBadge: View {
    let player: PlayerInfo
    let character: CharacterId
    var compact = false

    var body: some View {
        let tint = Tint(hex: player.color)
        let style = Slots.style(player.slot)
        let avatar: CGFloat = compact ? 32 : 40
        HStack(spacing: 10) {
            Portrait(character: character, accent: tint.color)
                .frame(width: avatar, height: avatar)
                .clipShape(Circle())
                .overlay(alignment: .bottomTrailing) {
                    SlotSymbol(slot: player.slot, size: avatar * 0.5).offset(x: 4, y: 4)
                }
            Text(player.label)
                .font(compact ? .headline : .title2.bold())
                .lineLimit(1)
        }
        .foregroundStyle(tint.on)
        .padding(5)
        .padding(.trailing, compact ? 10 : 14)
        .background(Capsule().fill(tint.color).shadow(color: .black.opacity(0.22), radius: 7, y: 4))
        .overlay(Capsule().strokeBorder(Palette.line))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Du spielst \(player.label), \(style.symbolName)")
    }
}

// MARK: - Lobby model (port of `describeLobby`)

struct LobbyCard: Equatable {
    enum State { case mine, free, taken }
    let id: CharacterId
    let state: State
    /// Own pick sent but not confirmed yet.
    let pending: Bool
    let ownerSlot: Int?
    let selectable: Bool

    var tag: String? {
        switch state {
        case .mine: pending ? "Wird gewählt …" : "Deine Figur"
        case .taken: ownerSlot.map { "\(Slots.style($0).label) hat sie" } ?? "vergeben"
        case .free: nil
        }
    }
}

struct LobbyModel: Equatable {
    let cards: [LobbyCard]
    let character: CharacterId?
    /// Server confirmed "ready" (layout `wait`).
    let ready: Bool
    let canReady: Bool
    let rounds: Int
    let hint: String

    var roundsLabel: String { rounds == 1 ? "1 Runde" : "\(rounds) Runden" }

    init?(context: SlotContext, pending: CharacterId?) {
        guard context.phase == .lobby, let lobby = context.lobby else { return nil }
        let canPick = context.actions.contains(.pickCharacter)
        let taken = Set(lobby.takenCharacters)
        // A pending pick that someone else got meanwhile no longer counts.
        let mine = pending.flatMap { taken.contains($0) ? nil : $0 } ?? lobby.character
        ready = context.layout == .wait
        cards = CharacterId.known.map { id in
            let state: LobbyCard.State = id == mine ? .mine : taken.contains(id) ? .taken : .free
            return LobbyCard(
                id: id, state: state,
                pending: state == .mine && pending == id && lobby.character != id,
                ownerSlot: state == .taken ? lobby.takenBy?.first { $0.character == id }?.slot : nil,
                selectable: canPick && state == .free)
        }
        character = mine
        canReady = context.actions.contains(.ready)
        rounds = lobby.rounds
        hint =
            ready
            ? "Du bist bereit! Umwählen geht noch – dann noch mal „Bereit!“."
            : mine == nil ? "Tippe auf eine Figur." : "Gute Wahl! Jetzt „Bereit!“ tippen."
    }
}

// MARK: - Lobby views

private struct LobbyPanel: View {
    let model: LobbyModel
    let tint: Tint
    let landscape: Bool
    let contextKey: String
    let onPick: (CharacterId) -> Void
    let onReady: () -> Void

    var body: some View {
        let head = HStack(spacing: 12) {
            Text("Wähle deine Figur").font(.title2.bold()).accessibilityAddTraits(.isHeader)
            Text(model.roundsLabel)
                .font(.headline)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .glass(18, strong: true)
        }
        let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: landscape ? 4 : 2)
        let grid = LazyVGrid(columns: columns, spacing: 12) {
            ForEach(model.cards, id: \.id) { card in
                CharacterCardView(card: card, tint: tint, compact: landscape) { onPick(card.id) }
            }
        }
        let foot = VStack(spacing: 14) {
            Text(model.hint)
                .font(.callout.weight(.semibold))
                .foregroundStyle(Palette.dim)
                .multilineTextAlignment(.center)
            if model.ready {
                ReadyBadge()
            } else if model.canReady {
                ReadyAction(tint: tint, onReady: onReady).id(contextKey)
            }
        }
        if landscape {
            HStack(spacing: 20) {
                VStack(spacing: 12) { head; grid }
                foot.frame(maxWidth: 230)
            }
        } else {
            VStack(spacing: 16) {
                head
                grid
                Spacer(minLength: 0)
                foot
            }
        }
    }
}

private struct CharacterCardView: View {
    let card: LobbyCard
    let tint: Tint
    let compact: Bool
    let onPick: () -> Void

    var body: some View {
        let owner = card.ownerSlot.map(Slots.style)
        let portraitColor: Color =
            card.state == .taken ? owner?.color ?? Color(hex: "#9aa09a") : tint.color
        SwiftUI.Button(action: onPick) {
            VStack(spacing: 6) {
                Portrait(character: card.id, accent: portraitColor)
                    .aspectRatio(1, contentMode: .fit)
                    .frame(maxWidth: 128, maxHeight: 128)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .saturation(card.state == .taken ? (owner == nil ? 0.15 : 0.6) : 1)
                    .brightness(card.state == .taken ? -0.15 : 0)
                    .overlay(alignment: .topLeading) {
                        if let slot = card.ownerSlot { SlotSymbol(slot: slot, size: 32).offset(x: -8, y: -8) }
                    }
                    .overlay(alignment: .bottomTrailing) {
                        if card.state == .mine {
                            Image(systemName: "checkmark")
                                .font(.headline.bold())
                                .foregroundStyle(tint.on)
                                .frame(width: 34, height: 34)
                                .background(Circle().fill(tint.color))
                                .offset(x: 8, y: 8)
                        }
                    }
                Text(card.id.displayName)
                    .font(compact ? .headline : .title3.bold())
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                if let tag = card.tag {
                    Text(tag)
                        .font(.caption.bold())
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(tagFill(owner)))
                        .foregroundStyle(tagText(owner))
                        .phaseAnimator([1.0, 0.45]) { view, phase in
                            view.opacity(card.pending ? phase : 1)
                        }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(cardBackground(owner))
            .opacity(card.state == .taken ? (owner == nil ? 0.55 : 0.7) : 1)
        }
        .buttonStyle(PressStyle())
        .disabled(!card.selectable)
        .accessibilityLabel(card.tag.map { "\(card.id.displayName) – \($0)" } ?? card.id.displayName)
        .accessibilityHint(card.id.blurb)
        .accessibilityAddTraits(card.state == .mine ? .isSelected : [])
    }

    private func tagFill(_ owner: SlotStyle?) -> Color {
        switch card.state {
        case .mine: tint.color
        case .taken: owner?.color ?? Palette.glassStrong
        case .free: Palette.glassStrong
        }
    }

    private func tagText(_ owner: SlotStyle?) -> Color {
        switch card.state {
        case .mine: tint.on
        case .taken: owner?.onColor ?? Palette.ink
        case .free: Palette.ink
        }
    }

    @ViewBuilder
    private func cardBackground(_ owner: SlotStyle?) -> some View {
        let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
        switch card.state {
        case .mine:
            shape.fill(tint.color.opacity(0.34))
                .overlay(shape.strokeBorder(tint.color, lineWidth: 3))
                .shadow(color: tint.color.opacity(0.55), radius: 14, y: 8)
        case .taken:
            shape.fill(.white.opacity(0.04))
                .overlay(shape.strokeBorder(owner?.color ?? .white.opacity(0.35), lineWidth: 2))
        case .free:
            shape.fill(Palette.glass).overlay(shape.strokeBorder(Palette.line))
        }
    }
}

/// „Bereit!“; hidden after the tap until the next context (`ReadyAction`).
private struct ReadyAction: View {
    let tint: Tint
    let onReady: () -> Void
    @State private var sent = false

    var body: some View {
        if sent {
            Text("Gesendet …").font(.headline).foregroundStyle(Palette.dim)
        } else {
            PrimaryButton(title: "Bereit!", color: tint.color, onColor: tint.on) {
                sent = true
                onReady()
            }
        }
    }
}

private struct ReadyBadge: View {
    var body: some View {
        Label("Bereit!", systemImage: "checkmark.circle.fill")
            .font(.title2.bold())
            .foregroundStyle(Palette.mint)
            .padding(.horizontal, 22)
            .frame(minHeight: 56)
            .glass(28, strong: true)
    }
}

/// Lobby without character choice (older server): figure and „Bereit!“.
private struct LobbyBasicPanel: View {
    let character: CharacterId
    let tint: Tint
    let canReady: Bool
    let onReady: () -> Void
    @State private var sent = false

    var body: some View {
        VStack(spacing: 20) {
            Portrait(character: character, accent: tint.color)
                .frame(width: 160, height: 160)
                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            Text(character.displayName).font(.title2.bold())
            if canReady && !sent {
                Text("Bist du startklar?").font(.title3.weight(.semibold))
                PrimaryButton(title: "Bereit!", color: tint.color, onColor: tint.on) {
                    sent = true
                    onReady()
                }
            } else {
                Label("Du bist dabei! Gleich geht’s los …", systemImage: "checkmark.circle.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Palette.mint)
            }
        }
    }
}
