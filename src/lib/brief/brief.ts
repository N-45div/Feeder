// A metro brief for one university: the high schools and other colleges Qloo ranks highest near the metro for people who lean
// toward the university, and the music and TV that audience likes there. (Podcasts were dropped: the lists surfaced shows a
// university's marketing team shouldn't be pointed at.) Fetched from Qloo on first view, then kept.
// None of this is checked against enrollment (no public data goes below the state), and the page says so.

import { sql } from "../db";
import { QlooClient } from "../qloo/client";
import { isOwnPlace, placeKind } from "./classify";

export interface BriefPlace {
  name: string;
  address: string | null;
}

export interface Brief {
  highSchools: BriefPlace[];
  colleges: BriefPlace[];
  hooks: { music: string[]; tv: string[] };
  fetchedAt: string;
}

const RADIUS_M = 40_000;
const PAGES = 4;
const KEEP = 8;

let client: QlooClient | null = null;
function qloo(): QlooClient {
  if (!client) {
    const apiKey = process.env.QLOO_API_KEY;
    if (!apiKey) throw new Error("QLOO_API_KEY is not set");
    client = new QlooClient({ apiKey, baseUrl: process.env.QLOO_BASE_URL, maxAttempts: 4 });
  }
  return client;
}

type Entity = { name: string; properties?: { address?: string } };
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
      const place = { name: e.name, address: e.properties?.address ?? null };
      const kind = placeKind(e.name);
      if (kind === "high_school" && highSchools.length < KEEP && !highSchools.some((p) => p.name === e.name)) highSchools.push(place);
      if (kind === "college" && colleges.length < KEEP && !colleges.some((p) => p.name === e.name)) colleges.push(place);
    }
    if (list.length < 50) break;
  }
  const names = async (type: string) => ((await qloo().get<Insights>("/v2/insights", { "filter.type": type, ...near, take: 8 })).results?.entities ?? []).map((e) => e.name);
  const [music, tv] = await Promise.all([names("urn:entity:artist"), names("urn:entity:tv_show")]);
  return { highSchools, colleges, hooks: { music, tv } };
}

type BriefRow = { fetched_at: Date; high_schools: BriefPlace[]; colleges: BriefPlace[]; hooks: Brief["hooks"] };

/** The cached brief, or a fresh one from Qloo saved for next time. Null when the university or metro is unknown. */
export async function getBrief(unitid: number, cbsa: string): Promise<Brief | null> {
  const db = sql();
  const [cached] = (await db`select fetched_at, high_schools, colleges, hooks from metro_briefs where unitid = ${unitid} and cbsa = ${cbsa}`) as BriefRow[];
  if (cached) return { highSchools: cached.high_schools, colleges: cached.colleges, hooks: cached.hooks, fetchedAt: cached.fetched_at.toISOString() };
  const [u] = (await db`select qloo_entity_id, name from universities where unitid = ${unitid}`) as { qloo_entity_id: string; name: string }[];
  const [m] = (await db`select lat, lon from metros where cbsa = ${cbsa}`) as { lat: number; lon: number }[];
  if (!u || !m) return null;
  const brief = await fetchBrief(u.qloo_entity_id, u.name, m);
  await db`insert into metro_briefs (unitid, cbsa, high_schools, colleges, hooks) values (${unitid}, ${cbsa}, ${JSON.stringify(brief.highSchools)}, ${JSON.stringify(brief.colleges)}, ${JSON.stringify(brief.hooks)})
    on conflict (unitid, cbsa) do nothing`;
  return { ...brief, fetchedAt: new Date().toISOString() };
}
