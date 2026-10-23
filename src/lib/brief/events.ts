// Upcoming college fairs near a metro, from Google Events through SerpApi. One search per metro, kept and
// shared by every university, under a monthly cap (the plan has few searches), refreshed after three weeks when the budget
// allows. Kept to events where many colleges meet students (fairs, expos, college nights), not one college's own open house, and
// to dates that haven't passed. The filter also runs on stored searches, so a tighter rule applies to them at once.

import { sql } from "../db";
import { take } from "../limits";

export interface MetroEvent {
  title: string;
  when: string;
  /** Google's start date, with no year ("Nov 14"). */
  start: string | null;
  venue: string | null;
  address: string | null;
  link: string | null;
}

export interface MetroEvents {
  events: MetroEvent[];
  fetchedAt: string | null;
  /** "ok", or why there is nothing: no SerpApi key here, this month's searches are used up, or the search failed just now. */
  status: "ok" | "off" | "budget" | "error";
}

// Events where many colleges meet students. A single college's open house or preview day isn't a recruiting stop for another one.
const RELEVANT = /\b(college (fair|expo|night|and career|& career)s?|university fair|nacac|hbcu (college )?fair|black college expo|transfer fair)\b/i;
const NOISE = /\b(study abroad|camp fair|job fair|summit|gala|conference|alumni|fundraiser|benefit|auction|master'?s|graduate)\b/i;

export function relevant(title: string): boolean {
  return RELEVANT.test(title) && !NOISE.test(title);
}

/** False once an event's day is over. Google's dates carry no year: one more than two months back is next year's. */
export function upcoming(start: string | null | undefined, now = new Date()): boolean {
  if (!start) return true;
  const day = new Date(`${start} ${now.getUTCFullYear()} 12:00 UTC`);
  if (Number.isNaN(day.getTime())) return true;
  if (now.getTime() - day.getTime() > 60 * DAY) day.setUTCFullYear(day.getUTCFullYear() + 1);
  return day.getTime() >= now.getTime() - DAY;
}

const DAY = 864e5;
const STALE_AFTER = 21 * DAY;

type SerpEvent = { title?: string; date?: { when?: string; start_date?: string }; address?: string[]; venue?: { name?: string }; link?: string };

async function search(city: string, key: string): Promise<MetroEvent[]> {
  const params = new URLSearchParams({ engine: "google_events", q: `college fair ${city}`, hl: "en", gl: "us", api_key: key });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(40_000) });
  if (!res.ok) throw new Error(`SerpApi ${res.status}`);
  const body = (await res.json()) as { events_results?: SerpEvent[]; error?: string };
  if (body.error && !/hasn't returned any results/i.test(body.error)) throw new Error(body.error);
  return (body.events_results ?? [])
    .filter((e) => e.title && relevant(e.title))
    .slice(0, 6)
    .map((e) => ({ title: e.title!, when: e.date?.when ?? e.date?.start_date ?? "", start: e.date?.start_date ?? null, venue: e.venue?.name ?? null, address: e.address?.join(", ") ?? null, link: e.link ?? null }));
}

/** A metro's upcoming events: kept from an earlier search, or one SerpApi search when there is none (or it's three weeks old)
 *  and the month's budget allows. An old search still answers when the budget doesn't. */
export async function getMetroEvents(cbsa: string): Promise<MetroEvents> {
  const db = sql();
  const [cached] = (await db`select events, fetched_at from metro_events where cbsa = ${cbsa}`) as { events: MetroEvent[]; fetched_at: Date }[];
  const kept = (status: MetroEvents["status"]): MetroEvents =>
    cached ? { events: cached.events.filter((e) => relevant(e.title) && upcoming(e.start)), fetchedAt: cached.fetched_at.toISOString(), status: "ok" } : { events: [], fetchedAt: null, status };
  if (cached && Date.now() - cached.fetched_at.getTime() < STALE_AFTER) return kept("ok");

  const key = process.env.SERPAPI_API_KEY;
  if (!key) return kept("off");
  const [m] = (await db`select city from metros where cbsa = ${cbsa}`) as { city: string }[];
  if (!m) return kept("ok");
  const month = new Date().toISOString().slice(0, 7);
  if (!(await take(`serp:${month}`, Number(process.env.SERPAPI_MONTHLY_CAP ?? 15), "month"))) return kept("budget");
  // The city alone: Google Events found nothing for "college fair San Francisco CA" but an expo for "college fair San Francisco".
  const events = await search(m.city.replace(/^Urban /, ""), key);
  await db`insert into metro_events (cbsa, events) values (${cbsa}, ${JSON.stringify(events)})
           on conflict (cbsa) do update set events = excluded.events, fetched_at = now()`;
  return { events: events.filter((e) => upcoming(e.start)), fetchedAt: new Date().toISOString(), status: "ok" };
}
