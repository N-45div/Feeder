// A university's "pull" in each state from its national Qloo heatmap (docs/eval-plan.md, arm 1): the popularity-weighted mean
// affinity of the cells whose centres fall in the state. States with fewer than MIN_CELLS cells get no score.

import { geohashCentre, stateAt, type StateShape } from "../geo/geo";

/** One heatmap cell as cached: [geohash, affinity 0-1, popularity 0-1]. */
export type Cell = [string, number, number];

export const MIN_CELLS = 10;

export interface StatePull {
  state: string;
  pull: number;
  /** Plain mean affinity, the plan's robustness check. */
  meanAffinity: number;
  cells: number;
}

export function statePull(cells: Cell[], shapes: StateShape[]): Map<string, StatePull> {
  const acc = new Map<string, { w: number; wa: number; a: number; n: number }>();
  for (const [hash, affinity, popularity] of cells) {
    const [lon, lat] = geohashCentre(hash);
    const state = stateAt(shapes, lon, lat);
    if (!state) continue;
    const s = acc.get(state.name) ?? { w: 0, wa: 0, a: 0, n: 0 };
    s.w += popularity;
    s.wa += popularity * affinity;
    s.a += affinity;
    s.n += 1;
    acc.set(state.name, s);
  }
  const out = new Map<string, StatePull>();
  for (const [state, s] of acc) {
    if (s.n < MIN_CELLS || s.w <= 0) continue;
    out.set(state, { state, pull: s.wa / s.w, meanAffinity: s.a / s.n, cells: s.n });
  }
  return out;
}
