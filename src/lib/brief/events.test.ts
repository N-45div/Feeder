import { describe, expect, it } from "vitest";
import { relevant } from "./events";

describe("relevant", () => {
  it.each([
    ["Black College Expo", true],
    ["Annual Seattle Black College Expo", true],
    ["Discovery Day", true],
    ["NACAC National College Fair", true],
    ["College Night at Garfield High", true],
    ["UW Study Abroad Fair", false],
    ["Seattle Camp Fair at UW", false],
    ["Indigenous Hip Hop Summit", false],
    ["Showcase Gala", false],
  ])("%s -> %s", (title, keep) => expect(relevant(title)).toBe(keep));
});
