// The app map's projection (the same as scripts/state-paths.mjs): Albers equal-area for the lower 48, with Alaska and Hawaii
// as insets, into a 960 x 600 box. Lets the audience map place heatmap cells and pins on the state shapes.

const rad = Math.PI / 180;

function albers(lon0: number, lat0: number, lat1: number, lat2: number) {
  const n = (Math.sin(lat1 * rad) + Math.sin(lat2 * rad)) / 2;
  const c = Math.cos(lat1 * rad) ** 2 + 2 * n * Math.sin(lat1 * rad);
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(lat0 * rad)) / n;
  return (lon: number, lat: number): [number, number] => {
    const rho = Math.sqrt(c - 2 * n * Math.sin(lat * rad)) / n;
    const theta = n * (lon - lon0) * rad;
    return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
  };
}

const MAIN = { f: albers(-96, 23, 29.5, 45.5), scale: 1120, dx: 490, dy: 572 };
const AK = { f: albers(-154, 50, 55, 65), scale: 380, dx: 150, dy: 560 };
const HI = { f: albers(-157, 3, 8, 18), scale: 1100, dx: 300, dy: 905 };

/** Map position of a point, or null when it is outside the US areas the map shows. */
export function project(lon: number, lat: number): [number, number] | null {
  let p = MAIN;
  if (lat > 50 && (lon < -129 || lon > 170)) p = AK;
  else if (lat < 23 && lon < -150) p = HI;
  else if (lat < 24 || lat > 50 || lon < -125 || lon > -66) return null;
  const [x, y] = p.f(p === AK && lon > 0 ? lon - 360 : lon, lat);
  return [Math.round((x * p.scale + p.dx) * 10) / 10, Math.round((-y * p.scale + p.dy) * 10) / 10];
}
