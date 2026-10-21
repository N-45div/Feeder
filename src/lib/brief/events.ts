// Upcoming college fairs and admissions events near a metro, from Google Events through SerpApi. One search per metro, kept and
// shared by every university, under a monthly cap (the plan has few searches). Kept to recruiting events by a keyword filter.

import { sql } from "../db";
import { take } from "../limits";

export interface MetroEvent {
  title: string;
  when: string;
  venue: string | null;
  address: string | null;
  link: string | null;
}

export interface MetroEvents {
  events: MetroEvent[];
  fetchedAt: string | null;
  /** "ok", or why there is nothing: no SerpApi key here, or this month's searches are used up. */
  status: "ok" | "off" | "budget";
}

const RELEVANT = /\b(college (fair|expo|night|day|tour|and career|& career)|admissions?|university fair|nacac|discovery day|open house|preview day|transfer fair|hbcu|black college|campus visit|financial aid night|fafsa)\b/i;
const NOISE = /\b(study abroad|camp fair|job fair|summit|gala|conference|alumni)\b/i;

export function relevant(title: string): boolean {
  return RELEVANT.test(title) && !NOISE.test(title);
}

type SerpEvent = { title?: string; date?: { when?: string; start_date?: string }; address?: string[]; venue?: { name?: string }; link?: string };

async function search(city: string, key: string): Promise<MetroEvent[]> {
  const params = new URLSearchParams({ engine: "google_events", q: `college fair ${city}`, hl: "en", gl: "us", api_key: key });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const body = (await res.json()) as { events_results?: SerpEvent[]; error?: string };
  if (body.error && !/hasn't returned any results/i.test(body.error)) throw new Error(body.error);
  return (body.events_results ?? [])
    .filter((e) => e.title && relevant(e.title))
    .slice(0, 6)
    .map((e) => ({ title: e.title!, when: e.date?.when ?? e.date?.start_date ?? "", venue: e.venue?.name ?? null, address: e.address?.join(", ") ?? null, link: e.link ?? null }));
}

/** The cached events for a metro, or one SerpApi search kept for next time when the month's budget allows. */
export async function getMetroEvents(cbsa: string): Promise<MetroEvents> {
  const db = sql();
  const [cached] = (await db`select events, fetched_at from metro_events where cbsa = ${cbsa}`) as { events: MetroEvent[]; fetched_at: Date }[];
  if (cached) return { events: cached.events, fetchedAt: cached.fetched_at.toISOString(), status: "ok" };
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return { events: [], fetchedAt: null, status: "off" };
  const month = new Date().toISOString().slice(0, 7);
  if (!(await take(`serp:${month}`, Number(process.env.SERPAPI_MONTHLY_CAP ?? 15)))) return { events: [], fetchedAt: null, status: "budget" };
  const [m] = (await db`select city, states from metros where cbsa = ${cbsa}`) as { city: string; states: string[] }[];
  if (!m) return { events: [], fetchedAt: null, status: "ok" };
  const events = await search(`${m.city.replace(/^Urban /, "")} ${m.states[0]}`, key);
  await db`insert into metro_events (cbsa, events) values (${cbsa}, ${JSON.stringify(events)}) on conflict (cbsa) do nothing`;
  return { events, fetchedAt: new Date().toISOString(), status: "ok" };
}
