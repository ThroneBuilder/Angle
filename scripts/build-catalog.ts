// Builds the versioned parts catalog from a dated Rebrickable snapshot (research R8; T039).
// A part and color count as currently produced if they appear in a set released this year or
// last year. Only the candidate parts in src/catalog/candidates.ts are kept. Run with
// `pnpm catalog`, review the warnings, and commit the JSON it writes.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { allCandidateParts, COLORS } from '../src/catalog/candidates.ts';

const BASE = 'https://cdn.rebrickable.com/media/downloads/';
const FILES = ['colors', 'sets', 'inventories', 'inventory_parts', 'parts'] as const;

/** Split one CSV line, honoring double-quoted fields. */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

async function download(name: (typeof FILES)[number]) {
  const url = `${BASE}${name}.csv.gz`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const gz = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(gz).digest('hex');
  const lines = gunzipSync(gz).toString('utf8').split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitCsv(lines[0]!);
  const rows = lines.slice(1).map((l) => {
    const cells = splitCsv(l);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
  console.log(`${name}: ${rows.length} rows`);
  return { url, sha256, rows };
}

const today = new Date().toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));
type Download = Awaited<ReturnType<typeof download>>;
const files = Object.fromEntries(await Promise.all(FILES.map(async (f) => [f, await download(f)] as const))) as Record<
  (typeof FILES)[number],
  Download
>;

const recentSets = new Set(files.sets.rows.filter((s) => Number(s.year) >= year - 1).map((s) => s.set_num));
const recentInventories = new Set(files.inventories.rows.filter((i) => recentSets.has(i.set_num)).map((i) => i.id));
const candidates = new Set(allCandidateParts());
const current = new Map<string, Set<number>>();
for (const row of files.inventory_parts.rows) {
  if (!candidates.has(row.part_num!) || !recentInventories.has(row.inventory_id)) continue;
  if (row.is_spare === 't' || row.is_spare === 'True') continue;
  const colors = current.get(row.part_num!) ?? new Set<number>();
  colors.add(Number(row.color_id));
  current.set(row.part_num!, colors);
}

const partNames = new Map(files.parts.rows.map((p) => [p.part_num!, p.name!]));
const usedColors = new Set<number>([...current.values()].flatMap((s) => [...s]));
const colors = Object.fromEntries(
  files.colors.rows
    .filter((c) => usedColors.has(Number(c.id)))
    .map((c) => [Number(c.id), { name: c.name!, ldrawCode: Number(c.id), rgb: `#${c.rgb}` }]),
);
const parts = Object.fromEntries(
  [...current.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'en', { numeric: true }))
    .map(([part, cs]) => [part, { name: partNames.get(part) ?? part, ldrawFile: `${part}.dat`, colors: [...cs].sort((a, b) => a - b) }]),
);

const warnings: string[] = [];
for (const part of candidates) if (!current.has(part)) warnings.push(`Part ${part} (${partNames.get(part) ?? 'unknown'}) is not in any ${year - 1}–${year} set.`);
for (const [role, color] of Object.entries(COLORS)) {
  for (const [part, info] of Object.entries(parts)) {
    if (!info.colors.includes(color)) warnings.push(`Default ${role} color ${color} is not current for part ${part}; a substitute color will be used.`);
  }
}

const version = `lego-angle-${today}`;
const catalog = {
  version,
  snapshotDate: today,
  yearWindow: [year - 1, year],
  source: {
    provider: 'Rebrickable',
    license: 'Rebrickable data downloads (free to use)',
    files: Object.fromEntries(FILES.map((f) => [f, { url: files[f].url, sha256: files[f].sha256 }])),
  },
  parts,
  colors,
  warnings,
};
const out = new URL(`../src/catalog/${version}.json`, import.meta.url);
writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Wrote src/catalog/${version}.json: ${Object.keys(parts).length} parts, ${Object.keys(colors).length} colors.`);
for (const w of warnings) console.warn(`WARNING: ${w}`);
