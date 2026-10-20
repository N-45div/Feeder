import { describe, expect, it } from "vitest";
import { geohashCentre } from "../geo/geo";
import { metroPull, type Metro } from "./metros";
import type { Cell } from "./pull";

const metro = (cbsa: string, hash: string): Metro => {
  const [lon, lat] = geohashCentre(hash);
  return { cbsa, name: cbsa, city: cbsa, states: ["XX"], pop2025: 1_000_000, lat, lon };
};

describe("metroPull", () => {
  it("averages nearby cells by popularity and skips metros with too few cells", () => {
    const cells: Cell[] = [["9q5c", 0.9, 0.8], ["9q5c", 0.5, 0.2], ["dr5r", 0.4, 1]];
    const out = metroPull(cells, [metro("LA", "9q5c"), metro("NYC", "dr5r")], { lat: 34, lon: -118 });
    expect(out.map((m) => m.metro.cbsa)).toEqual(["LA"]);
    expect(out[0].pull).toBeCloseTo((0.9 * 0.8 + 0.5 * 0.2) / 1.0, 5);
    expect(out[0].cells).toBe(2);
  });
});
