// Loads each university's audience map cells: heatmap cells with affinity >= MIN_AFFINITY, projected to the app's map.
// Run: npx --yes tsx scripts/load-cells.mts
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { geohashCentre } from "../src/lib/geo/geo";
import { project } from "../src/lib/geo/project";
import type { Cell } from "../src/lib/score/pull";

const MIN_AFFINITY = 0.5;
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const sql = neon(env.DATABASE_URL);
await sql.query("create table if not exists audience_cells (unitid integer primary key references universities(unitid) on delete cascade, cells jsonb not null)");

const ids = (await sql`select unitid from universities`) as { unitid: number }[];
let loaded = 0, cellsTotal = 0;
for (const { unitid } of ids) {
  const file = `data/cache/heatmaps/${unitid}.json`;
  if (!existsSync(file)) continue;
  const cells: Cell[] = JSON.parse(readFileSync(file, "utf8"));
  const out: [number, number, number][] = [];
  for (const [hash, affinity] of cells) {
    if (affinity < MIN_AFFINITY) continue;
    const [lon, lat] = geohashCentre(hash);
    const xy = project(lon, lat);
    if (xy) out.push([xy[0], xy[1], Math.round(affinity * 100) / 100]);
  }
  await sql`insert into audience_cells (unitid, cells) values (${unitid}, ${JSON.stringify(out)}) on conflict (unitid) do update set cells = excluded.cells`;
  loaded++;
  cellsTotal += out.length;
}
console.log(`audience cells for ${loaded} universities, ${Math.round(cellsTotal / Math.max(loaded, 1))} cells each on average`);
