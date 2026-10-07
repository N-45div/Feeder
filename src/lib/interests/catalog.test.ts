import { describe, expect, it } from "vitest";
import { ENTITY_TYPES } from "../qloo/params";
import { INTERESTS } from "./catalog";

describe("interest catalogue", () => {
  it("has unique ids and labels", () => {
    expect(new Set(INTERESTS.map((i) => i.id)).size).toBe(INTERESTS.length);
    expect(new Set(INTERESTS.map((i) => i.label)).size).toBe(INTERESTS.length);
  });

  it("uses only entity types the live API accepts", () => {
    for (const i of INTERESTS) {
      if ("entityType" in i) expect(ENTITY_TYPES).toContain(i.entityType);
    }
  });

  it("covers games, screen and topics", () => {
    const counts = INTERESTS.reduce<Record<string, number>>((acc, i) => ((acc[i.category] = (acc[i.category] ?? 0) + 1), acc), {});
    expect(counts.games).toBeGreaterThan(10);
    expect(counts.screen).toBeGreaterThan(10);
    expect(counts.topics).toBeGreaterThan(20);
  });
});
