// Turns raw Qloo book entities into purchasable titles: drops merchandise and box sets,
// keeps one title per series, and caps how many titles one author can take.

export interface QlooBook {
  entity_id: string;
  name: string;
  disambiguation?: string;
  popularity?: number;
  properties?: {
    publication_year?: number;
    isbn13?: string;
    isbn10?: string;
    series_name?: string;
    page_count?: number;
    publisher?: string;
    format?: string;
    short_description?: string;
  };
  tags?: { id?: string; tag_id?: string; name?: string }[];
  query?: { affinity?: number; explainability?: Record<string, { entity_id: string; score: number }[]> };
}

const MERCH = [
  /colou?ring book/i,
  /\byearbook\b/i,
  /\bbox(ed)? set\b/i,
  /\bbooks? set\b/i,
  /\bcollection\b.*\bbooks?\b/i,
  /\bcomplete (series|collection)\b/i,
  /\bvolumes?\s*\d+\s*[-–]\s*\d+/i,
  /\bseries volume\b/i,
  /\b(calendar|sticker book|activity book|poster book|guided journal|notebook)\b/i,
  /\bofficial (guide|handbook)\b/i,
];

export function isMerch(title: string): boolean {
  return MERCH.some((re) => re.test(title));
}

/** "2019, Holly Jackson" -> "Holly Jackson". Qloo puts the author after the year in disambiguation. */
export function authorOf(book: QlooBook): string | null {
  const parts = (book.disambiguation ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const named = parts.filter((p) => !/^\d{4}$/.test(p));
  return named.length ? named.join(", ").replace(/\s+/g, " ") : null;
}

/** Series from the series_name property, or from a "(Series, #3)" suffix in the title. */
export function seriesOf(book: QlooBook): string | null {
  if (book.properties?.series_name) return book.properties.series_name.trim();
  const m = book.name.match(/\(([^()#]+?),\s*#[\d.]+\)\s*$/);
  return m ? m[1].trim() : null;
}

/** Title without the "(Series, #n)" suffix. */
export function cleanTitle(name: string): string {
  return name.replace(/\s*\([^()]*#[\d.\-]+\)\s*$/, "").trim();
}

/** Keeps input order (best first): drops merch, keeps the first title per series and at most `perAuthor` per author. */
export function tidy<T extends { book: QlooBook }>(ranked: T[], perAuthor = 2): T[] {
  const seenSeries = new Set<string>();
  const authorCount = new Map<string, number>();
  const out: T[] = [];
  for (const item of ranked) {
    const { book } = item;
    if (isMerch(book.name)) continue;
    const series = seriesOf(book)?.toLowerCase();
    if (series && seenSeries.has(series)) continue;
    const author = authorOf(book)?.toLowerCase();
    if (author && (authorCount.get(author) ?? 0) >= perAuthor) continue;
    if (series) seenSeries.add(series);
    if (author) authorCount.set(author, (authorCount.get(author) ?? 0) + 1);
    out.push(item);
  }
  return out;
}
