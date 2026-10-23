import { describe, expect, it } from "vitest";
import type { BriefPlace } from "./brief";
import { mapsRoute, pickAccess, visitDay, type AccessSchool } from "./route";

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

const school = (name: string, lat: number, lon: number, enrollment: number | null): AccessSchool => ({ name, city: "Oakland", lat, lon, enrollment, basis: "title_i" });

describe("pickAccess", () => {
  const day = [{ name: "A", lat: 37.8, lon: -122.0 }];
  it("takes the large school closest to the day's stops", () => {
    const picked = pickAccess([school("Far big", 38.6, -121.5, 2000), school("Near big", 37.82, -122.02, 1500), school("Near small", 37.8, -122.0, 300)], day);
    expect(picked?.name).toBe("Near big");
  });
  it("skips a school already on the day under another name", () => {
    const picked = pickAccess([school("Same place", 37.8005, -122.0005, 2000), school("Next door", 37.83, -122.03, 1500)], day);
    expect(picked?.name).toBe("Next door");
  });
  it("falls back to smaller schools, skips ones already on the day, and copes with none", () => {
    expect(pickAccess([school("Small", 37.81, -122.0, 500)], day)?.name).toBe("Small");
    expect(pickAccess([school("a", 37.8, -122.0, 900)], [{ name: "A", lat: 37.8, lon: -122.0 }, { name: "a", lat: 1, lon: 1 }])).toBeNull();
    expect(pickAccess([], day)).toBeNull();
  });
});

describe("visitDay with an access stop", () => {
  it("keeps the day's length, marks the access stop and routes it in", () => {
    const places = Array.from({ length: 6 }, (_, i) => place(`S${i}`, 37.8 + i / 100, -122));
    const day = visitDay(places, 5, school("Title I High", 37.805, -122.0, 1200));
    expect(day).toHaveLength(5);
    expect(day[0].name).toBe("S0");
    const access = day.find((s) => s.access);
    expect(access?.rank).toBeNull();
    expect(access?.access?.enrollment).toBe(1200);
    expect(day.filter((s) => !s.access).map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });
});
