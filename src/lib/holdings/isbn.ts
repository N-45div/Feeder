// ISBN helpers for matching a library's holdings against suggested books.
// Catalogue exports hold messy ISBN cells ("978-0-06-...(pbk.) ; 0060..."), mixed ISBN-10/13 and bad digits.

const strip = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0;
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, d, i) => acc + (d === "X" ? 10 : Number(d)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isbn10to13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
}

/** One ISBN (10 or 13, any punctuation) to a valid ISBN-13, or null. */
export function toIsbn13(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = strip(raw);
  if (s.length === 13 && isValidIsbn13(s)) return s;
  if (s.length === 10 && isValidIsbn10(s)) return isbn10to13(s);
  return null;
}

/** Every valid ISBN in a catalogue cell, as ISBN-13s. */
export function isbnsIn(cell: string | null | undefined): string[] {
  if (!cell) return [];
  const found = new Set<string>();
  for (const m of cell.matchAll(/(?:97[89][\d\- ]{10,14}|\d[\d\- ]{8,11}[\dXx])/g)) {
    const isbn = toIsbn13(m[0]);
    if (isbn) found.add(isbn);
  }
  return [...found];
}
