/**
 * Check that the TypeScript build matches build.py exactly.
 *
 * 1. Runs build.py on ../raw with its output redirected to data/python-baseline.js
 *    (site/data.js is left alone).
 * 2. Builds the library in TypeScript from the raw feeds stored in the DB
 *    (import them first: pnpm --filter @ugs/server import:legacy).
 * 3. Compares every game and listing, field by field, including order.
 *
 * Usage:  pnpm --filter @ugs/server parity
 * Needs Python on PATH (or set PYTHON). Goes away with the Python scripts.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Game, Store } from "@ugs/shared";
import { buildLibrary } from "../src/catalog/build.ts";
import { SERVER_ROOT, config } from "../src/config.ts";
import { openDb } from "../src/db/client.ts";
import { loadBuildInput } from "../src/db/library.ts";
import { syncStores } from "../src/db/stores.ts";

const REPO = path.resolve(SERVER_ROOT, "..");
const BASELINE = path.join(SERVER_ROOT, "data", "python-baseline.js");
const EXAMPLES = 5;

console.log("running build.py ...");
execFileSync(
  process.env.PYTHON ?? "python",
  ["-c", `import build; from pathlib import Path; build.OUT = Path(${JSON.stringify(BASELINE)}); build.build()`],
  { cwd: REPO, stdio: "inherit", env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
);
const py = JSON.parse(
  fs.readFileSync(BASELINE, "utf-8").replace(/^window\.LIBRARY = /, "").replace(/;\s*$/, ""),
) as { stores: Store[]; games: Game[] };

console.log("building in TypeScript ...");
const db = openDb(config.DB_PATH);
const t0 = performance.now();
const ts = buildLibrary(loadBuildInput(db, syncStores(db, config.STORES_FILE)));
console.log(`built in ${Math.round(performance.now() - t0)} ms`);

const problems: Record<string, string[]> = {};
const report = (kind: string, detail: string) => (problems[kind] ??= []).push(detail);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Same input? build.py wrote local time without a zone; the DB stores UTC.
for (const s of py.stores) {
  const t = ts.stores.find((x) => x.id === s.id);
  if (!t) report("store missing in TS", s.id);
  else if (new Date(s.fetched_at!).toISOString() !== t.fetched_at)
    report("store fetched_at differs (DB raw feeds are not the ones in raw/ - re-run import:legacy)", `${s.id}: ${s.fetched_at} vs ${t.fetched_at}`);
}

const pyById = new Map(py.games.map((g) => [g.id, g]));
const tsById = new Map(ts.games.map((g) => [g.id, g]));
for (const g of py.games) if (!tsById.has(g.id)) report("game only in Python", `${g.id} (${g.listings.length} listings)`);
for (const g of ts.games) if (!pyById.has(g.id)) report("game only in TS", `${g.id} (${g.listings.length} listings)`);

for (const p of py.games) {
  const t = tsById.get(p.id);
  if (!t) continue;
  for (const field of ["title", "kind", "genres", "image"] as const)
    if (!same(p[field], t[field])) report(`game.${field}`, `${p.id}: ${JSON.stringify(p[field])} vs ${JSON.stringify(t[field])}`);
  if (p.listings.length !== t.listings.length) {
    report("listing count", `${p.id}: ${p.listings.length} vs ${t.listings.length}`);
    continue;
  }
  p.listings.forEach((pl, i) => {
    const tl = t.listings[i]!;
    for (const field of Object.keys(pl) as (keyof typeof pl)[])
      if (!same(pl[field], tl[field])) report(`listing.${field}`, `${p.id} #${i}: ${JSON.stringify(pl[field])} vs ${JSON.stringify(tl[field])}`);
  });
}

if (same(py.games.map((g) => g.id), ts.games.map((g) => g.id)) === false && !problems["game only in Python"] && !problems["game only in TS"])
  report("game order", "same games, different order");

const count = (lib: { games: Game[] }) => lib.games.reduce((n, g) => n + g.listings.length, 0);
console.log(`\nPython: ${py.games.length} games, ${count(py)} listings`);
console.log(`TS:     ${ts.games.length} games, ${count(ts)} listings\n`);

const kinds = Object.keys(problems);
if (!kinds.length) {
  console.log("PARITY OK: identical output");
  process.exit(0);
}
for (const kind of kinds) {
  const list = problems[kind]!;
  console.log(`${kind}: ${list.length}`);
  for (const d of list.slice(0, EXAMPLES)) console.log(`   ${d}`);
}
process.exit(1);
