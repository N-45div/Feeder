// Turns ranked picks plus the library's holdings into what a librarian actually takes to a principal:
// a purchase list inside the budget, second copies for owned one-copy favourites, and owned titles to promote.

import type { BookPick } from "../books/engine";
import { authorOf, cleanTitle } from "../books/clean";
import { matchBook, type Holdings } from "../holdings/holdings";

/** Estimated list prices in the library's currency; the librarian can edit every value. */
export interface PriceTable {
  hardcover: number;
  paperback: number;
  graphic: number;
  other: number;
}

export const DEFAULT_PRICES: PriceTable = { hardcover: 19, paperback: 12, graphic: 14, other: 15 };

export interface ListItem {
  pick: BookPick;
  title: string;
  author: string | null;
  isbn13: string | null;
  price: number;
  copiesOwned: number;
}

export interface Lists {
  buy: ListItem[];
  secondCopies: ListItem[];
  promote: ListItem[];
  /** Missing titles that did not fit the budget, best first. */
  nextIfBudgetGrows: ListItem[];
  spent: number;
}

const GRAPHIC = /graphic_novels|manga|comics/;

export function estimatePrice(pick: BookPick, prices: PriceTable = DEFAULT_PRICES): number {
  const tags = (pick.book.tags ?? []).map((t) => t.id ?? t.tag_id ?? "");
  if (tags.some((t) => GRAPHIC.test(t))) return prices.graphic;
  const format = (pick.book.properties?.format ?? "").toLowerCase();
  if (format.includes("hardcover") || format.includes("hardback")) return prices.hardcover;
  if (format.includes("paperback")) return prices.paperback;
  return prices.other;
}

function item(pick: BookPick, holdings: Holdings | null, prices: PriceTable): ListItem {
  const title = cleanTitle(pick.book.name);
  const author = authorOf(pick.book);
  const isbn13 = pick.book.properties?.isbn13 ?? null;
  const match = holdings ? matchBook(holdings, { title, author, isbn13, isbn10: pick.book.properties?.isbn10 }) : { status: "missing" as const };
  return { pick, title, author, isbn13, price: estimatePrice(pick, prices), copiesOwned: match.status === "owned" ? match.copies : 0 };
}

/**
 * Fills the budget with missing titles in rank order, skipping any that would overshoot it.
 * Owned titles go to "promote"; the top-ranked owned titles with a single copy are offered as second copies.
 */
export function buildLists(picks: BookPick[], holdings: Holdings | null, budget: number, prices: PriceTable = DEFAULT_PRICES, secondCopyTop = 10): Lists {
  const lists: Lists = { buy: [], secondCopies: [], promote: [], nextIfBudgetGrows: [], spent: 0 };
  picks.forEach((pick, rank) => {
    const it = item(pick, holdings, prices);
    if (it.copiesOwned > 0) {
      lists.promote.push(it);
      if (it.copiesOwned === 1 && rank < secondCopyTop) lists.secondCopies.push(it);
    } else if (lists.spent + it.price <= budget) {
      lists.buy.push(it);
      lists.spent += it.price;
    } else {
      lists.nextIfBudgetGrows.push(it);
    }
  });
  return lists;
}
