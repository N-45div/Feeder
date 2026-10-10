import { describe, expect, it } from "vitest";
import type { BookPick } from "../books/engine";
import { buildHoldings } from "../holdings/holdings";
import { interestGaps } from "./gaps";
import { buildLists } from "./purchase";

const pick = (id: string, opts: { isbn?: string; format?: string; graphic?: boolean; interest?: string } = {}): BookPick => ({
  book: {
    entity_id: id,
    name: `Book ${id}`,
    disambiguation: `2020, Author ${id}`,
    properties: { isbn13: opts.isbn, format: opts.format },
    tags: opts.graphic ? [{ id: "urn:tag:genre:media:graphic_novels" }] : [],
  },
  score: 1,
  bridge: false,
  reasons: [{ interestId: opts.interest ?? "games", label: "Games", share: 1 }],
});

describe("interestGaps", () => {
  it("ranks interests by students left without owned books", () => {
    const holdings = buildHoldings([{ title: "Book g1", author: "Author g1", isbns: [], copies: 1 }]);
    const lists = buildLists([pick("g1", { interest: "games" }), pick("g2", { interest: "games" }), pick("h1", { interest: "horror" })], holdings, 100);
    const gaps = interestGaps(
      [
        { id: "games", label: "Games", count: 10, signal: { entityId: "g" } },
        { id: "horror", label: "Horror", count: 8, signal: { tagId: "h" } },
        { id: "none", label: "Nobody", count: 0, signal: { tagId: "n" } },
      ],
      lists,
    );
    expect(gaps.map((g) => g.interestId)).toEqual(["horror", "games"]);
    expect(gaps[1]).toMatchObject({ booksSuggested: 2, booksOwned: 1, coverage: 0.5 });
  });
});
