import { describe, expect, it } from "vitest";
import { checkInsightsParams } from "./params";

describe("checkInsightsParams", () => {
  it("accepts a located movie query with explainability", () => {
    expect(
      checkInsightsParams({
        "filter.type": "urn:entity:movie",
        "signal.location.query": "Fort Wayne, Indiana",
        "filter.release_year.min": 1977,
        "feature.explainability": true,
        take: 20,
      }),
    ).toEqual([]);
  });

  it("flags a filter that Qloo would silently ignore for the type", () => {
    expect(
      checkInsightsParams({ "filter.type": "urn:entity:artist", "filter.release_year.min": 1990 }),
    ).toEqual(["filter.release_year.min is ignored for urn:entity:artist"]);
  });

  it("flags location filters on non-place types but allows location signals", () => {
    const problems = checkInsightsParams({
      "filter.type": "urn:entity:tv_show",
      "filter.location.query": "Toledo, Ohio",
      "signal.location.query": "Toledo, Ohio",
    });
    expect(problems).toEqual(["filter.location.query is ignored for urn:entity:tv_show"]);
  });

  it("catches typos and unsupported types", () => {
    expect(checkInsightsParams({ "filter.type": "urn:entity:music" })[0]).toMatch(/filter.type must be one of/);
    expect(checkInsightsParams({ "filter.type": "urn:entity:video_game" })[0]).toMatch(/filter.type must be one of/);
    expect(checkInsightsParams({ "filter.type": "urn:entity:videogame" })).toEqual([]);
    expect(checkInsightsParams({ "filter.type": "urn:entity:brand", "filter.tag": "x" })).toEqual([
      "filter.tag is not a documented insights parameter",
    ]);
  });

  it("enforces take limits and the destination signal rule", () => {
    expect(checkInsightsParams({ "filter.type": "urn:entity:place", take: 51 })).toEqual([
      "take must be between 1 and 50",
    ]);
    expect(checkInsightsParams({ "filter.type": "urn:entity:destination" })).toEqual([
      "urn:entity:destination requires signal.interests.entities",
    ]);
  });
});
