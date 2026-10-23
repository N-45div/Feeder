// Feeder's tools, shared by the in-page agent (/api/agent) and the remote MCP endpoint (/api/mcp). State boards and metro pull
// come from Postgres; a metro brief is fetched from Qloo once and kept.

import { z } from "zod";
import feeder from "../../../data/eval/feeder.json";
import { getBrief } from "../brief/brief";
import { getMetroEvents } from "../brief/events";
import { mapsRoute, visitDay } from "../brief/route";
import { sql } from "../db";
import { getDesk, listUniversities, stateAbbr, TRIP_MIN_POP } from "../data/desk";
import { planTrips, REGIONS, type TripMetro } from "./trips";

/** A problem the caller can fix (an unknown university id, say), reported back as a plain sentence. */
export class FeederToolError extends Error {}

const unitid = z.number().int().positive().describe("A university id from find_universities, such as 209551 (University of Oregon).");

async function deskOrThrow(id: number) {
  const desk = await getDesk(id);
  if (!desk) throw new FeederToolError(`There is no university with id ${id}. Look it up with find_universities first.`);
  return desk;
}

// ---- find_universities
export const findInput = z.object({ query: z.string().min(1).max(80).describe("Part of a university's name, city or state, such as 'Oregon', 'Boston' or 'Clemson'.") });
export async function findUniversities({ query }: z.infer<typeof findInput>) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const all = await listUniversities();
  const hits = all.filter((u) => words.every((w) => `${u.name} ${u.city} ${u.state}`.toLowerCase().includes(w)));
  return {
    universities: hits.slice(0, 10).map((u) => ({ id: u.unitid, name: u.name, city: `${u.city}, ${u.state}`, control: u.control, outOfStateShareFall2022: u.outShare2022 })),
    more: Math.max(0, hits.length - 10),
    note: hits.length ? undefined : `No match among the ${all.length} universities Feeder covers (four-year, 1,000+ freshmen, 20%+ from out of state, known to Qloo).`,
  };
}

// ---- state_board
export const boardInput = z.object({
  unitid,
  group: z.enum(["untapped", "stronghold", "earned", "quiet"]).optional().describe("Keep one group: untapped (pull high, freshmen below what geography predicts), stronghold, earned (freshmen without pull) or quiet."),
  limit: z.number().int().min(1).max(51).optional().describe("How many states to return (default 10)."),
});
export async function stateBoard({ unitid: id, group, limit = 10 }: z.infer<typeof boardInput>) {
  const desk = await deskOrThrow(id);
  const rows = desk.board.filter((r) => !group || r.group === group);
  const ordered = group === "untapped" ? [...rows].sort((a, b) => a.gap - b.gap) : rows;
  return {
    university: { id, name: desk.university.qlooName, home: desk.university.state, inStateFreshmenFall2022: desk.university.home2022 },
    states: ordered.slice(0, limit).map((r) => ({ state: r.state, group: r.group, freshmenFall2022: r.freshmen, geographyPredicts: r.expected, qlooPull: r.pull })),
    counts: Object.fromEntries((["untapped", "stronghold", "earned", "quiet"] as const).map((g) => [g, desk.board.filter((r) => r.group === g).length])),
    notes: [
      "Pull is the popularity-weighted mean affinity of Qloo heatmap cells in the state for people who lean toward this university.",
      "Geography predicts = freshmen expected from the state's population and its distance from campus alone, fitted for this university.",
      "Groups: pull at or above the median state vs below, and freshmen above vs below what geography predicts.",
    ],
  };
}

// ---- recruiter_metros
export const metrosInput = z.object({ unitid, limit: z.number().int().min(1).max(12).optional().describe("How many metros (default 8).") });
export async function recruiterMetros({ unitid: id, limit = 8 }: z.infer<typeof metrosInput>) {
  const desk = await deskOrThrow(id);
  return {
    university: { id, name: desk.university.qlooName },
    metros: desk.metros.slice(0, limit).map((m) => ({ cbsa: m.cbsa, metro: m.name.replace(/^Urban /, ""), qlooPull: m.pull, population2025: m.pop2025, distanceKm: m.distanceKm })),
    notes: [`Metros of ${TRIP_MIN_POP.toLocaleString("en-US")}+ people outside the home state, by Qloo pull within 60 km. Untested against enrollment: federal data has no metro detail.`],
  };
}

// ---- metro_brief
export const briefInput = z.object({
  unitid,
  metro: z.string().min(2).max(80).describe("A metro's cbsa code from recruiter_metros, or its city name, such as 'Seattle'."),
});
export async function metroBrief({ unitid: id, metro }: z.infer<typeof briefInput>) {
  const desk = await deskOrThrow(id);
  let cbsa = /^\d{5}$/.test(metro) ? metro : null;
  if (!cbsa) {
    const [row] = (await sql()`select cbsa from metros where lower(city) = ${metro.toLowerCase()} or lower(name) like ${`%${metro.toLowerCase()}%`} order by pop2025 desc limit 1`) as { cbsa: string }[];
    cbsa = row?.cbsa ?? null;
  }
  if (!cbsa) throw new FeederToolError(`No metro of 250,000+ people matches "${metro}".`);
  const [brief, events] = await Promise.all([getBrief(id, cbsa), getMetroEvents(cbsa).catch(() => null)]);
  if (!brief) throw new FeederToolError("That metro isn't in Feeder's list.");
  const stops = visitDay(brief.highSchools);
  return {
    university: desk.university.qlooName,
    cbsa,
    highSchoolsToVisit: brief.highSchools,
    rivalCollegesNearby: brief.colleges.map((c) => c.name),
    whatResonates: brief.hooks,
    visitDay: stops.length
      ? { stops: stops.map((s) => ({ name: s.name, address: s.address, qlooRank: s.rank, kmFromPrevious: s.legKm })), googleMapsRoute: mapsRoute(stops) }
      : null,
    collegeFairsNearby: events?.status === "ok" ? events.events.map(({ title, when, venue }) => ({ title, when, venue })) : null,
    notes: [
      "Ranked by Qloo for people who lean toward this university, within 40 km of the metro. Untested against enrollment: no public data goes below the state.",
      "The visit day starts at the top-ranked school and goes to the nearest next; km are straight-line, and the Google Maps link gives drive times.",
      "College fairs come from Google Events through SerpApi, kept to recruiting events; null means none were searched for this metro.",
    ],
  };
}

// ---- plan_trips
export const tripsInput = z.object({
  unitid,
  recruiters: z.number().int().min(1).max(6).describe("How many recruiters travel."),
  weeks: z.number().int().min(1).max(10).describe("How many weeks of travel each."),
  region: z.enum(["west", "midwest", "south", "northeast"]).optional().describe("Keep trips to one Census region."),
});
export async function tripPlan({ unitid: id, recruiters, weeks, region }: z.infer<typeof tripsInput>) {
  const desk = await deskOrThrow(id);
  const home = stateAbbr(desk.university.state);
  const rows = (await sql()`select m.cbsa, m.city, m.states, m.pop2025, m.lat, m.lon, p.pull from metro_pull p join metros m on m.cbsa = p.cbsa
    where p.unitid = ${id} and not (${home} = any(m.states)) and m.pop2025 >= ${TRIP_MIN_POP} order by p.pull desc limit 60`) as TripMetro[];
  // Census names Honolulu's metro "Urban Honolulu"; the desk shows it as Honolulu.
  for (const m of rows) m.city = m.city.replace(/^Urban /, "");
  const trips = planTrips(rows, { recruiters, weeks, region: region ?? null });
  return {
    university: desk.university.qlooName,
    trips,
    notes: [
      "Two metros a week, the strongest-pull metros first, split west to east so each recruiter covers one territory.",
      region ? `Kept to the ${region}: ${REGIONS[region].join(", ")}.` : "All regions.",
      "Open a metro brief for the high schools to visit in each stop.",
    ],
  };
}

// ---- get_evidence
export const evidenceInput = z.object({});
export async function getEvidence() {
  const r = feeder.fall2022;
  const p = r.partial_spearman_vs_gravity_residual;
  return {
    test: `Pre-registered (docs/eval-plan.md). IPEDS freshman residence by state, Fall 2022, replicated on Fall 2020, ${r.universities} universities.`,
    beyondGeography: { qloo: p.qloo, assistantAlone: p.assistant, placebo: p.placebo, readAs: "Partial Spearman of each score with what population and distance leave unexplained." },
    predictingTheRanking: { gravity: r.out_of_sample_spearman.gravity.mean, gravityPlusQloo: r.out_of_sample_spearman["gravity+qloo"].mean, gravityPlusAssistant: r.out_of_sample_spearman["gravity+assistant"].mean, all: r.out_of_sample_spearman["gravity+qloo+assistant"].mean },
    readAs: "Qloo's pull is a real signal beyond geography and matches what an assistant knows there; for ranking every state the assistant is better, and Qloo adds nothing on top of it. Metros, high schools and what resonates are Qloo-only and untested.",
    limits: [
      "Qloo's data is from 2026 and the enrollment data from 2020 and 2022: alignment, not a forecast.",
      "Where students come from also reflects past recruiting, alumni, athletics and price.",
      "Nothing below the state is tested: IPEDS has no metro or high-school detail.",
    ],
  };
}
