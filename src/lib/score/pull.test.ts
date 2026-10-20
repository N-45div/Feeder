import { describe, expect, it } from "vitest";
import { geohashCentre, shapesFrom, stateAt } from "../geo/geo";
import { statePull, type Cell } from "./pull";

// Two square "states": West covers lon -10..0, East covers 0..10, both lat 0..10.
const square = (x0: number, x1: number) => [[[x0, 0], [x1, 0], [x1, 10], [x0, 10], [x0, 0]]];
const shapes = shapesFrom({
  features: [
    { properties: { name: "West", abbr: "WE" }, geometry: { type: "Polygon", coordinates: square(-10, 0) } },
    { properties: { name: "East", abbr: "EA" }, geometry: { type: "Polygon", coordinates: square(0, 10) } },
  ],
});

describe("geohashCentre", () => {
  it("decodes a known cell", () => {
    const [lon, lat] = geohashCentre("djcs");
    expect(lat).toBeCloseTo(33.13, 1);
    expect(lon).toBeCloseTo(-87.71, 1);
  });
});

describe("stateAt", () => {
  it("finds the containing state or none", () => {
    expect(stateAt(shapes, -5, 5)?.name).toBe("West");
    expect(stateAt(shapes, 5, 5)?.name).toBe("East");
    expect(stateAt(shapes, 5, 50)).toBeNull();
  });
});

describe("statePull", () => {
  it("weights affinity by popularity and drops thin states", () => {
    // s0 is centred near lon 5.6, lat 2.8 (East); 7zz near lon -0.7, lat -0.7 (outside both).
    const east: Cell[] = Array.from({ length: 10 }, (_, i) => ["s0", i < 5 ? 1 : 0, i < 5 ? 0.9 : 0.1] as Cell);
    const pulls = statePull([...east, ["7zz", 1, 1]], shapes);
    expect(pulls.get("East")!.pull).toBeCloseTo(0.9, 5);
    expect(pulls.get("East")!.meanAffinity).toBeCloseTo(0.5, 5);
    expect(pulls.has("West")).toBe(false);
    expect(statePull(east.slice(0, 9), shapes).has("East")).toBe(false);
  });
});
