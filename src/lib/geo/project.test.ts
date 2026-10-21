import { describe, expect, it } from "vitest";
import { project } from "./project";

describe("project", () => {
  it("puts cities where the map draws them", () => {
    const [sx, sy] = project(-122.33, 47.61)!; // Seattle: top left
    const [mx, my] = project(-80.19, 25.76)!; // Miami: bottom right
    const [cx] = project(-87.63, 41.88)!; // Chicago: in between
    expect(sx).toBeLessThan(cx);
    expect(cx).toBeLessThan(mx);
    expect(sy).toBeLessThan(my);
    for (const v of [sx, sy, mx, my]) expect(v).toBeGreaterThan(0);
    expect(sx).toBeLessThan(960);
  });

  it("sends Alaska and Hawaii to their insets and drops the rest", () => {
    const [ax, ay] = project(-149.9, 61.2)!; // Anchorage
    const [hx, hy] = project(-157.86, 21.31)!; // Honolulu
    expect(ax).toBeLessThan(260);
    expect(ay).toBeGreaterThan(400);
    expect(hx).toBeLessThan(420);
    expect(hy).toBeGreaterThan(480);
    expect(project(-0.12, 51.5)).toBeNull(); // London
    expect(project(-99.13, 19.43)).toBeNull(); // Mexico City
  });
});
