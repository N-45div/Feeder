// A visit day: the top high schools from a brief in a driving order (nearest next, starting from the highest-ranked school),
// straight-line legs, and a Google Maps link that opens the whole route with real drive times.

import { distanceKm } from "../geo/geo";
import type { BriefPlace } from "./brief";

export const VISIT_STOPS = 5;

export interface Stop extends BriefPlace {
  lat: number;
  lon: number;
  /** Position in the brief's Qloo ranking (1 = highest). */
  rank: number;
  /** Straight-line km from the previous stop; 0 for the first. */
  legKm: number;
}

export function visitDay(places: BriefPlace[], stops = VISIT_STOPS): Stop[] {
  const located = places
    .map((p, i) => ({ ...p, rank: i + 1 }))
    .filter((p): p is BriefPlace & { lat: number; lon: number; rank: number } => p.lat != null && p.lon != null)
    .slice(0, stops);
  if (!located.length) return [];
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
