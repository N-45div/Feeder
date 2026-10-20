// Metro hotspots for recruiter travel: a university's pull around each metro, from the same national heatmap as the state
// scores. A metro's pull is the popularity-weighted mean affinity of cells whose centres are within RADIUS_KM of it.
// Untested against enrollment (IPEDS has no metro detail); the Evidence page says so.

import { distanceKm, geohashCentre } from "../geo/geo";
import type { Cell } from "./pull";

export const RADIUS_KM = 60;
const MIN_CELLS = 2;

export interface Metro {
  cbsa: string;
  name: string;
  city: string;
  states: string[];
  pop2025: number;
  lat: number;
  lon: number;
}

export interface MetroPull {
  metro: Metro;
  pull: number;
  cells: number;
  distanceKm: number;
}

export function metroPull(cells: Cell[], metros: Metro[], campus: { lat: number; lon: number }): MetroPull[] {
  const centres = cells.map(([hash, affinity, popularity]) => {
    const [lon, lat] = geohashCentre(hash);
    return { lon, lat, affinity, popularity };
  });
  const out: MetroPull[] = [];
  for (const metro of metros) {
    let w = 0, wa = 0, n = 0;
    for (const c of centres) {
      if (Math.abs(c.lat - metro.lat) > 1 || Math.abs(c.lon - metro.lon) > 1.5) continue;
      if (distanceKm(c.lat, c.lon, metro.lat, metro.lon) > RADIUS_KM) continue;
      w += c.popularity;
      wa += c.popularity * c.affinity;
      n++;
    }
    if (n < MIN_CELLS || w <= 0) continue;
    out.push({ metro, pull: wa / w, cells: n, distanceKm: Math.round(distanceKm(campus.lat, campus.lon, metro.lat, metro.lon)) });
  }
  return out.sort((a, b) => b.pull - a.pull);
}
