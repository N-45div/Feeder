// Resolves catalogue interests to Qloo signals: games and shows to entity ids (with a name check, because
// Qloo search silently returns near-misses), topics to book genre tags.

import type { QueryParams } from "../qloo/client";
import type { InterestSignal } from "../books/engine";
import type { Interest } from "./catalog";

export interface Resolution {
  interestId: string;
  signal: InterestSignal | null;
  matched: string | null;
}

type Getter = (path: string, params: QueryParams) => Promise<{ results?: unknown }>;

const tokens = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(Boolean);

/** Share of the query's words found in the candidate name (1 = every word present). */
export function coverage(query: string, name: string): number {
  const q = tokens(query);
  const n = new Set(tokens(name));
  return q.length ? q.filter((w) => n.has(w)).length / q.length : 0;
}

/** Words in the candidate name that the query doesn't have ("Beauty and the beast" vs "beauty" = 3). */
export function extraWords(query: string, name: string): number {
  const q = new Set(tokens(query));
  return tokens(name).filter((w) => !q.has(w)).length;
}

const MIN_COVERAGE = 0.8;
const MAX_EXTRA = { entity: 2, tag: 1 };
const TAG_PREFERENCE = ["urn:tag:genre:media:", "urn:tag:keyword:media:"];

/** An exact name wins; otherwise the candidate must contain the query and add only a few words. */
function pick<T extends { name: string }>(query: string, candidates: T[], maxExtra: number): T | undefined {
  const exact = candidates.find((c) => tokens(c.name).join(" ") === tokens(query).join(" "));
  return exact ?? candidates.find((c) => coverage(query, c.name) >= MIN_COVERAGE && extraWords(query, c.name) <= maxExtra);
}

export async function resolveInterest(get: Getter, interest: Interest): Promise<Resolution> {
  if ("entityType" in interest) {
    const res = await get("/search", { query: interest.query, types: interest.entityType, take: 5 });
    const hit = pick(interest.query, (res.results ?? []) as { entity_id: string; name: string }[], MAX_EXTRA.entity);
    return { interestId: interest.id, signal: hit ? { entityId: hit.entity_id } : null, matched: hit?.name ?? null };
  }
  const res = await get("/v2/tags", { "filter.query": interest.tagQuery, "filter.parents.types": "urn:entity:book", take: 10 });
  const tags = (((res.results ?? {}) as { tags?: { id?: string; tag_id?: string; name: string }[] }).tags ?? []).map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name }));
  for (const prefix of TAG_PREFERENCE) {
    const tag = pick(interest.tagQuery, tags.filter((t) => t.id.startsWith(prefix)), MAX_EXTRA.tag);
    if (tag) return { interestId: interest.id, signal: { tagId: tag.id }, matched: tag.name };
  }
  return { interestId: interest.id, signal: null, matched: null };
}
