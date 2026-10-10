import { describe, expect, it } from "vitest";
import type { BookPick } from "../books/engine";
import { buildHoldings } from "../holdings/holdings";
import { buildLists, DEFAULT_PRICES, estimatePrice } from "./purchase";

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

describe("estimatePrice", () => {
  it("prices by format, graphic novels first", () => {
    expect(estimatePrice(pick("a", { graphic: true, format: "Hardcover" }))).toBe(DEFAULT_PRICES.graphic);
    expect(estimatePrice(pick("b", { format: "Hardcover" }))).toBe(DEFAULT_PRICES.hardcover);
    expect(estimatePrice(pick("c", { format: "Paperback" }))).toBe(DEFAULT_PRICES.paperback);
    expect(estimatePrice(pick("d"))).toBe(DEFAULT_PRICES.other);
  });
});

describe("buildLists", () => {
  const holdings = buildHoldings([
    { title: "Book owned1", author: "Author owned1", isbns: ["9780306406157"], copies: 1 },
    { title: "Book owned2", author: "Author owned2", isbns: [], copies: 3 },
  ]);
  const picks = [
    pick("owned1", { isbn: "9780306406157" }),
    pick("x", { format: "Paperback" }),
    pick("owned2"),
    pick("y", { format: "Hardcover" }),
    pick("z", { format: "Paperback" }),
  ];

  it("fills the budget in rank order and skips titles that would overshoot", () => {
    const lists = buildLists(picks, holdings, 25);
    expect(lists.buy.map((i) => i.pick.book.entity_id)).toEqual(["x", "z"]);
    expect(lists.spent).toBe(24);
    expect(lists.nextIfBudgetGrows.map((i) => i.pick.book.entity_id)).toEqual(["y"]);
  });

  it("promotes owned titles and offers second copies for single-copy favourites", () => {
    const lists = buildLists(picks, holdings, 100);
    expect(lists.promote.map((i) => i.pick.book.entity_id)).toEqual(["owned1", "owned2"]);
    expect(lists.secondCopies.map((i) => i.pick.book.entity_id)).toEqual(["owned1"]);
  });

  it("treats everything as missing when no holdings were uploaded", () => {
    expect(buildLists(picks, null, 1000).buy).toHaveLength(5);
  });
});
