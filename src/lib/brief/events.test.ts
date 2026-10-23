import { describe, expect, it } from "vitest";
import { relevant, upcoming } from "./events";

describe("relevant", () => {
  it.each([
    ["Black College Expo", true],
    ["Annual Seattle Black College Expo", true],
    ["NACAC National College Fair", true],
    ["College Night at Garfield High", true],
    ["Annual National HBCU College Fair, Auditions, Theater & Dance", true],
    ["Spring Transfer Fair", true],
    ["College and Career Fair at Lincoln High", true],
    ["Discovery Day", false],
    ["Dallas College Preview Day", false],
    ["Morehouse College Fall Open House", false],
    ["Lincoln Center Open House", false],
    ["Sotheby's Institute of Art - New York Open House: Master's Programs", false],
    ["Caring For Young Minds Annual HBCU Christmas Fundraiser", false],
    ["Creative Career Fair", false],
    ["UW Study Abroad Fair", false],
    ["Seattle Camp Fair at UW", false],
    ["Indigenous Hip Hop Summit", false],
    ["Showcase Gala", false],
  ])("%s -> %s", (title, keep) => expect(relevant(title)).toBe(keep));
});

describe("upcoming", () => {
  const now = new Date("2026-10-22T09:00:00Z");
  it.each([
    ["Nov 14", true],
    ["Oct 22", true],
    ["Oct 21", true],
    ["Oct 19", false],
    ["Jan 14", true],
    [null, true],
    ["sometime soon", true],
  ])("%s -> %s", (start, keep) => expect(upcoming(start, now)).toBe(keep));

  it("rolls a date from last month forward a year only when it is well past", () => {
    expect(upcoming("Sep 30", now)).toBe(false);
    expect(upcoming("Aug 1", now)).toBe(true);
  });
});
