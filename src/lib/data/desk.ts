// What the pages read: the university list and one university's desk (state board and metro hotspots), all from Postgres.

import paths from "../../../data/geo/state-paths.json";
import { sql } from "../db";
import type { Group } from "../score/board";

const ABBR: Record<string, string> = Object.fromEntries((paths.paths as { name: string; abbr: string }[]).map((p) => [p.name, p.abbr]));
export const stateAbbr = (name: string) => ABBR[name] ?? name.slice(0, 2).toUpperCase();

export interface UniversitySummary {
  unitid: number;
  name: string;
  city: string;
  state: string;
  control: string | null;
  firstTime2022: number;
  outShare2022: number;
}

type UniRow = { unitid: number; name: string; city: string; state: string; control: string | null; first_time_2022: number; out_share_2022: number };
const summary = (r: UniRow): UniversitySummary => ({ unitid: r.unitid, name: r.name, city: r.city, state: r.state, control: r.control, firstTime2022: r.first_time_2022, outShare2022: r.out_share_2022 });

export async function listUniversities(): Promise<UniversitySummary[]> {
  const rows = (await sql()`select unitid, name, city, state, control, first_time_2022, out_share_2022 from universities order by name`) as UniRow[];
  return rows.map(summary);
}

export interface StateRow {
  state: string;
  abbr: string;
  freshmen: number;
  expected: number;
  pull: number;
  group: Group;
  gap: number;
}

export interface MetroRow {
  cbsa: string;
  name: string;
  city: string;
  states: string[];
  pop2025: number;
  pull: number;
  distanceKm: number;
}

export interface Desk {
  university: UniversitySummary & { qlooEntityId: string; qlooName: string; home2022: number; website: string | null; lat: number; lon: number; inTest: boolean };
  board: StateRow[];
  metros: MetroRow[];
}

export async function getDesk(unitid: number): Promise<Desk | null> {
  const db = sql();
  const [u] = (await db`select unitid, name, city, state, control, first_time_2022, out_share_2022, qloo_entity_id, qloo_name, home_2022, website, lat, lon, in_test
    from universities where unitid = ${unitid}`) as (UniRow & { qloo_entity_id: string; qloo_name: string; home_2022: number; website: string | null; lat: number; lon: number; in_test: boolean })[];
  if (!u) return null;
  const board = (await db`select state, freshmen, expected, pull, grp, gap from state_board where unitid = ${unitid} order by pull desc`) as { state: string; freshmen: number; expected: number; pull: number; grp: Group; gap: number }[];
  const home = stateAbbr(u.state);
  const metros = (await db`select m.cbsa, m.name, m.city, m.states, m.pop2025, p.pull, p.distance_km from metro_pull p join metros m on m.cbsa = p.cbsa
    where p.unitid = ${unitid} and not (${home} = any(m.states)) order by p.pull desc, m.pop2025 desc limit 12`) as { cbsa: string; name: string; city: string; states: string[]; pop2025: number; pull: number; distance_km: number }[];
  return {
    university: { ...summary(u), qlooEntityId: u.qloo_entity_id, qlooName: u.qloo_name, home2022: u.home_2022, website: u.website, lat: u.lat, lon: u.lon, inTest: u.in_test },
    board: board.map((b) => ({ state: b.state, abbr: stateAbbr(b.state), freshmen: b.freshmen, expected: b.expected, pull: b.pull, group: b.grp, gap: b.gap })),
    metros: metros.map((m) => ({ cbsa: m.cbsa, name: m.name, city: m.city, states: m.states, pop2025: m.pop2025, pull: m.pull, distanceKm: m.distance_km })),
  };
}
