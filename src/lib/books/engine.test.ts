import { describe, expect, it } from "vitest";
import type { QueryParams } from "../qloo/client";
import type { QlooBook } from "./clean";
import { bookQuery, EXCLUDE_TAGS, findBooks, reasonLine, TEEN_TAGS, type TalliedInterest } from "./engine";

const b = (id: string, author = `Author ${id}`): QlooBook => ({ entity_id: id, name: `Book ${id}`, disambiguation: `2020, ${author}` });

// Invented fixtures: which books each signal returns, best first.
const RESULTS: Record<string, QlooBook[]> = {
  "game-1": [b("a"), b("b"), b("shared")],
  "show-1": [b("shared"), b("c")],
  "tag-1": [b("d"), b("Colouring Book Edition")],
};

function fakeGet(calls: QueryParams[]) {
  return async (_path: string, params: QueryParams) => {
    calls.push(params);
    const key = String(params["signal.interests.entities"] ?? params["signal.interests.tags"]);
    return { results: { entities: RESULTS[key] ?? [] } };
  };
}

const interests: TalliedInterest[] = [
  { id: "game", label: "Minecraft", count: 12, signal: { entityId: "game-1" } },
  { id: "show", label: "Stranger Things", count: 8, signal: { entityId: "show-1" } },
  { id: "topic", label: "Horror", count: 0, signal: { tagId: "tag-1" } },
];

describe("bookQuery", () => {
  it("builds the teen filter stack for entity and tag signals", () => {
    const q = bookQuery({ entityId: "x" });
    expect(q["filter.type"]).toBe("urn:entity:book");
    expect(q["signal.interests.entities"]).toBe("x");
    expect(q["filter.tags"]).toEqual(TEEN_TAGS);
    expect(q["filter.exclude.tags"]).toEqual(EXCLUDE_TAGS);
    expect(q["filter.publication_year.min"]).toBe(2005);
    expect(bookQuery({ tagId: "t" })["signal.interests.tags"]).toBe("t");
  });
});

describe("findBooks", () => {
  it("skips zero tallies, merges interests and marks bridge titles", async () => {
    const calls: QueryParams[] = [];
    const picks = await findBooks(fakeGet(calls), interests);
    expect(calls).toHaveLength(2);
    const shared = picks.find((p) => p.book.entity_id === "shared")!;
    expect(shared.bridge).toBe(true);
    expect(shared.reasons.map((r) => r.label).sort()).toEqual(["Minecraft", "Stranger Things"]);
    expect(shared.reasons.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1);
    expect(picks[0].book.entity_id).toBe("shared");
  });

  it("weights by tally and drops merchandise", async () => {
    const picks = await findBooks(fakeGet([]), [
      { id: "game", label: "Minecraft", count: 1, signal: { entityId: "game-1" } },
      { id: "topic", label: "Horror", count: 9, signal: { tagId: "tag-1" } },
    ]);
    expect(picks[0].book.entity_id).toBe("d");
    expect(picks.some((p) => p.book.name.includes("Colouring"))).toBe(false);
  });

  it("returns nothing when every tally is zero", async () => {
    expect(await findBooks(fakeGet([]), [{ ...interests[0], count: 0 }])).toEqual([]);
  });
});

describe("reasonLine", () => {
  it("names the interests behind a pick", () => {
    expect(reasonLine({ book: b("x"), score: 1, bridge: false, reasons: [{ interestId: "g", label: "Minecraft", share: 1 }] })).toBe("Students into Minecraft");
    expect(
      reasonLine({ book: b("x"), score: 1, bridge: true, reasons: [{ interestId: "g", label: "Minecraft", share: 0.62 }, { interestId: "s", label: "Stranger Things", share: 0.38 }] }),
    ).toBe("Students into Minecraft (62%) and Stranger Things (38%)");
  });
});
