// Bot-Partie gegen das gebaute Bündel in einem nackten `node:vm`-Kontext (CHAOS-139).
//   pnpm --filter @chaos-party/apple-host bots                       # bis zum ersten angenommenen Minispiel
//   pnpm --filter @chaos-party/apple-host bots --full                # ganze Partie, alle Minispiele der Rotation
//   pnpm --filter @chaos-party/apple-host bots --full --matches 3    # drei Partien mit Revanche, Speicher je Partie (CHAOS-141)
//   pnpm --filter @chaos-party/apple-host bots --full --rueckenwind  # mit Regel Rückenwind (CHAOS-188)
//   pnpm --filter @chaos-party/apple-host bots --full --teams        # nur die Team-Testspiele (CHAOS-230)
//   pnpm --filter @chaos-party/apple-host bots --full --spieler 4    # 2–4 Bot-Controller (Standard 2)
// Mit `--full` prüft die erste Partie außerdem Pause (Brett, Minispiel), Wiederverbindung (sauber
// und nach Funkstille) und das Finale bis zum Siegerbildschirm, jede weitere „Überspringen“
// (CHAOS-145, `exercise`); `--ohne-extras` lässt das weg.
// Vorher `pnpm --filter @chaos-party/apple-host build`. Exit 1, wenn die Partie nicht sauber läuft
// oder der Speicher nach der ersten Partie um mehr als `MAX_GROWTH_MB` wächst.
import { readFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { BUNDLE_FILE, WASM_FILE } from '../build.mjs';
import { runBotMatch } from '../test/botMatch.ts';

/** Akzeptanzkriterium CHAOS-141: Zuwachs nach drei Partien gegenüber der ersten < 20 MB. */
const MAX_GROWTH_MB = 20;
/** Höchste JS-Zeit je Bild beim Auf- und Abbau eines Minispiels (hier JIT, nur Hinweis). */
const BUILD_KEYS = new Set(['board', 'minigame-intro', 'minigame-results']);

const args = process.argv.slice(2);
const full = args.includes('--full');
const verbose = args.includes('--verbose');
const tailwind = args.includes('--rueckenwind');
const matchesArg = args.indexOf('--matches');
const matches = matchesArg >= 0 ? Number(args[matchesArg + 1]) : 1;
const teamGames = args.includes('--teams');
const playersArg = args.indexOf('--spieler');
const players = playersArg >= 0 ? Number(args[playersArg + 1]) : 2;
if (![2, 3, 4].includes(players))
  throw new Error(`--spieler 2, 3 oder 4, nicht ${String(players)}`);
const exercise = full && !args.includes('--ohne-extras');

setFlagsFromString('--expose-gc');
const gc = /** @type {() => void} */ (runInNewContext('gc'));
const mb = (/** @type {number} */ bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;
/** @type {{ match: number, heapMb: number, externalMb: number, pendingTimers: number }[]} */
const memory = [];
let maxBuildFrameMs = 0;

const started = performance.now();
const result = await runBotMatch({
  code: readFileSync(BUNDLE_FILE, 'utf8'),
  wasm: readFileSync(WASM_FILE),
  full,
  matches,
  tailwind,
  teamGames,
  players: /** @type {2 | 3 | 4} */ (players),
  exercise,
  validateEvery: 30,
  log: verbose ? (line) => console.log(line) : undefined,
  onFrame: (frame) => {
    if (BUILD_KEYS.has(frame.key)) maxBuildFrameMs = Math.max(maxBuildFrameMs, frame.ms);
  },
  onMatchEnd: (match, pendingTimers) => {
    gc();
    const usage = process.memoryUsage();
    // `external` enthält ArrayBuffer und den Wasm-Speicher von Havok.
    memory.push({
      match,
      heapMb: mb(usage.heapUsed),
      externalMb: mb(usage.external),
      pendingTimers,
    });
  },
});
const { ok, phases, ...rest } = result;
const first = memory[0];
const last = memory.at(-1);
const growthMb =
  first && last
    ? Math.round((last.heapMb + last.externalMb - first.heapMb - first.externalMb) * 10) / 10
    : 0;
const memoryOk = memory.length < 2 || growthMb < MAX_GROWTH_MB;
console.log(
  JSON.stringify(
    {
      ...rest,
      phases: phases.length,
      memory,
      growthMb,
      maxBuildFrameMs: Math.round(maxBuildFrameMs * 10) / 10,
    },
    null,
    2,
  ),
);
console.log(
  `${ok && memoryOk ? 'OK' : 'NICHT OK'}: ${String(result.matchesPlayed)} Partie(n), ${String(result.roundsPlayed)} Runden, ` +
    `Minispiele ${result.minigamesBuilt.join(', ')}, ` +
    (memory.length > 1 ? `Speicher +${String(growthMb)} MB nach der ersten Partie, ` : '') +
    `${String(Math.round(performance.now() - started))} ms Rechenzeit`,
);
process.exit(ok && memoryOk ? 0 : 1);
