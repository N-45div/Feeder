import { describe, expect, it } from "vitest";
import type { BriefPlace } from "./brief";
import { mapsRoute, visitDay } from "./route";

const place = (name: string, lat: number | null, lon: number | null, address: string | null = null): BriefPlace => ({ name, address, lat, lon });

describe("visitDay", () => {
  it("starts at the top-ranked school and goes to the nearest next", () => {
    const day = visitDay([place("A", 37.8, -122.0), place("Far", 38.6, -121.5), place("Near A", 37.81, -122.01), place("No location", null, null)]);
    expect(day.map((s) => s.name)).toEqual(["A", "Near A", "Far"]);
    expect(day[0].legKm).toBe(0);
    expect(day[1].legKm).toBeLessThan(2);
    expect(day.map((s) => s.rank)).toEqual([1, 3, 2]);
  });

  it("caps the day and copes with nothing located", () => {
    expect(visitDay(Array.from({ length: 9 }, (_, i) => place(`S${i}`, 37 + i / 100, -122)), 5)).toHaveLength(5);
    expect(visitDay([place("X", null, null)])).toEqual([]);
  });
});

describe("mapsRoute", () => {
  it("builds a Google Maps directions link through every stop", () => {
    const day = visitDay([place("A", 37.8, -122.0, "1 Main St"), place("B", 37.81, -122.01), place("C", 37.9, -122.1, "3 Oak Ave")]);
    const url = new URL(mapsRoute(day)!);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("origin")).toBe("A, 1 Main St");
    expect(url.searchParams.get("waypoints")).toBe("37.81,-122.01");
    expect(url.searchParams.get("destination")).toBe("C, 3 Oak Ave");
    expect(mapsRoute(day.slice(0, 1))).toBeNull();
  });
});
