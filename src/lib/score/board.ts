// A university's state board: for every state outside its home state, the Fall 2022 freshmen it drew, what population and
// distance alone predict (a per-university gravity fit, as in the evaluation), Qloo pull, and a recruiting group:
//   stronghold  pull at or above the median state, and more freshmen than geography predicts
//   untapped    pull at or above the median, fewer freshmen than predicted: people lean your way but don't enroll
//   earned      pull below the median, more freshmen than predicted: programs, price or past recruiting, not taste
//   quiet       pull below the median, fewer freshmen than predicted

import { distanceKm } from "../geo/geo";

export type Group = "stronghold" | "untapped" | "earned" | "quiet";

export interface StateInfo {
  fips: number;
  name: string;
  pop2020: number;
  lat: number;
  lon: number;
}

export interface BoardRow {
  state: string;
  fips: number;
  freshmen: number;
  expected: number;
  pull: number;
  group: Group;
  /** Freshmen short of (negative) or above (positive) what geography predicts. */
  gap: number;
}

function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length;
  const xtx = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const xty = Array.from({ length: k }, (_, i) => X.reduce((s, r, n) => s + r[i] * y[n], 0));
  // Gauss-Jordan on the small normal equations.
  const m = xtx.map((row, i) => [...row, xty[i]]);
  for (let c = 0; c < k; c++) {
    const p = m.slice(c).reduce((best, row, i) => (Math.abs(row[c]) > Math.abs(m[best][c]) ? i + c : best), c);
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < k; r++) {
      if (r === c || m[c][c] === 0) continue;
      const f = m[r][c] / m[c][c];
      for (let j = c; j <= k; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row, i) => (row[i] === 0 ? 0 : row[k] / row[i]));
}

export function stateBoard(
  campus: { lat: number; lon: number; stateFips: number },
  states: StateInfo[],
  freshmen: Record<number, number>,
  pulls: Record<string, { pull: number }>,
): BoardRow[] {
  const rows = states
    .filter((s) => s.fips !== campus.stateFips && pulls[s.name])
    .map((s) => ({ s, n: freshmen[s.fips] ?? 0, pull: pulls[s.name].pull, x: [1, Math.log(s.pop2020), Math.log(Math.max(distanceKm(campus.lat, campus.lon, s.lat, s.lon), 1))] }));
  if (rows.length < 5) return [];
  const beta = ols(rows.map((r) => r.x), rows.map((r) => Math.log1p(r.n)));
  const sorted = rows.map((r) => r.pull).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return rows
    .map((r) => {
      const fitted = r.x.reduce((s, v, i) => s + v * beta[i], 0);
      const expected = Math.max(0, Math.round(Math.expm1(fitted)));
      const above = Math.log1p(r.n) >= fitted;
      const group: Group = r.pull >= median ? (above ? "stronghold" : "untapped") : above ? "earned" : "quiet";
      return { state: r.s.name, fips: r.s.fips, freshmen: r.n, expected, pull: Math.round(r.pull * 1000) / 1000, group, gap: r.n - expected };
    })
    .sort((a, b) => b.pull - a.pull);
}
