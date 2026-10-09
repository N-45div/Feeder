// Reads a library's holdings export (CSV/TSV, e.g. a Destiny title or copy list) entirely in the browser,
// and answers "do we already own this book, and how many copies?" by ISBN, then by title + author surname.

import { isbnsIn, toIsbn13 } from "./isbn";

export interface HoldingRow {
  title: string;
  author: string | null;
  isbns: string[];
  copies: number;
}

export interface Holdings {
  rows: HoldingRow[];
  byIsbn: Map<string, HoldingRow>;
  byKey: Map<string, HoldingRow>;
}

export type Match = { status: "owned"; copies: number; via: "isbn" | "title" } | { status: "missing" };

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.indexOf("\n") >>> 0);
  const delimiter = ["\t", ";", ","].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export function detectColumns(header: string[]) {
  const find = (re: RegExp) => header.findIndex((h) => re.test(h.trim()));
  const columns = {
    title: find(/^(title|title statement|245)/i),
    author: find(/^(author|creator|main entry|100)/i),
    isbn: find(/isbn|020/i),
    copies: find(/^(copies|# ?of copies|copy count|count|quantity)/i),
  };
  if (columns.title < 0 && columns.isbn < 0) throw new Error("Couldn't find a Title or ISBN column in this file.");
  return columns;
}

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/** "Jackson, Holly" and "Holly Jackson" both give "jackson". */
export function surname(author: string | null | undefined): string {
  if (!author) return "";
  const a = author.split(/;| and /i)[0];
  const name = a.includes(",") ? a.split(",")[0] : a.trim().split(/\s+/).at(-1) ?? "";
  return words(name);
}

/** Main title (before any subtitle or series suffix) plus author surname. */
export function titleKey(title: string, author: string | null | undefined): string {
  const main = title.replace(/\s*\([^()]*#[\d.\-]+\)\s*$/, "").split(/[:/]/)[0];
  return `${words(main.replace(/^(the|a|an)\s+/i, ""))}|${surname(author)}`;
}

export function readHoldings(text: string): Holdings {
  const [header, ...body] = parseCsv(text);
  if (!header) throw new Error("The file is empty.");
  const col = detectColumns(header);
  const byKey = new Map<string, HoldingRow>();
  for (const r of body) {
    const title = (col.title >= 0 ? r[col.title] : "")?.trim() ?? "";
    const author = col.author >= 0 ? r[col.author]?.trim() || null : null;
    const isbns = col.isbn >= 0 ? isbnsIn(r[col.isbn]) : [];
    if (!title && !isbns.length) continue;
    const copies = col.copies >= 0 ? Math.max(1, Number.parseInt(r[col.copies], 10) || 1) : 1;
    const key = title ? titleKey(title, author) : `isbn:${isbns[0]}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.copies += copies;
      for (const i of isbns) if (!existing.isbns.includes(i)) existing.isbns.push(i);
    } else byKey.set(key, { title, author, isbns, copies });
  }
  const rows = [...byKey.values()];
  const byIsbn = new Map<string, HoldingRow>();
  for (const row of rows) for (const isbn of row.isbns) byIsbn.set(isbn, row);
  return { rows, byIsbn, byKey };
}

export function matchBook(holdings: Holdings, book: { title: string; author?: string | null; isbn13?: string | null; isbn10?: string | null }): Match {
  for (const raw of [book.isbn13, book.isbn10]) {
    const isbn = toIsbn13(raw);
    const row = isbn ? holdings.byIsbn.get(isbn) : undefined;
    if (row) return { status: "owned", copies: row.copies, via: "isbn" };
  }
  const row = holdings.byKey.get(titleKey(book.title, book.author));
  return row ? { status: "owned", copies: row.copies, via: "title" } : { status: "missing" };
}
