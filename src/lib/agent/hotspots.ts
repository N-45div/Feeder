// audience_hotspots: the agent asks Qloo, live, where people aged 24 and younger who lean toward a university live, optionally
// narrowed to those who also like something the agent names (a brand, show, film, artist or game). Qloo answers with a national
// heatmap; Feeder turns it into metro pull the same way as the road trip. Answers are kept, so a repeat question is free.

import { z } from "zod";
import { sql } from "../db";
import { stateAbbr, TRIP_MIN_POP } from "../data/desk";
import { LIMITS, take } from "../limits";
import { qloo } from "../qloo/live";
import { metroPull, type Metro } from "../score/metros";
import type { Cell } from "../score/pull";
import { FeederToolError } from "./tools";

/** Entity types Qloo can place on a heatmap (albums, for one, can't be). */
const MAPPABLE: Record<string, string> = { "urn:entity:brand": "brand", "urn:entity:tv_show": "TV show", "urn:entity:movie": "film", "urn:entity:artist": "artist", "urn:entity:videogame": "game" };
const YOUNG = "24_and_younger";
const SHOW = 8;

export const hotspotsInput = z.object({
  unitid: z.number().int().positive().describe("A university id from find_universities."),
  interest: z
    .string()
    .min(2)
    .max(60)
    .optional()
    .describe("Optional: one brand, show, film, artist or game the students you want would like, such as 'Patagonia' for an outdoor programme or 'Minecraft' for computer science. Leave it out for everyone young who leans toward the university."),
});

type Interest = { id: string; name: string; kind: string };
type Heatmap = { results?: { heatmap?: { location: { geohash: string }; query: { affinity: number; popularity: number } }[] } };

async function resolveInterest(query: string): Promise<Interest | null> {
  const r = await qloo().get<{ results?: { entity_id: string; name: string; types?: string[] }[] }>("/search", { query, take: 8 });
  for (const e of r.results ?? []) {
    const type = e.types?.find((t) => t in MAPPABLE);
    if (type) return { id: e.entity_id, name: e.name, kind: MAPPABLE[type] };
  }
  return null;
}

export async function audienceHotspots({ unitid, interest }: z.infer<typeof hotspotsInput>) {
  const [u] = (await sql()`select qloo_entity_id, qloo_name, state, lat, lon from universities where unitid = ${unitid}`) as { qloo_entity_id: string; qloo_name: string; state: string; lat: number; lon: number }[];
  if (!u) throw new FeederToolError(`There is no university with id ${unitid}. Look it up with find_universities first.`);
  const match = interest ? await resolveInterest(interest) : null;
  if (interest && !match) throw new FeederToolError(`Qloo has nothing it can map for "${interest}". Name one brand, show, film, artist or game instead.`);

  const key = `${unitid}|${match?.id ?? "-"}|${YOUNG}`;
  const [kept] = (await sql()`select pulls, fetched_at from audience_queries where key = ${key}`) as { pulls: { cbsa: string; pull: number }[]; fetched_at: Date }[];
  let pulls = kept?.pulls;
  if (!pulls) {
    if (!(await take("qloo:live", LIMITS.liveQlooPerDay))) throw new FeederToolError("Today's budget for live Qloo questions is used up. Questions already asked still answer; try a new one tomorrow.");
    const r = await qloo().get<Heatmap>("/v2/insights", {
      "filter.type": "urn:heatmap",
      "signal.interests.entities": [u.qloo_entity_id, match?.id].filter(Boolean).join(","),
      "signal.demographics.age": YOUNG,
      "filter.location.query": "United States",
    });
    const cells: Cell[] = (r.results?.heatmap ?? []).map((c) => [c.location.geohash, c.query.affinity, c.query.popularity]);
    const metros = (await sql()`select cbsa, name, city, states, pop2025, lat, lon from metros where pop2025 >= ${TRIP_MIN_POP}`) as Metro[];
    pulls = metroPull(cells, metros, u).map((p) => ({ cbsa: p.metro.cbsa, pull: Math.round(p.pull * 1000) / 1000 }));
    await sql()`insert into audience_queries (key, interest, pulls) values (${key}, ${JSON.stringify(match)}, ${JSON.stringify(pulls)}) on conflict (key) do nothing`;
  }

  // The university's own young-audience list (no interest), to show where the interest finds students that list misses.
  const named = (await sql()`select m.cbsa, m.city, m.states, p.pull as own from metros m left join metro_pull p on p.cbsa = m.cbsa and p.unitid = ${unitid}
    where m.cbsa = any(${pulls.map((p) => p.cbsa)})`) as { cbsa: string; city: string; states: string[]; own: number | null }[];
  const byCbsa = new Map(named.map((m) => [m.cbsa, m]));
  const home = stateAbbr(u.state);
  const outside = pulls.filter((p) => byCbsa.has(p.cbsa) && !byCbsa.get(p.cbsa)!.states.includes(home));
  const ownOrder = [...outside].sort((a, b) => (byCbsa.get(b.cbsa)!.own ?? 0) - (byCbsa.get(a.cbsa)!.own ?? 0)).map((p) => p.cbsa);
  return {
    university: u.qloo_name,
    asked: match
      ? `Where do people aged 24 and younger who lean toward ${u.qloo_name} and like ${match.name} (a ${match.kind}) live?`
      : `Where do people aged 24 and younger who lean toward ${u.qloo_name} live?`,
    interest: match,
    answeredBy: kept ? `A Qloo heatmap asked on ${kept.fetched_at.toISOString().slice(0, 10)} and kept` : "A Qloo heatmap, asked live just now",
    metros: outside.slice(0, SHOW).map((p) => {
      const m = byCbsa.get(p.cbsa)!;
      return { metro: `${m.city.replace(/^Urban /, "")}, ${m.states.join("-")}`, cbsa: p.cbsa, pull: p.pull, rankForUniversityAlone: ownOrder.indexOf(p.cbsa) + 1 };
    }),
    notes: [
      "Metros of 500,000+ people outside the home state, by Qloo pull within 60 km for this audience.",
      match
        ? "rankForUniversityAlone is the metro's place on the university's own list without the interest: a big jump shows where the interest finds students that list misses."
        : "This is the same audience as the road trip.",
      "Untested against enrollment: federal data has no metro detail.",
    ],
  };
}
