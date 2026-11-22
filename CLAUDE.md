# Claude Code — Operating Instructions for Chaos Party

Read `VISION.md`, `ARCHITECTURE.md` and `ROADMAP.md` before making product or architectural changes. The files together are the project's source of truth. **Do not reinterpret iPads as game hosts: the game runs on a host computer — a PC (Babylon.js in the browser), or since 2026-11-17 a Mac or an Apple TV via the native RealityKit host (Ruben: „Ja, Apple TV als Host“, ADR-019); iPhones/iPads are controllers only.**

## Mission and authority

Build Chaos Party with **highly autonomous, experimental, code-first development**. Plan, implement, test, inspect, correct, integrate and document without seeking approval for routine implementation decisions. Work in **vertical increments** and stop for **human product acceptance at M1, M2, M3 and M4**. Do not claim human approval unless explicitly received.

### Decisions you may make independently

- Architecture details consistent with `ARCHITECTURE.md` and established ADRs.
- Feature decomposition, sequencing within a milestone, test design, refactoring and bug fixes.
- Original minigame, item, board-event and art experiments within the product vision.
- Selection of open-source dependencies and properly licensed free assets after security/license review.
- Replacement of unsuccessful prototypes when supported by evidence.

### Escalate or obtain explicit approval for

- Changes to product pillars, the set of host devices (PC, Mac, Apple TV; see ADR-019), 2–4-player local multiplayer, phone/shared-iPad controls or trophy-focused victory.
- Significant scope increase, paid services/assets, irreversible operations, credential access, external publication or deployment outside the local development environment.
- A milestone's human acceptance; unresolvable blockers; legal/licensing ambiguity; repeated failed fixes.
- Major architectural pivots (e.g., replacing Babylon.js) after a documented spike.

## Development cycle

1. **Orient:** inspect repository and documents; identify current milestone, blockers and last validated state. In Zunder: find the next unblocked `CHAOS-…` task of the current milestone (skill `aufgabe-umsetzen`).
2. **Plan:** create a short task plan with explicit acceptance criteria and dependencies. Prefer the smallest complete vertical feature. Claim the task, set it `in_progress` and write the plan into its `plan` field.
3. **Implement:** work code-first, preserve clear module boundaries, use small reviewable changes.
4. **Verify:** run relevant checks and tests; inspect runtime behavior and visual output when applicable.
5. **Repair:** diagnose failures, fix root causes, rerun checks; do not disable tests to get green.
6. **Record:** update decision log, experiment log, progress and remaining risks. In Zunder: result comment, `pr_url`, status `review`, release the claim; follow-ups as new tasks.
7. **Continue:** advance autonomously until milestone acceptance is required or a blocker demands intervention.

## Task management with Zunder

All work is tracked in **Zunder** (MCP server `Zunder`, tools `mcp__Zunder__*`), project **Chaos Party**, key **`CHAOS`**, repo `rubenvitt/Chaos-Party`. Zunder is the source of truth for *what* is being done and its status; the repository docs remain the source of truth for *product, architecture and decisions*. The general Zunder dev workflow (claims, fields, status trail, follow-ups) is described in the user-level skill `zunder-dev`; the project skills in `.claude/skills/` add the Chaos-Party-specific rules. Write all Zunder content (titles, descriptions, comments, plans) in **German**.

### Structure

| Ref | Meaning |
|---|---|
| `CHAOS-1` … `CHAOS-4` | Milestone epics M1–M4. Their subtasks are the milestone's work items, linked via `blocked_by` in dependency order. |
| `CHAOS-16`, `CHAOS-25`, `CHAOS-35`, `CHAOS-43` | **Human acceptance gates** for M1–M4. A gate may be `blocked_by` the work tasks of its milestone, but **no task is ever `blocked_by` a gate** (see "Nothing waits on Ruben in Zunder"). The next milestone's first tasks are `blocked_by` the previous milestone's last work tasks; the gate approval itself is a working rule, not a Zunder dependency. |
| `CHAOS-44` | Deferred backlog: ideas and features outside the current milestone (see ROADMAP "Prioritization and scope control"). |

Always resolve the project ID freshly via `list_structure` (match `repo`); never copy IDs from notes. Refs (`CHAOS-12`) are stable and may be used anywhere.

### Rules

- **Pick work by dependency, not by number.** Only start tasks whose status is `open` and whose `blocked_by` are all done. Never start a task of a milestone whose gate predecessor is not done.
- **Claim before work.** `claim_task` with agent name `claude-code@<place>` (cloud: `claude-code@cloud-<word>-<word>` from the harness branch). Never break someone else's valid claim.
- **Field discipline.** `description` = the ticket, do not overwrite (only append Ruben's decisions under `## Notizen` with date). `plan` = current state in 1–3 sentences, overwrite as it changes. Progress, results, deviations from acceptance criteria and questions → `add_comment`. Set `branch` and `pr_url` as soon as known.
- **Status trail:** `open → in_progress → review → done`; `blocked` only through `blocked_by` on another work task; `dropped` with a reason instead of deleting. Never `delete_task` without explicit confirmation.
- **Nothing waits on Ruben in Zunder** (Ruben, 2026-11-17: „keine Abhängigkeit an mich. aber bei tasks ist Abhängigkeit okay“). A task that waits for Ruben (decision, device test, data, account, gate approval) stays **`open`**: never `blocked`, never `review` for that reason, never `waiting_on: "Ruben"`, and never `blocked_by` a task that only Ruben can finish (gates, "Ruben: …" tasks, interim acceptances). Write what Ruben has to do as a comment and in `plan` ("Wartet auf Ruben: …"). Dependencies between work tasks via `blocked_by` are fine.
- **Commits and PRs** name the ref (`CHAOS-12`) in the commit body and PR description. PR base is `main` unless stated otherwise.
- **Conventional Commits** (Ruben, 2026-11-18, CHAOS-156): every commit header is `<type>(<scope>)?: <Betreff>` with `feat`, `fix`, `perf`, `docs`, `test`, `refactor`, `build`, `ci`, `chore`, `style` or `revert`; the subject may stay German. semantic-release derives the Mac app's version from them (`feat` → minor, `fix`/`perf` → patch, `BREAKING CHANGE:` footer → major; other types release nothing), so pick the type by what players get: a new game feature is `feat`, a bug they would notice is `fix`, docs/tests/tooling are not. The CI job „Commit-Nachrichten“ (commitlint, `commitlint.config.mjs`) fails PRs with non-conforming commits; merge commits are exempt.
- **Gates are Ruben's.** Claude prepares the acceptance report and comments it on the gate task (skill `meilenstein-abnahme`), but sets a gate task to `done` **only** after Ruben explicitly approves in chat or in a Zunder comment, quoting that decision. "Changes requested" becomes new tasks under the milestone epic that the gate is `blocked_by`.
- **Scope control.** Anything not needed for the current milestone or its testability goes as a subtask under `CHAOS-44`, not into the current milestone. Ideas that would need approval (see "Escalate or obtain explicit approval") are only recorded there, never implemented.
- **Follow-ups** (bugs, tech debt, open questions found on the way) are created autonomously in the project, under the matching milestone epic, with `## Kontext / ## Zu tun / ## Akzeptanzkriterien / ## Referenzen`. List created tasks at the end of the reply.
- **Experiments** are logged in `docs/experiments.md` *and* summarized as a comment on the task that triggered them (skill `experiment-protokollieren`).
- **Blockers** after the failure policy's three attempts: the smallest question as a comment, `plan` = "Wartet auf Ruben: …", status `open` (claim released), entry in `docs/blockers.md` (skill `blocker-eskalieren`).
- **Do not set** `due`, `remind_at`, `phoenix`, `weight` or flames on tasks unless Ruben asks.

### Project skills

| Skill | Use when |
|---|---|
| `aufgabe-umsetzen` | Implementing a `CHAOS-…` task, or "do the next task" |
| `meilenstein-abnahme` | All work tasks of a milestone are done; preparing or recording a gate decision |
| `experiment-protokollieren` | A gameplay/art/tech experiment needs hypothesis, variants, results and decision recorded |
| `blocker-eskalieren` | Three serious attempts failed, or a decision outside Claude's authority is needed |

## Agent delegation and concurrency

Parallelize **independent, well-bounded** work only (e.g., controller UI, game rules, asset pipeline, test harness). Give each subagent ownership of files/interfaces and acceptance criteria. Avoid simultaneous edits to the same files. Use isolated branches/worktrees where available; integrate through a designated coordinator. Keep shared contracts stable, run integration tests after merging, and avoid creating agents merely to maximize agent count. Subagents and workflow workers **do not write to Zunder**; the coordinator owns claims, status, comments and follow-ups.

## Quality gates (mandatory when relevant)

- `pnpm install --frozen-lockfile` or documented equivalent succeeds in CI.
- TypeScript strict typecheck, lint, formatting verification and production build succeed.
- Unit tests cover pure game rules, state transitions, scoring, dice and item effects.
- Deterministic integration tests cover full turns and minigame transitions with seeded randomness.
- Playwright E2E covers lobby, join, controller input, round flow and winner screen; include screenshot/visual checks for changed UI/3D scenes.
- Controller protocol validation, malformed input, reconnect behavior and multiple simultaneous player inputs are tested.
- No critical runtime exceptions, broken assets or unhandled state transitions.
- Security and license checks for dependencies/assets; no secrets in repository.
- Relevant documentation and acceptance criteria are updated.

**Reality check:** browser automation and emulators cannot prove real iOS multitouch, local-network discovery, sensors or input latency. M1 must include a human-performed real-device test checklist and evidence; do not fabricate hardware validation.

## Definition of Done

A task is done only if its user-visible behavior is implemented, tests and builds pass, regressions are checked, documentation is updated, and known limitations are recorded. A **milestone** is complete only when automated gates pass **and** the human explicitly accepts the experience. A green test suite does not prove a game is fun.

## Experiment protocol

For meaningful gameplay experiments, add an entry to `docs/experiments.md` (create if absent):

- Hypothesis and intended player experience.
- Variants/prototypes and expected tradeoffs.
- Objective indicators (e.g., round duration, clarity, disconnect rate, collision stability, input delay) and subjective playtest questions.
- Test environment, seed, results, screenshots/video references where possible.
- Decision: keep, iterate or discard, with rationale.

You may choose the winning variant **within the approved vision**. Do not mistake automated simulation for a human fun test.

## Failure and blocker policy

Try a bounded series of materially different fixes (default maximum **three** serious attempts per root cause), then summarize evidence, options and the smallest question needed from the human. Do not loop indefinitely, mask failures, weaken acceptance criteria or silently drop scope. Maintain a `docs/blockers.md` if needed, and mirror every blocker on the Zunder task (question as comment; status `open` when it waits on Ruben, `blocked_by` when it waits on another task).

## Working artifacts

Maintain:
- `docs/decisions/` for architecture decision records (ADRs).
- `docs/experiments.md` for gameplay and art experiments.
- `docs/progress.md` for milestone status, validated commands and next steps. **One entry per line:** add your status entry as its own line `- CHAOS-<n> (YYYY-MM-DD): …` at the top of the „Stand“ list, never append to an existing line. The file merges with `merge=union` (`.gitattributes`); after merging `main`, delete any duplicated old version of a line both sides changed (details in the file, section „Einträge in dieser Datei“).
- `docs/device-test-checklist.md` for actual iPhone/iPad verification.
- `docs/acceptance/M<n>.md` for each milestone acceptance report (template in `ROADMAP.md`).

Division of labour: Zunder holds task status, current plan, per-task progress comments and follow-ups. The repository holds durable knowledge (ADRs, experiment log, progress snapshot, checklists, acceptance reports). Link both ways: refs (`CHAOS-12`) in docs, file paths in Zunder comments.

## First assignment

Start **M1** from `ROADMAP.md` via Zunder: `CHAOS-5` (assumptions + working artifacts) and `CHAOS-6` (monorepo) are the first unblocked tasks; continue along the `blocked_by` chain of `CHAOS-1` up to the gate `CHAOS-16`. Scaffold the smallest maintainable pnpm TypeScript monorepo. Prove the controller-to-PC path, a basic Babylon.js/Havok scene, and a two-player shared-iPad multitouch UI. Provide executable tests, QR joining instructions, real-device test checklist and a concise M1 acceptance report. **Do not start M2 until M1 is explicitly approved by the human.**
