// A metro brief for one university: the high schools and other colleges Qloo ranks highest near the metro for people who lean
// toward the university, and the music and TV that the young part of that audience (24 and younger, the age of applicants) likes
// there. Places stay all-ages: Qloo returns no schools for place queries with an age signal. (Podcasts were dropped: the lists
// surfaced shows a university's marketing team shouldn't be pointed at.) Fetched from Qloo on first view, then kept.
// None of this is checked against enrollment (no public data goes below the state), and the page says so.

import { sql } from "../db";
import { qloo } from "../qloo/live";
import { isOwnPlace, placeKind } from "./classify";

export interface BriefPlace {
  name: string;
  address: string | null;
  /** From Qloo's place data; drives the visit-day map. Null when Qloo has no location. */
  lat: number | null;
  lon: number | null;
}

export interface Brief {
  highSchools: BriefPlace[];
  colleges: BriefPlace[];
  /** audience is set once the lists come from the 24-and-younger audience; older cached briefs lack it and are refreshed. */
  hooks: { music: string[]; tv: string[]; audience?: typeof YOUNG };
  fetchedAt: string;
}

const RADIUS_M = 40_000;
const YOUNG = "24_and_younger";
const PAGES = 4;
const KEEP = 8;

type Entity = { name: string; location?: { lat?: number; lon?: number }; properties?: { address?: string } };
type Insights = { results?: { entities?: Entity[] } };

export async function fetchBrief(entityId: string, university: string, at: { lat: number; lon: number }): Promise<Omit<Brief, "fetchedAt">> {
  const point = `POINT(${at.lon} ${at.lat})`;
  const near = { "signal.interests.entities": entityId, "signal.location": point, "signal.location.radius": RADIUS_M };
  const highSchools: BriefPlace[] = [];
  const colleges: BriefPlace[] = [];
  for (let page = 1; page <= PAGES && (highSchools.length < KEEP || colleges.length < KEEP); page++) {
    const r = await qloo().get<Insights>("/v2/insights", { "filter.type": "urn:entity:place", ...near, "filter.location": point, "filter.location.radius": RADIUS_M, take: 50, page });
    const list = r.results?.entities ?? [];
    for (const e of list) {
      if (isOwnPlace(e.name, university)) continue;
      const place = { name: e.name, address: e.properties?.address ?? null, lat: e.location?.lat ?? null, lon: e.location?.lon ?? null };
      const kind = placeKind(e.name);
      if (kind === "high_school" && highSchools.length < KEEP && !highSchools.some((p) => p.name === e.name)) highSchools.push(place);
      if (kind === "college" && colleges.length < KEEP && !colleges.some((p) => p.name === e.name)) colleges.push(place);
    }
    if (list.length < 50) break;
  }
  return { highSchools, colleges, hooks: await fetchHooks(entityId, at) };
}

/** The music and TV that people 24 and younger who lean toward the university favour near the metro. */
async function fetchHooks(entityId: string, at: { lat: number; lon: number }): Promise<Brief["hooks"]> {
  const young = { "signal.interests.entities": entityId, "signal.location": `POINT(${at.lon} ${at.lat})`, "signal.location.radius": RADIUS_M, "signal.demographics.age": YOUNG };
  const names = async (type: string) => ((await qloo().get<Insights>("/v2/insights", { "filter.type": type, ...young, take: 8 })).results?.entities ?? []).map((e) => e.name);
  const [music, tv] = await Promise.all([names("urn:entity:artist"), names("urn:entity:tv_show")]);
  return { music, tv, audience: YOUNG };
}

type BriefRow = { fetched_at: Date; high_schools: BriefPlace[]; colleges: BriefPlace[]; hooks: Brief["hooks"] };

/** The cached brief, or a fresh one from Qloo saved for next time. Null when the university or metro is unknown. */
export async function getBrief(unitid: number, cbsa: string): Promise<Brief | null> {
  const db = sql();
  const [cached] = (await db`select fetched_at, high_schools, colleges, hooks from metro_briefs where unitid = ${unitid} and cbsa = ${cbsa}`) as BriefRow[];
  // Briefs saved before places carried coordinates are fetched again once.
  const current = cached && (cached.high_schools.length === 0 || "lat" in cached.high_schools[0]);
  if (cached && current && cached.hooks.audience === YOUNG) return { highSchools: cached.high_schools, colleges: cached.colleges, hooks: cached.hooks, fetchedAt: cached.fetched_at.toISOString() };
  const [u] = (await db`select qloo_entity_id, name from universities where unitid = ${unitid}`) as { qloo_entity_id: string; name: string }[];
  const [m] = (await db`select lat, lon from metros where cbsa = ${cbsa}`) as { lat: number; lon: number }[];
  if (!u || !m) return null;
  // Places are current; only the music and TV predate the young-audience lists.
  if (cached && current) {
    const hooks = await fetchHooks(u.qloo_entity_id, m);
    await db`update metro_briefs set hooks = ${JSON.stringify(hooks)} where unitid = ${unitid} and cbsa = ${cbsa}`;
    return { highSchools: cached.high_schools, colleges: cached.colleges, hooks, fetchedAt: cached.fetched_at.toISOString() };
  }
  const brief = await fetchBrief(u.qloo_entity_id, u.name, m);
  await db`insert into metro_briefs (unitid, cbsa, high_schools, colleges, hooks) values (${unitid}, ${cbsa}, ${JSON.stringify(brief.highSchools)}, ${JSON.stringify(brief.colleges)}, ${JSON.stringify(brief.hooks)})
    on conflict (unitid, cbsa) do update set high_schools = excluded.high_schools, colleges = excluded.colleges, hooks = excluded.hooks, fetched_at = now()`;
  return { ...brief, fetchedAt: new Date().toISOString() };
}
