// Projects data/geo/us-states.geojson into SVG paths for the app's map: Albers equal-area for the lower 48, with Alaska and
// Hawaii as scaled insets in the lower left. Output: data/geo/state-paths.json (a 960 x 600 viewBox).
// Run: node scripts/state-paths.mjs
import { readFileSync, writeFileSync } from "node:fs";

const rad = Math.PI / 180;
function albers({ lon0, lat0, lat1, lat2 }) {
  const n = (Math.sin(lat1 * rad) + Math.sin(lat2 * rad)) / 2;
  const c = Math.cos(lat1 * rad) ** 2 + 2 * n * Math.sin(lat1 * rad);
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(lat0 * rad)) / n;
  return (lon, lat) => {
    const rho = Math.sqrt(c - 2 * n * Math.sin(lat * rad)) / n;
    const theta = n * (lon - lon0) * rad;
    return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
  };
}

const PROJ = {
  main: { f: albers({ lon0: -96, lat0: 23, lat1: 29.5, lat2: 45.5 }), scale: 1120, dx: 490, dy: 572 },
  AK: { f: albers({ lon0: -154, lat0: 50, lat1: 55, lat2: 65 }), scale: 380, dx: 150, dy: 560 },
  HI: { f: albers({ lon0: -157, lat0: 3, lat1: 8, lat2: 18 }), scale: 1100, dx: 300, dy: 905 },
};

const { features } = JSON.parse(readFileSync("data/geo/us-states.geojson", "utf8"));
const paths = [];
for (const f of features) {
  const { abbr, name } = f.properties;
  const p = PROJ[abbr] ?? PROJ.main;
  const project = (lon, lat) => {
    // Alaska's Aleutians cross the antimeridian.
    const [x, y] = p.f(abbr === "AK" && lon > 0 ? lon - 360 : lon, lat);
    return [Math.round((x * p.scale + p.dx) * 10) / 10, Math.round((-y * p.scale + p.dy) * 10) / 10];
  };
  const polygons = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "";
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygons) {
    const ring = poly[0].map(([lon, lat]) => project(lon, lat));
    // Drop specks smaller than a pixel.
    const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
    if (Math.max(...xs) - Math.min(...xs) < 1 && Math.max(...ys) - Math.min(...ys) < 1) continue;
    d += `M${ring.map((q) => q.join(",")).join("L")}Z`;
    minX = Math.min(minX, ...xs); minY = Math.min(minY, ...ys); maxX = Math.max(maxX, ...xs); maxY = Math.max(maxY, ...ys);
  }
  paths.push({ name, abbr, d, label: [Math.round((minX + maxX) / 2), Math.round((minY + maxY) / 2)] });
}
writeFileSync("data/geo/state-paths.json", JSON.stringify({ source: "Natural Earth 1:50m admin-1, projected (public domain)", viewBox: "0 0 960 600", paths }) + "\n");
const all = paths.flatMap((p) => p.d.match(/-?[\d.]+,-?[\d.]+/g).map((s) => s.split(",").map(Number)));
console.log(`${paths.length} states; x ${Math.min(...all.map((q) => q[0]))}..${Math.max(...all.map((q) => q[0]))}, y ${Math.min(...all.map((q) => q[1]))}..${Math.max(...all.map((q) => q[1]))}`);
