import { describe, expect, it } from "vitest";
import { isOwnPlace, placeKind } from "./classify";

describe("placeKind", () => {
  it.each([
    ["De La Salle High School", "high_school"],
    ["The Athenian School", "high_school"],
    ["Alonzo King LINES Ballet School", "other"],
    ["Bishop O’Dowd High School", "high_school"],
    ["Saint Mary's College of California", "college"],
    ["Dominican University of California", "college"],
    ["College of San Mateo", "college"],
    ["Edwards Stadium", "other"],
    ["Saul's Deli Parklet", "other"],
    ["Haas School of Business", "college"],
  ])("%s is %s", (name, kind) => expect(placeKind(name)).toBe(kind));
});

describe("isOwnPlace", () => {
  it("spots the university's own campus and parts", () => {
    expect(isOwnPlace("University of Oregon Portland", "University of Oregon")).toBe(true);
    expect(isOwnPlace("Oregon State University", "University of Oregon")).toBe(false);
    expect(isOwnPlace("University of Michigan Museum of Art", "University of Michigan-Ann Arbor")).toBe(true);
  });
});
