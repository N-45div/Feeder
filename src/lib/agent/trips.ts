// Plans recruiter travel: the strongest-pull metros, split west to east across recruiters, then into weeks of nearby stops.
// Deterministic and explainable: no model decides where anyone goes.

import { distanceKm } from "../geo/geo";

export const REGIONS: Record<string, string[]> = {
  west: ["WA", "OR", "CA", "NV", "ID", "MT", "WY", "UT", "CO", "AZ", "NM", "AK", "HI"],
  midwest: ["ND", "SD", "NE", "KS", "MN", "IA", "MO", "WI", "IL", "IN", "MI", "OH"],
  south: ["TX", "OK", "AR", "LA", "MS", "AL", "TN", "KY", "WV", "VA", "NC", "SC", "GA", "FL", "MD", "DE", "DC"],
  northeast: ["PA", "NY", "NJ", "CT", "RI", "MA", "VT", "NH", "ME"],
};

/** Stops further apart than this don't share a week. */
export const MAX_HOP_KM = 1200;

export interface TripMetro {
  cbsa: string;
  city: string;
  states: string[];
  pop2025: number;
  pull: number;
  lat: number;
  lon: number;
}

export interface Trip {
  recruiter: number;
  week: number;
  stops: { cbsa: string; city: string; states: string[]; pull: number }[];
}

/** Orders stops so each is the nearest remaining one to the last. */
function route(stops: TripMetro[]): TripMetro[] {
  if (stops.length < 3) return stops;
  const left = [...stops].sort((a, b) => a.lon - b.lon);
  const out = [left.shift()!];
  while (left.length) {
    const last = out[out.length - 1];
    left.sort((a, b) => distanceKm(last.lat, last.lon, a.lat, a.lon) - distanceKm(last.lat, last.lon, b.lat, b.lon));
    out.push(left.shift()!);
  }
  return out;
}

/** Cuts a route into weeks of nearby stops: a stop more than MAX_HOP_KM from the last one starts a new week (Honolulu flies alone). */
function intoWeeks(stops: TripMetro[], perWeek: number): TripMetro[][] {
  const weeks: TripMetro[][] = [];
  for (const stop of stops) {
    const week = weeks[weeks.length - 1];
    const last = week?.[week.length - 1];
    if (!week || week.length >= perWeek || distanceKm(last.lat, last.lon, stop.lat, stop.lon) > MAX_HOP_KM) weeks.push([stop]);
    else week.push(stop);
  }
  return weeks;
}

export function planTrips(metros: TripMetro[], opts: { recruiters: number; weeks: number; stopsPerWeek?: number; region?: string | null }): Trip[] {
  const perWeek = opts.stopsPerWeek ?? 2;
  const allowed = opts.region ? new Set(REGIONS[opts.region] ?? []) : null;
  const pool = metros
    .filter((m) => !allowed || m.states.some((s) => allowed.has(s)))
    .sort((a, b) => b.pull - a.pull)
    .slice(0, opts.recruiters * opts.weeks * perWeek);
  // Split west to east so each recruiter covers one contiguous territory.
  const byLon = [...pool].sort((a, b) => a.lon - b.lon);
  const size = Math.ceil(byLon.length / opts.recruiters);
  const trips: Trip[] = [];
  for (let r = 0; r < opts.recruiters; r++) {
    let stops = route(byLon.slice(r * size, (r + 1) * size));
    let weeks = intoWeeks(stops, perWeek);
    // More weeks than asked for (a far stop took a week alone): drop the weakest stop and regroup, so a strong metro left
    // alone at the end of the route isn't lost to a pair of weaker ones.
    while (weeks.length > opts.weeks) {
      const weakest = stops.reduce((w, x) => (x.pull < w.pull ? x : w));
      stops = route(stops.filter((x) => x !== weakest));
      weeks = intoWeeks(stops, perWeek);
    }
    weeks.forEach((week, w) => trips.push({ recruiter: r + 1, week: w + 1, stops: week.map((s) => ({ cbsa: s.cbsa, city: s.city, states: s.states, pull: s.pull })) }));
  }
  return trips;
}
