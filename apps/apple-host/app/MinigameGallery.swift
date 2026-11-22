import SwiftUI

/// Knopf „Minispiele üben“ in der linken Lobby-Spalte (CHAOS-220), wie der Galerie-Knopf im Babylon-Host
/// (`apps/host/src/lobby/LobbyPanel.tsx`). macOS: Maus oder Taste G; tvOS: Fokus mit der Fernbedienung.
struct GalleryButton: View {
    let count: Int
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 14) {
                Text("🎮").font(.system(size: 34))
                VStack(alignment: .leading, spacing: 0) {
                    Text(Self.keys ? "Minispiele üben  (G)" : "Minispiele üben")
                        .font(.system(size: 26, weight: .heavy, design: .rounded))
                    Text(count == 1 ? "1 Minispiel in der Galerie" : "\(count) Minispiele in der Galerie")
                        .font(.system(size: 18, weight: .semibold, design: .rounded)).opacity(0.85)
                }
            }
            .padding(.horizontal, 22).frame(minWidth: 420, minHeight: 76, alignment: .leading)
        }
        .buttonStyle(LobbyChoiceStyle(selected: false))
        .accessibilityLabel("Minispiel-Galerie")
        #if os(macOS)
        .keyboardShortcut("g", modifiers: [])
        #endif
    }

    #if os(macOS)
    private static let keys = true
    #else
    private static let keys = false
    #endif
}

/// Minispiel-Galerie in der Lobby (CHAOS-220) wie `MinigameGallery.tsx` im Babylon-Host (CHAOS-87): alle startbaren
/// Minispiele mit Status, Kategorie, Bedienung und Daumen; „Üben“ startet eine Übungsrunde (`practice:<id>` an den Kern,
/// `start.practice` an den Server), danach geht es von selbst zurück in die Lobby. Am Mac exportiert „Stimmen teilen“
/// dieselbe Datei wie `/ratings.json` am PC. Gestaltet für 1920×1080 wie die Lobby.
///
/// - macOS: Maus; Esc schließt.
/// - tvOS: Fokus mit der Fernbedienung (die Liste scrollt mit), Auswahl übt, Menü schließt. Knöpfe nie `.disabled`,
///   sonst bekommen sie keinen Fokus.
struct MinigameGalleryView: View {
    let rows: [GalleryState.Row]
    let votes: Int
    /// Wie der Start: ab einem verbundenen Controller (bereit muss niemand sein).
    let canPractice: Bool
    let exportURL: URL?
    let practice: (String) -> Void
    let close: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            header
            if !canPractice {
                Text("Üben geht, sobald mindestens ein Controller verbunden ist.")
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .padding(.horizontal, 20).padding(.vertical, 10)
                    .background(Color.orange.opacity(0.35), in: .capsule)
            }
            ScrollView {
                LazyVGrid(columns: [GridItem(.fixed(860), spacing: 28), GridItem(.fixed(860))], spacing: 24) {
                    ForEach(rows) { row in
                        GalleryCard(row: row, canPractice: canPractice) { practice(row.id) }
                    }
                }
                .padding(.vertical, 16)
            }
            #if os(tvOS)
            .scrollClipDisabled()
            #endif
        }
        .padding(.horizontal, 80).padding(.vertical, 60)
        .frame(width: 1920, height: 1080, alignment: .topLeading)
        .background(.black.opacity(0.78))
        #if os(tvOS)
        .onExitCommand(perform: close)
        #endif
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 28) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Minispiel-Galerie").font(.system(size: 64, weight: .black, design: .rounded))
                Text("\(rows.count) Minispiele · \(votes == 1 ? "1 Stimme" : "\(votes) Stimmen") · Übungsrunde ohne Münzen, Daumen am Handy")
                    .font(.system(size: 24, weight: .semibold, design: .rounded)).opacity(0.85)
            }
            Spacer(minLength: 0)
            #if os(macOS)
            if let exportURL {
                ShareLink(item: exportURL, preview: SharePreview("Minispiel-Stimmen")) {
                    Label("Stimmen teilen", systemImage: "square.and.arrow.up")
                        .font(.system(size: 24, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 22).frame(height: 68)
                }
                .buttonStyle(LobbyChoiceStyle(selected: false))
            }
            #endif
            Button(action: close) {
                Text(Self.closeLabel).font(.system(size: 24, weight: .heavy, design: .rounded))
                    .padding(.horizontal, 26).frame(height: 68)
            }
            .buttonStyle(LobbyChoiceStyle(selected: false))
            #if os(macOS)
            .keyboardShortcut(.cancelAction)
            #endif
        }
    }

    #if os(macOS)
    private static let closeLabel = "Schließen  (Esc)"
    #else
    private static let closeLabel = "Schließen"
    #endif
}

/// Eine Karte der Galerie: Titel, Status, Kategorie, Familie, Dauer, Kurzbeschreibung, Bedienung, Daumen, Üben.
struct GalleryCard: View {
    let row: GalleryState.Row
    let canPractice: Bool
    let practice: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    Text(row.title).font(.system(size: 34, weight: .heavy, design: .rounded)).lineLimit(1)
                    chip(row.statusLabel ?? row.status ?? "", row.status == "rotation" ? .green : .white.opacity(0.3))
                    if row.suggestRemoval == true { chip("Rauswurf-Vorschlag", .red) }
                }
                Text(meta).font(.system(size: 20, weight: .semibold, design: .rounded)).opacity(0.75).lineLimit(1)
                if let tagline = row.tagline, !tagline.isEmpty {
                    Text(tagline).font(.system(size: 22, weight: .medium, design: .rounded)).lineLimit(2)
                }
                if let controls = row.controls, !controls.isEmpty {
                    Text(controls).font(.system(size: 19, weight: .medium, design: .monospaced)).opacity(0.8).lineLimit(1)
                }
                HStack(spacing: 18) {
                    Text("👍 \(row.up ?? 0)").font(.system(size: 26, weight: .heavy, design: .rounded)).monospacedDigit()
                    Text("👎 \(row.down ?? 0)").font(.system(size: 26, weight: .heavy, design: .rounded)).monospacedDigit()
                    Text(row.votesText ?? "").font(.system(size: 19, weight: .semibold, design: .rounded)).opacity(0.75)
                }
            }
            Spacer(minLength: 0)
            practiceButton
        }
        .padding(22)
        .frame(width: 860, height: 230, alignment: .topLeading)
        .background(.white.opacity(0.1), in: .rect(cornerRadius: 26))
        .overlay {
            RoundedRectangle(cornerRadius: 26)
                .strokeBorder(row.suggestRemoval == true ? Color.red : Color.white.opacity(0.25), lineWidth: 3)
        }
    }

    private var meta: String {
        [row.category, row.family, row.seconds.map { "\($0) s" }].compactMap { $0 }.filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    @ViewBuilder private var practiceButton: some View {
        #if os(macOS)
        Button(action: practice) { practiceLabel }
            .buttonStyle(LobbyChoiceStyle(selected: canPractice))
            .disabled(!canPractice)
            .accessibilityLabel("\(row.title) üben")
        #else
        Button { if canPractice { practice() } } label: { practiceLabel.opacity(canPractice ? 1 : 0.45) }
            .buttonStyle(LobbyChoiceStyle(selected: canPractice))
            .accessibilityLabel("\(row.title) üben")
        #endif
    }

    private var practiceLabel: some View {
        Text("Üben ▶").font(.system(size: 28, weight: .heavy, design: .rounded))
            .frame(width: 150, height: 76)
    }

    private func chip(_ text: String, _ color: Color) -> some View {
        Text(text).font(.system(size: 18, weight: .bold, design: .rounded))
            .padding(.horizontal, 12).padding(.vertical, 4).background(color, in: .capsule)
    }
}
