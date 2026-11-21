// Own role in team and koop minigames (CHAOS-89; Swift: CHAOS-229). Port of
// `apps/controller/src/ui/minigameTeam.ts`: same texts, same team marks as on the PC
// (`TEAM_MARKS` in `packages/minigame-sdk/src/teams.ts`) – name and symbol, never colour alone.
import SwiftUI

/// Team mark as on the PC: ☀ Sonne, ☾ Mond.
struct TeamMark: Equatable {
    let name: String
    let symbol: String
    let hex: String

    static let all = [
        TeamMark(name: "Sonne", symbol: "☀", hex: "#f2a33a"),
        TeamMark(name: "Mond", symbol: "☾", hex: "#5b7bd5"),
    ]
    /// Koop: everybody plays together (heart instead of a team mark).
    static let koop = TeamMark(name: "Alle", symbol: "♥", hex: "#e85d75")

    static func of(_ index: Int) -> TeamMark { all.indices.contains(index) ? all[index] : all[0] }
}

/// Role in the intro (`describeTeamRole`).
struct TeamRoleText: Equatable {
    /// Short and big: „Team Sonne“, „Allein gegen alle“, „Alle zusammen“.
    let title: String
    /// With whom and against whom.
    let detail: String
    let symbol: String
    let hex: String

    init(_ team: ControllerMinigameTeam) {
        let mark = TeamMark.of(team.index)
        if team.role == .koop {
            title = "Alle zusammen"
            detail = "Spielt gemeinsam – jede Hilfe zählt."
            symbol = TeamMark.koop.symbol
            hex = TeamMark.koop.hex
        } else if team.role == .solo {
            title = team.layout == .oneVsOne ? "Eins gegen eins" : "Allein gegen alle"
            let against = "Du gegen \(Self.names(team.opponents))."
            detail = team.advantage ? "\(against) Du hast einen Vorteil." : against
            symbol = mark.symbol
            hex = mark.hex
        } else {
            title = team.layout == .twoVsTwo ? "Team \(mark.name)" : "Gemeinsam gegen eine Person"
            detail = "Du und \(Self.names(team.mates)) gegen \(Self.names(team.opponents))."
            symbol = mark.symbol
            hex = mark.hex
        }
    }

    /// „Blau“, „Blau und Grün“, „Blau, Orange und Grün“ (slot labels like on the web).
    static func names(_ slots: [Int]) -> String {
        let list = slots.map { Slots.style($0).label }
        guard let last = list.last else { return "" }
        guard list.count > 1 else { return last }
        return "\(list.dropLast().joined(separator: ", ")) und \(last)"
    }
}

extension ControllerMinigameTeam {
    /// Outcome from the own point of view in the result (`describeTeamResult`); `nil` while it
    /// is missing (intro, or a result without team outcome).
    var resultText: String? {
        if let tier {
            let max = ProtocolConstants.minigameKoopMaxTier
            return tier == 0
                ? "Leider nicht geschafft (Stufe 0 von \(max))"
                : "Gemeinsam geschafft: Stufe \(tier) von \(max)"
        }
        let solo = role == .solo
        if result == .draw { return "Unentschieden!" }
        if result == .won { return solo ? "Du hast allein gewonnen!" : "Dein Team hat gewonnen!" }
        if result == .lost { return solo ? "Die anderen waren stärker." : "Dein Team hat verloren." }
        return nil
    }
}

/// Role card in the minigame intro (`TeamRole` in `ui/minigame.tsx`): symbol in the team
/// colour, title, and „Du und … gegen …“.
struct TeamRoleCard: View {
    let team: ControllerMinigameTeam

    var body: some View {
        let text = TeamRoleText(team)
        let color = Color(hex: text.hex)
        HStack(spacing: 12) {
            Text(text.symbol)
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(color))
            VStack(alignment: .leading, spacing: 2) {
                Text(text.title).font(.title3.bold())
                Text(text.detail).font(.body.weight(.semibold))
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 8)
        .padding(.leading, 8)
        .padding(.trailing, 14)
        .frame(maxWidth: 400)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(color.opacity(0.3)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(color, lineWidth: 3))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(text.title). \(text.detail)")
    }
}
