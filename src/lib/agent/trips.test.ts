import { describe, expect, it } from "vitest";
import { planTrips, type TripMetro } from "./trips";

const m = (cbsa: string, city: string, st: string, lon: number, pull: number): TripMetro => ({ cbsa, city, states: [st], pop2025: 1_000_000, pull, lat: 37, lon });
const metros = [
  m("1", "Seattle", "WA", -122, 0.9),
  m("2", "Portland", "OR", -122.6, 0.85),
  m("3", "Denver", "CO", -105, 0.8),
  m("4", "Chicago", "IL", -87.6, 0.75),
  m("5", "Boston", "MA", -71, 0.7),
  m("6", "Miami", "FL", -80, 0.6),
  m("7", "Tiny", "KS", -97, 0.1),
];

describe("planTrips", () => {
  it("takes the strongest metros and gives each recruiter a west-to-east territory", () => {
    const trips = planTrips(metros, { recruiters: 2, weeks: 1, stopsPerWeek: 2 });
    const cities = trips.map((t) => t.stops.map((s) => s.city));
    expect(trips.map((t) => t.recruiter)).toEqual([1, 2]);
    expect(cities.flat()).not.toContain("Tiny");
    expect(cities[0]).toEqual(expect.arrayContaining(["Seattle", "Portland"]));
    // Denver and Chicago are about 1,500 km apart, so recruiter 2's one week covers Denver only.
    expect(cities[1]).toEqual(["Denver"]);
  });

  it("never puts far-apart stops in the same week", () => {
    const far = [{ ...m("8", "Honolulu", "HI", -157.9, 0.95), lat: 21.3 }, { ...m("9", "San Francisco", "CA", -122.4, 0.94), lat: 37.8 }, { ...m("10", "San Jose", "CA", -121.9, 0.93), lat: 37.3 }];
    const trips = planTrips(far, { recruiters: 1, weeks: 3, stopsPerWeek: 2 });
    expect(trips.map((t) => t.stops.map((s) => s.city))).toEqual([["Honolulu"], ["San Francisco", "San Jose"]]);
  });

  it("drops the weakest stops, not the last ones, when stops don't fit", () => {
    const west = [
      { ...m("8", "Honolulu", "HI", -157.9, 0.5), lat: 21.3 },
      { ...m("9", "San Francisco", "CA", -122.4, 0.9), lat: 37.8 },
      { ...m("10", "Seattle", "WA", -122.3, 0.88), lat: 47.6 },
    ];
    const trips = planTrips(west, { recruiters: 1, weeks: 2, stopsPerWeek: 1 });
    expect(trips.flatMap((t) => t.stops.map((s) => s.city))).toEqual(["San Francisco", "Seattle"]);
    expect(trips.map((t) => t.week)).toEqual([1, 2]);
  });

  it("keeps a strong metro that ends the route alone over a pair of weaker ones", () => {
    const west = [
      { ...m("8", "Honolulu", "HI", -157.9, 0.95), lat: 21.3 },
      { ...m("9", "San Francisco", "CA", -122.4, 0.9), lat: 37.8 },
      { ...m("10", "Seattle", "WA", -122.3, 0.88), lat: 47.6 },
      { ...m("11", "Stockton", "CA", -121.3, 0.7), lat: 37.96 },
      { ...m("12", "Modesto", "CA", -121.0, 0.65), lat: 37.64 },
      { ...m("13", "Sacramento", "CA", -121.5, 0.75), lat: 38.58 },
    ];
    const trips = planTrips(west, { recruiters: 1, weeks: 3, stopsPerWeek: 2 });
    const cities = trips.flatMap((t) => t.stops.map((s) => s.city));
    expect(trips).toHaveLength(3);
    expect(cities).toContain("Seattle");
    expect(cities).not.toContain("Modesto");
  });

  it("keeps to a region when asked", () => {
    const trips = planTrips(metros, { recruiters: 1, weeks: 2, stopsPerWeek: 1, region: "west" });
    expect(trips.flatMap((t) => t.stops.map((s) => s.states[0]))).toEqual(expect.arrayContaining(["WA", "OR"]));
    expect(trips.flatMap((t) => t.stops.map((s) => s.city))).not.toContain("Boston");
  });
});
