// A visit day: the top high schools from a brief in a driving order (nearest next, starting from the highest-ranked school),
// straight-line legs, and a Google Maps link that opens the whole route with real drive times. When federal data has one, the
// day also includes an access stop: a large public school near the route where many students are from low-income families. Out-of-state recruiting visits tend to skip
// schools like it, and Qloo's rankings follow the audience, so the day makes room for one on purpose.

import { distanceKm } from "../geo/geo";
import type { BriefPlace } from "./brief";

export const VISIT_STOPS = 5;

export interface Stop extends BriefPlace {
  lat: number;
  lon: number;
  /** Position in the brief's Qloo ranking (1 = highest); null for the access stop. */
  rank: number | null;
  /** Set on the access stop, which comes from federal data rather than Qloo. */
  access?: { enrollment: number | null; basis: AccessSchool["basis"] };
  /** Straight-line km from the previous stop; 0 for the first. */
  legKm: number;
}

/** A public high school from the federal Common Core of Data. */
export interface AccessSchool {
  name: string;
  city: string | null;
  lat: number;
  lon: number;
  enrollment: number | null;
  /** title_i: a Title I schoolwide school. lunch: 40%+ free or reduced-price lunch, where the state reports no Title I status. */
  basis: "title_i" | "lunch";
}

/** Large schools first: a big school reaches more students in one visit. */
const SAME_PLACE_KM = 0.3;
const ACCESS_MIN_ENROLLMENT = [800, 400, 0];

/** The access stop for a day: among large low-income schools, the one closest to any of the day's stops and not already on it, by
 *  name or by place (Qloo's "Culver High School" is the federal directory's "Culver City High"). */
export function pickAccess(candidates: AccessSchool[], near: { lat: number; lon: number; name: string }[]): AccessSchool | null {
  if (!near.length) return null;
  const onDay = new Set(near.map((s) => s.name.toLowerCase()));
  const gap = (c: AccessSchool) => Math.min(...near.map((s) => distanceKm(s.lat, s.lon, c.lat, c.lon)));
  for (const min of ACCESS_MIN_ENROLLMENT) {
    const pool = candidates.filter((c) => (c.enrollment ?? 0) >= min && !onDay.has(c.name.toLowerCase()) && gap(c) > SAME_PLACE_KM);
    if (pool.length) return pool.reduce((best, c) => (gap(c) < gap(best) ? c : best));
  }
  return null;
}

/** The day's stops in driving order. With an access school, it takes one Qloo stop's place, so the day stays the same length. */
export function visitDay(places: BriefPlace[], stops = VISIT_STOPS, access: AccessSchool | null = null): Stop[] {
  const located: Omit<Stop, "legKm">[] = places
    .map((p, i) => ({ ...p, rank: i + 1 }))
    .filter((p): p is BriefPlace & { lat: number; lon: number; rank: number } => p.lat != null && p.lon != null)
    .slice(0, access ? stops - 1 : stops);
  if (!located.length) return [];
  if (access) located.push({ name: access.name, address: access.city, lat: access.lat, lon: access.lon, rank: null, access: { enrollment: access.enrollment, basis: access.basis } });
  const left = located.slice(1);
  const order = [located[0]];
  while (left.length) {
    const last = order[order.length - 1];
    left.sort((a, b) => distanceKm(last.lat, last.lon, a.lat, a.lon) - distanceKm(last.lat, last.lon, b.lat, b.lon));
    order.push(left.shift()!);
  }
  return order.map((p, i) => ({ ...p, legKm: i === 0 ? 0 : Math.round(distanceKm(order[i - 1].lat, order[i - 1].lon, p.lat, p.lon) * 10) / 10 }));
}

const where = (s: Stop) => (s.address ? `${s.name}, ${s.address}` : `${s.lat},${s.lon}`);

/** Google Maps directions for the whole day (free: opens maps.google.com, no API call from Feeder). */
export function mapsRoute(stops: Stop[]): string | null {
  if (stops.length < 2) return null;
  const params = new URLSearchParams({ api: "1", origin: where(stops[0]), destination: where(stops[stops.length - 1]), travelmode: "driving" });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).map(where).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}
