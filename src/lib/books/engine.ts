// Turns a librarian's interest tallies into a ranked list of books, with the interests behind each pick.
// One Qloo query per interest keeps every reason traceable; tallies decide how much each interest counts.

import type { QueryParams } from "../qloo/client";
import { tidy, type QlooBook } from "./clean";

const T = (s: string) => `urn:tag:genre:media:${s}`;

/** Books must carry one of these (teen or middle-grade shelving). */
export const TEEN_TAGS = ["young_adult", "young_adult_fantasy", "young_adult_contemporary", "young_adult_romance", "young_adult_paranormal", "young_adult_science_fiction", "young_adult_historical_fiction", "childrens", "middle_grade"].map(T);
/** Adult shelving and assigned-reading lists are out of scope by default; librarians can edit this. */
export const EXCLUDE_TAGS = ["adult", "adult_fiction", "new_adult", "read_school", "classics", "childrens_classics"].map(T);

export type InterestSignal = { entityId: string } | { tagId: string };

export interface TalliedInterest {
  id: string;
  label: string;
  count: number;
  signal: InterestSignal;
}

export interface BookPick {
  book: QlooBook;
  score: number;
  reasons: { interestId: string; label: string; share: number }[];
  bridge: boolean;
}

export interface FindOptions {
  perInterest?: number;
  limit?: number;
  minYear?: number;
  perAuthor?: number;
  excludeTags?: string[];
  excludeEntityIds?: string[];
}

export function bookQuery(signal: InterestSignal, opts: FindOptions = {}): QueryParams {
  return {
    "filter.type": "urn:entity:book",
    ...("entityId" in signal ? { "signal.interests.entities": signal.entityId } : { "signal.interests.tags": signal.tagId }),
    "filter.publication_year.min": opts.minYear ?? 2005,
    "filter.tags": TEEN_TAGS,
    "filter.exclude.tags": opts.excludeTags ?? EXCLUDE_TAGS,
    "filter.exclude.entities": opts.excludeEntityIds?.length ? opts.excludeEntityIds : undefined,
    take: opts.perInterest ?? 30,
  };
}

type Getter = (path: string, params: QueryParams) => Promise<{ results?: { entities?: QlooBook[] } }>;

// Reciprocal-rank weighting: a book's position matters more than Qloo's tightly bunched affinity scores.
const RANK_K = 10;

export async function findBooks(get: Getter, interests: TalliedInterest[], opts: FindOptions = {}): Promise<BookPick[]> {
  const active = interests.filter((i) => i.count > 0);
  const total = active.reduce((sum, i) => sum + i.count, 0);
  if (!total) return [];

  const merged = new Map<string, { book: QlooBook; score: number; parts: Map<string, { label: string; value: number }> }>();
  for (const interest of active) {
    const res = await get("/v2/insights", bookQuery(interest.signal, opts));
    const weight = interest.count / total;
    (res.results?.entities ?? []).forEach((book, rank) => {
      const value = weight / (RANK_K + rank);
      const entry = merged.get(book.entity_id) ?? { book, score: 0, parts: new Map() };
      entry.score += value;
      const part = entry.parts.get(interest.id) ?? { label: interest.label, value: 0 };
      part.value += value;
      entry.parts.set(interest.id, part);
      merged.set(book.entity_id, entry);
    });
  }

  const ranked = [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ book, score, parts }) => ({
      book,
      score,
      bridge: parts.size >= 2,
      reasons: [...parts.entries()]
        .map(([interestId, p]) => ({ interestId, label: p.label, share: p.value / score }))
        .sort((a, b) => b.share - a.share),
    }));
  return tidy(ranked, opts.perAuthor ?? 2).slice(0, opts.limit ?? 40);
}

/** "Students into Minecraft (62%) and Stranger Things (38%)" */
export function reasonLine(pick: BookPick): string {
  const parts = pick.reasons.map((r) => `${r.label} (${Math.round(r.share * 100)}%)`);
  if (parts.length === 1) return `Students into ${parts[0].replace(/ \(100%\)$/, "")}`;
  return `Students into ${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
