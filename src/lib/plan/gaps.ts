// Gap report: which student interests the current collection serves worst.
// For each tallied interest, how many of the books it points to does the library already own?

import type { BookPick, TalliedInterest } from "../books/engine";
import type { ListItem, Lists } from "./purchase";

export interface InterestGap {
  interestId: string;
  label: string;
  students: number;
  booksSuggested: number;
  booksOwned: number;
  /** Share of suggested books already on the shelf (0-1). */
  coverage: number;
}

export function interestGaps(interests: TalliedInterest[], lists: Lists): InterestGap[] {
  const owned = new Set(lists.promote.map((i: ListItem) => i.pick.book.entity_id));
  const all: BookPick[] = [...lists.promote, ...lists.buy, ...lists.nextIfBudgetGrows].map((i) => i.pick);
  return interests
    .filter((i) => i.count > 0)
    .map((interest) => {
      const reached = all.filter((p) => p.reasons.some((r) => r.interestId === interest.id));
      const ownedCount = reached.filter((p) => owned.has(p.book.entity_id)).length;
      return {
        interestId: interest.id,
        label: interest.label,
        students: interest.count,
        booksSuggested: reached.length,
        booksOwned: ownedCount,
        coverage: reached.length ? ownedCount / reached.length : 0,
      };
    })
    .sort((a, b) => b.students * (1 - b.coverage) - a.students * (1 - a.coverage));
}
