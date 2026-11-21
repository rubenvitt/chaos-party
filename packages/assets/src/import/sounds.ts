/**
 * Import der Klänge (CHAOS-223): echte CC0-Aufnahmen statt der prozeduralen Rezepte.
 *
 *   pnpm --filter @chaos-party/assets import:sounds
 *
 * Liest `packages/assets/sounds.json` und lädt die Quellen in einen Zwischenspeicher
 * (`packages/assets/.cache/sounds/`, nicht eingecheckt):
 *
 * - `kenney:<paket>/<datei>`: Audio-Paket von kenney.nl (CC0, Lizenzdatei im Paket wird geprüft);
 * - `freesound:<id>`: HQ-Vorschau (MP3) eines Klangs von freesound.org; die Seite des Klangs muss
 *   die CC0-Lizenz nennen, sonst bricht der Import ab.
 *
 * Jede Datei wird mit ffmpeg auf mono 44,1 kHz gebracht, Stille vorn und hinten abgeschnitten
 * (vorn knapp, damit der Klang sofort kommt), kurz ein- und ausgeblendet und auf einen gemeinsamen
 * Effektivpegel gebracht (−18 dBFS, Spitze höchstens −1 dBFS; bis 6 dB Spitze nimmt ein Begrenzer weg). Kurze Klänge haben keinen
 * verlässlichen LUFS-Wert, darum RMS; die Feinabstimmung im Mix macht `gain` in `sounds.json`.
 *
 * Schreibt `sounds/<name>-<n>.mp3`, `src/soundFiles.ts` (Dauer und Spitze je Datei, für Tests und
 * beide Hosts) und die Manifest-Einträge `klang-…`. Danach
 * `pnpm exec prettier --write packages/assets/manifest.json packages/assets/src/soundFiles.ts`
 * und `pnpm check:assets`.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AssetEntry, AssetManifest } from '../manifest.ts';

interface Layer {
  readonly src: string;
  readonly delay?: number;
  readonly gain?: number;
}
type FileSpec = string | { readonly mix: readonly Layer[] };

interface SoundSpec {
  readonly use: string;
  readonly gain: number;
  readonly jitter: number;
  readonly pitch?: number;
  readonly files: readonly FileSpec[];
}

interface Selection {
  readonly kenneyPacks: Readonly<Record<string, string>>;
  readonly sounds: Readonly<Record<string, SoundSpec>>;
}

/** Herkunft einer Quelle: Datei im Zwischenspeicher, Nachweis-URL und Namensnennung. */
interface Source {
  readonly path: string;
  readonly origin: string;
  readonly credit: string;
}

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const cacheDir = join(packageDir, '.cache', 'sounds');
const outDir = join(packageDir, 'sounds');
const SAMPLE_RATE = 44_100;
const TARGET_RMS_DB = -18;
const MAX_PEAK_DB = -1;
/** Höchstens so viel dB Spitze nimmt der Begrenzer weg. */
const LIMIT_DB = 6;
/** Längster erlaubter Klang (Fanfaren, Jubel); kurze Effekte bleiben weit darunter. */
const MAX_SECONDS = 3.2;
/** Neutraler Browser-Kennzeichner: kenney.nl lehnt Abrufe ohne ab. Keine persönlichen Daten. */
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

const selection = JSON.parse(await readFile(join(packageDir, 'sounds.json'), 'utf8')) as Selection;

function ffmpeg(args: readonly string[]): string {
  return execFileSync('ffmpeg', ['-hide_banner', '-nostdin', '-y', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** ffmpeg schreibt Messwerte nach stderr. */
function ffmpegStderr(args: readonly string[]): string {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffmpeg: ${result.stderr}`);
  return result.stderr;
}

function duration(path: string): number {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
    { encoding: 'utf8' },
  );
  return Number(out.trim());
}

/** Spitze und Effektivwert (dBFS) über die ganze Datei. */
function levels(path: string): { peak: number; rms: number } {
  const out = ffmpegStderr([
    '-i',
    path,
    '-af',
    'astats=measure_overall=Peak_level+RMS_level:measure_perchannel=none',
    '-f',
    'null',
    '-',
  ]);
  const peak = /Peak level dB:\s*(-?[\d.]+|-inf)/.exec(out)?.[1];
  const rms = /RMS level dB:\s*(-?[\d.]+|-inf)/.exec(out)?.[1];
  if (peak === undefined || rms === undefined) throw new Error(`${path}: Pegel nicht messbar`);
  return { peak: Number(peak), rms: Number(rms) };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function download(url: string, target: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
  if (!res.ok) throw new Error(`${url}: HTTP ${String(res.status)}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
}

/** Kenney-Paket laden und entpacken (signierter Link nach Besuch der Seite, wie im Browser). */
async function kenneyPack(pack: string): Promise<string> {
  const dir = join(cacheDir, 'kenney', pack);
  if (existsSync(join(dir, 'License.txt'))) return dir;
  const page = `https://kenney.nl/assets/${pack}`;
  const res = await fetch(page, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${page}: HTTP ${String(res.status)}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const html = await res.text();
  const id = /data-download-id='([0-9a-f]+)'/.exec(html)?.[1];
  if (!id) throw new Error(`${page}: kein Download gefunden`);
  const linkRes = await fetch(`https://kenney.nl/download-link/${id}`, {
    headers: { 'User-Agent': USER_AGENT, Cookie: cookie, Referer: page },
  });
  const link = ((await linkRes.json()) as { url?: string }).url;
  if (!link) throw new Error(`${page}: kein signierter Link`);
  const zip = join(cacheDir, 'kenney', `${pack}.zip`);
  await download(link, zip, { Cookie: cookie, Referer: page });
  await mkdir(dir, { recursive: true });
  execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  return dir;
}

async function findFile(dir: string, name: string): Promise<string | null> {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name === `${name}.ogg`) return join(entry.parentPath, entry.name);
  }
  return null;
}

async function kenneySource(spec: string): Promise<Source> {
  const [pack, name] = spec.split('/') as [string, string | undefined];
  const title = selection.kenneyPacks[pack];
  if (!title || !name) throw new Error(`kenney:${spec}: Paket nicht in kenneyPacks`);
  const dir = await kenneyPack(pack);
  const license = await readFile(join(dir, 'License.txt'), 'utf8');
  if (!license.includes('Creative Commons Zero, CC0')) {
    throw new Error(`kenney:${pack}: License.txt nennt kein CC0`);
  }
  const path = await findFile(dir, name);
  if (!path) throw new Error(`kenney:${spec}: Datei fehlt im Paket`);
  return {
    path,
    origin: `https://kenney.nl/assets/${pack}`,
    credit: `Kenney „${title}“ (kenney.nl), Datei ${name}`,
  };
}

let lastFreesound = 0;

async function freesoundSource(id: string): Promise<Source> {
  const meta = join(cacheDir, 'freesound', `${id}.json`);
  const target = join(cacheDir, 'freesound', `${id}.mp3`);
  if (existsSync(meta) && existsSync(target)) {
    return JSON.parse(await readFile(meta, 'utf8')) as Source;
  }
  // freesound.org drosselt schnelle Abrufe (HTTP 429).
  await sleep(Math.max(0, lastFreesound + 4000 - Date.now()));
  lastFreesound = Date.now();
  const res = await fetch(`https://freesound.org/s/${id}/`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`freesound:${id}: HTTP ${String(res.status)}`);
  const html = await res.text();
  const licenses = new Set(html.match(/creativecommons\.org\/[a-z/.0-9]+/g) ?? []);
  if (licenses.size !== 1 || !licenses.has('creativecommons.org/publicdomain/zero/1.0/')) {
    throw new Error(`freesound:${id}: nicht eindeutig CC0 (${[...licenses].join(', ')})`);
  }
  const preview = /data-mp3="(https:\/\/cdn\.freesound\.org\/previews\/[^"]+)-lq\.mp3"/.exec(
    html,
  )?.[1];
  const title = /<title>Freesound - (.*) by ([^<]+)<\/title>/.exec(html);
  if (!preview || !title?.[1] || !title[2]) throw new Error(`freesound:${id}: Seite unbekannt`);
  await download(`${preview}-hq.mp3`, target);
  const decode = (text: string) =>
    text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#x27;', "'");
  const source: Source = {
    path: target,
    origin: res.url,
    credit: `freesound.org – ${decode(title[2])}: „${decode(title[1])}“ (Nr. ${id})`,
  };
  await writeFile(meta, JSON.stringify(source, null, 2));
  return source;
}

async function source(spec: string): Promise<Source> {
  const [kind, rest] = [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)];
  if (kind === 'kenney') return kenneySource(rest);
  if (kind === 'freesound') return freesoundSource(rest);
  throw new Error(`${spec}: unbekannte Quelle (kenney:… oder freesound:…)`);
}

/** Mono, 44,1 kHz, Stille weg, kurz ein- und ausblenden; optional Tonhöhe verschieben. */
function clean(input: string, output: string, pitch = 1) {
  const trim =
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.004:detection=peak';
  const filters = [
    ...(pitch === 1
      ? []
      : [`asetrate=${String(SAMPLE_RATE * pitch)}`, `aresample=${String(SAMPLE_RATE)}`]),
    trim,
    'areverse',
    trim.replace('-48dB', '-55dB'),
    'areverse',
    'afade=t=in:d=0.003',
  ];
  ffmpeg([
    '-i',
    input,
    '-ac',
    '1',
    '-ar',
    String(SAMPLE_RATE),
    '-af',
    filters.join(','),
    '-c:a',
    'pcm_f32le',
    output,
  ]);
  const length = duration(output);
  const fade = Math.min(0.04, length / 4);
  const faded = `${output}.fade.wav`;
  ffmpeg([
    '-i',
    output,
    '-af',
    `afade=t=out:st=${(length - fade).toFixed(4)}:d=${fade.toFixed(4)}`,
    '-c:a',
    'pcm_f32le',
    faded,
  ]);
  return faded;
}

async function render(file: FileSpec, name: string, index: number, pitch: number) {
  const work = join(cacheDir, 'work', `${name}-${String(index)}`);
  await mkdir(work, { recursive: true });
  const layers: Layer[] = typeof file === 'string' ? [{ src: file }] : [...file.mix];
  const sources: Source[] = [];
  const parts: string[] = [];
  for (const [i, layer] of layers.entries()) {
    const src = await source(layer.src);
    sources.push(src);
    const part = join(work, `layer-${String(i)}.wav`);
    const delayMs = Math.round((layer.delay ?? 0) * 1000);
    ffmpeg([
      '-i',
      src.path,
      '-ac',
      '1',
      '-ar',
      String(SAMPLE_RATE),
      '-af',
      `adelay=${String(delayMs)},volume=${String(layer.gain ?? 1)}`,
      '-c:a',
      'pcm_f32le',
      part,
    ]);
    parts.push(part);
  }
  const [firstPart] = parts;
  if (firstPart === undefined) throw new Error(`${name}: keine Quelle`);
  let mixed = firstPart;
  if (parts.length > 1) {
    mixed = join(work, 'mix.wav');
    ffmpeg([
      ...parts.flatMap((p) => ['-i', p]),
      '-filter_complex',
      `amix=inputs=${String(parts.length)}:normalize=0:duration=longest`,
      '-c:a',
      'pcm_f32le',
      mixed,
    ]);
  }
  const cleaned = clean(mixed, join(work, 'clean.wav'), pitch);
  const { peak, rms } = levels(cleaned);
  // Spitzen dürfen bis LIMIT_DB über −1 dBFS hinaus angehoben werden; der Begrenzer fängt sie ab.
  // So kommen kurze Klänge mit hoher Spitze (Würfel, Münzen) nicht viel leiser als der Rest.
  const gainDb = Math.min(TARGET_RMS_DB - rms, MAX_PEAK_DB - peak + LIMIT_DB);
  const rel = `sounds/${name}-${String(index + 1)}.mp3`;
  const target = join(packageDir, rel);
  ffmpeg([
    '-i',
    cleaned,
    '-af',
    `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${String(10 ** (MAX_PEAK_DB / 20))}:attack=1:release=40:level=disabled`,
    '-c:a',
    'libmp3lame',
    '-q:a',
    '3',
    '-ar',
    String(SAMPLE_RATE),
    '-ac',
    '1',
    '-map_metadata',
    '-1',
    '-id3v2_version',
    '0',
    target,
  ]);
  const seconds = duration(target);
  if (seconds > MAX_SECONDS)
    throw new Error(`${rel}: ${seconds.toFixed(2)} s > ${String(MAX_SECONDS)} s`);
  const after = levels(target);
  return { rel, seconds, peak: after.peak, rms: after.rms, sources };
}

/** Budget: Dateigröße + 25 %, auf 4 KiB aufgerundet, höchstens das Budget der Art. */
function budget(bytes: number, kindMax: number): number {
  return Math.min(kindMax, Math.ceil((bytes * 1.25) / 4096) * 4096);
}

const manifestPath = join(packageDir, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as AssetManifest;
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const entries: AssetEntry[] = [];
const index: Record<
  string,
  { gain: number; jitter: number; files: { file: string; duration: number; peakDb: number }[] }
> = {};
let total = 0;

for (const [name, spec] of Object.entries(selection.sounds)) {
  const files: { file: string; duration: number; peakDb: number }[] = [];
  for (const [i, file] of spec.files.entries()) {
    const out = await render(file, name, i, spec.pitch ?? 1);
    const bytes = (await stat(join(packageDir, out.rel))).size;
    total += bytes;
    files.push({
      file: out.rel.slice('sounds/'.length),
      duration: round(out.seconds, 3),
      peakDb: round(out.peak, 1),
    });
    const [first, ...rest] = out.sources;
    if (!first) throw new Error(`${name}: keine Quelle`);
    entries.push({
      id: `klang-${name}-${String(i + 1)}`,
      kind: 'sound',
      source: 'imported',
      path: `packages/assets/${out.rel}`,
      description: `${spec.use}: ${out.seconds.toFixed(2)} s, mono MP3, Variante ${String(i + 1)}/${String(spec.files.length)}${rest.length > 0 ? `, gemischt mit ${rest.map((s) => s.credit).join(' und ')}` : ''}.`,
      license: 'CC0-1.0',
      attribution: [first, ...rest].map((s) => s.credit).join('; ') + ' (CC0)',
      origin: first.origin,
      budgetBytes: budget(bytes, manifest.budgets.sound.maxBytes),
    });
    console.log(
      `  ${out.rel}: ${out.seconds.toFixed(2)} s, ${(bytes / 1024).toFixed(1)} KiB, Spitze ${out.peak.toFixed(1)} dB, RMS ${out.rms.toFixed(1)} dB`,
    );
  }
  index[name] = { gain: spec.gain, jitter: spec.jitter, files };
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

manifest.assets = [...manifest.assets.filter((a) => !a.id.startsWith('klang-')), ...entries];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const ts = `/**
 * Klang-Dateien (CHAOS-223), erzeugt von \`src/import/sounds.ts\` aus \`sounds.json\` – nicht von Hand
 * ändern. Je Klang: Lautstärke im Mix, Tonhöhen-Streuung und die Dateien unter \`sounds/\` mit Dauer
 * (s) und Spitzenpegel (dBFS). Browser-Host und Apple-Host wählen daraus (\`apps/host/src/fx/samples.ts\`).
 */
export interface SoundFile {
  readonly file: string;
  readonly duration: number;
  readonly peakDb: number;
}

export interface SoundFileSet {
  readonly gain: number;
  readonly jitter: number;
  readonly files: readonly SoundFile[];
}

export const SOUND_FILES: Readonly<Record<string, SoundFileSet>> = ${JSON.stringify(index, null, 2)};
`;
await writeFile(join(packageDir, 'src', 'soundFiles.ts'), ts);
console.log(
  `${String(entries.length)} Dateien in packages/assets/sounds, zusammen ${(total / 1024).toFixed(0)} KiB`,
);
