// Loads universities, state boards, metros and metro pull into Postgres. Safe to re-run: every write is an upsert or a
// replace per university. Run: npx --yes tsx scripts/load-db.mts
// Pull comes from the young-audience heatmaps (people 24 and younger), as amendment 2's result decided; --all-ages loads the
// original all-ages pull instead.
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { stateBoard, type StateInfo } from "../src/lib/score/board";
import { metroPull, type Metro } from "../src/lib/score/metros";
import type { Cell } from "../src/lib/score/pull";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const sql = neon(env.DATABASE_URL);
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

for (const statement of readFileSync("db/schema.sql", "utf8").split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean)) {
  await sql.query(statement);
}

const { universities } = read("data/ipeds/universities.json") as { universities: { unitid: number; name: string; city: string; state: string; stateFips: number; lat: number; lon: number; control: string | null; website: string | null; firstTime2022: number; outOfStateShare2022: number }[] };
const states: StateInfo[] = read("data/geo/states.json").states;
const metros: Metro[] = read("data/geo/metros.json").metros;
const residence = read("data/ipeds/residence.json").fall2022 as Record<string, { total: number; states: Record<string, number> }>;
const strict = read("data/cache/resolved.json") as Record<string, { entityId: string | null; qlooName?: string; pilot?: boolean }>;
const extra = existsSync("data/cache/resolved-extra.json") ? (read("data/cache/resolved-extra.json") as Record<string, { entityId: string | null; qlooName?: string }>) : {};
const AUDIENCE = process.argv.includes("--all-ages") ? "" : "-young";
// Matched by name to a Qloo entity that isn't the university: Bentley University's alias "Bentley" is a luggage brand. It was never
// scored (its all-ages heatmap covered two states), and it stays out of the product.
const NOT_THE_UNIVERSITY = new Set([164739]);
const pulls = read(`data/cache/state-pulls${AUDIENCE}.json`) as Record<string, Record<string, { pull: number }>>;

for (const m of metros) {
  await sql`insert into metros (cbsa, name, city, states, pop2025, lat, lon) values (${m.cbsa}, ${m.name}, ${m.city}, ${m.states}, ${m.pop2025}, ${m.lat}, ${m.lon})
    on conflict (cbsa) do update set name = excluded.name, city = excluded.city, states = excluded.states, pop2025 = excluded.pop2025, lat = excluded.lat, lon = excluded.lon`;
}

let loaded = 0;
for (const u of universities) {
  const match = strict[u.unitid]?.entityId ? strict[u.unitid] : extra[u.unitid]?.entityId ? extra[u.unitid] : null;
  if (NOT_THE_UNIVERSITY.has(u.unitid)) continue;
  const heatmapFile = `data/cache/heatmaps${AUDIENCE}/${u.unitid}.json`;
  if (!match?.entityId || !pulls[u.unitid] || !existsSync(heatmapFile)) continue;
  const r = residence[u.unitid];
  const freshmen = Object.fromEntries(Object.entries(r.states).map(([k, v]) => [Number(k), v]));
  const board = stateBoard(u, states, freshmen, pulls[u.unitid]);
  if (!board.length) continue;
  const inTest = Boolean(strict[u.unitid]?.entityId) && !strict[u.unitid]?.pilot;
  await sql`insert into universities (unitid, name, qloo_entity_id, qloo_name, city, state, state_fips, lat, lon, control, website, first_time_2022, home_2022, out_share_2022, in_test)
    values (${u.unitid}, ${u.name}, ${match.entityId}, ${match.qlooName ?? u.name}, ${u.city}, ${u.state}, ${u.stateFips}, ${u.lat}, ${u.lon}, ${u.control}, ${u.website}, ${r.total}, ${r.states[u.stateFips] ?? 0}, ${u.outOfStateShare2022}, ${inTest})
    on conflict (unitid) do update set name = excluded.name, qloo_entity_id = excluded.qloo_entity_id, qloo_name = excluded.qloo_name, city = excluded.city,
      state = excluded.state, state_fips = excluded.state_fips, lat = excluded.lat, lon = excluded.lon, control = excluded.control, website = excluded.website,
      first_time_2022 = excluded.first_time_2022, home_2022 = excluded.home_2022, out_share_2022 = excluded.out_share_2022, in_test = excluded.in_test`;
  await sql`delete from state_board where unitid = ${u.unitid}`;
  await sql`insert into state_board (unitid, state, fips, freshmen, expected, pull, grp, gap)
    select ${u.unitid}, * from unnest(${board.map((b) => b.state)}::text[], ${board.map((b) => b.fips)}::int[], ${board.map((b) => b.freshmen)}::int[],
      ${board.map((b) => b.expected)}::int[], ${board.map((b) => b.pull)}::float8[], ${board.map((b) => b.group)}::text[], ${board.map((b) => b.gap)}::int[])`;
  const cells: Cell[] = read(heatmapFile);
  const hot = metroPull(cells, metros, u);
  await sql`delete from metro_pull where unitid = ${u.unitid}`;
  if (hot.length) {
    await sql`insert into metro_pull (unitid, cbsa, pull, cells, distance_km)
      select ${u.unitid}, * from unnest(${hot.map((h) => h.metro.cbsa)}::text[], ${hot.map((h) => Math.round(h.pull * 1000) / 1000)}::float8[], ${hot.map((h) => h.cells)}::int[], ${hot.map((h) => h.distanceKm)}::int[])`;
  }
  loaded++;
}
console.log(`metros ${metros.length}; universities loaded ${loaded}`);
