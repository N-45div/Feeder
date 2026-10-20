// Geography helpers: geohash cells from Qloo heatmaps to US states, and distances.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Centre of a geohash cell as [longitude, latitude]. */
export function geohashCentre(hash: string): [number, number] {
  const lat = [-90, 90];
  const lon = [-180, 180];
  let even = true;
  for (const ch of hash) {
    const bits = BASE32.indexOf(ch);
    if (bits < 0) throw new Error(`not a geohash: ${hash}`);
    for (const mask of [16, 8, 4, 2, 1]) {
      const range = even ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if (bits & mask) range[0] = mid;
      else range[1] = mid;
      even = !even;
    }
  }
  return [(lon[0] + lon[1]) / 2, (lat[0] + lat[1]) / 2];
}

type Ring = [number, number][];
export interface StateShape {
  name: string;
  abbr: string;
  polygons: Ring[][];
  bbox: [number, number, number, number];
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function shapesFrom(geojson: { features: { properties: { name: string; abbr: string }; geometry: { type: string; coordinates: unknown } }[] }): StateShape[] {
  return geojson.features.map((f) => {
    const polygons = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Ring[][];
    const points = polygons.flatMap((p) => p[0]);
    const bbox: [number, number, number, number] = [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ];
    return { name: f.properties.name, abbr: f.properties.abbr, polygons, bbox };
  });
}

/** The state containing a point, or null (ocean, Canada, Mexico). Holes are ignored: no US state has an enclave of another. */
export function stateAt(shapes: StateShape[], lon: number, lat: number): StateShape | null {
  for (const s of shapes) {
    const [x0, y0, x1, y1] = s.bbox;
    if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
    if (s.polygons.some((poly) => inRing(lon, lat, poly[0]))) return s;
  }
  return null;
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * p) / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}
