// Minimal MARC 21 (ISO 2709) reader for holdings exports such as Destiny's "Export Titles".
// Offsets in the leader and directory are byte counts, so parsing works on bytes and decodes field by field.
// Reads ISBN (020 $a), title (245 $a $b), author (100 $a) and counts copies from holdings fields (852 or 949).

import { buildHoldings, type Holdings, type HoldingRow } from "./holdings";
import { isbnsIn } from "./isbn";

const RECORD_END = 0x1d;
const FIELD_END = 0x1e;
const SUBFIELD = "\u001f";
const COPY_TAGS = new Set(["852", "949"]);

export function readMarcRecords(bytes: Uint8Array): HoldingRow[] {
  const utf8 = new TextDecoder("utf-8");
  const latin1 = new TextDecoder("latin1");
  const rows: HoldingRow[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = bytes.indexOf(RECORD_END, start);
    if (end < 0) end = bytes.length;
    const record = bytes.subarray(start, end);
    start = end + 1;
    if (record.length < 25) continue;

    const leader = latin1.decode(record.subarray(0, 24));
    const decode = leader[9] === "a" ? utf8 : latin1;
    const base = Number.parseInt(leader.slice(12, 17), 10);
    const dirEnd = record.indexOf(FIELD_END, 24);
    if (!Number.isFinite(base) || dirEnd < 0) continue;

    const fields: { tag: string; value: string }[] = [];
    const directory = latin1.decode(record.subarray(24, dirEnd));
    for (let i = 0; i + 12 <= directory.length; i += 12) {
      const tag = directory.slice(i, i + 3);
      const length = Number.parseInt(directory.slice(i + 3, i + 7), 10);
      const offset = Number.parseInt(directory.slice(i + 7, i + 12), 10);
      const raw = record.subarray(base + offset, base + offset + length);
      fields.push({ tag, value: decode.decode(raw).replace(/\u001e$/, "") });
    }

    const sub = (tag: string, codes: string) =>
      fields
        .filter((f) => f.tag === tag)
        .flatMap((f) => f.value.split(SUBFIELD).slice(1).filter((s) => codes.includes(s[0])).map((s) => s.slice(1).trim()));
    const title = sub("245", "ab").join(" ").replace(/\s*[/:;,.]\s*$/, "").trim();
    const author = sub("100", "a")[0]?.replace(/[,.]\s*$/, "") ?? null;
    const isbns = sub("020", "a").flatMap((v) => isbnsIn(v));
    const copies = Math.max(1, fields.filter((f) => COPY_TAGS.has(f.tag)).length);
    rows.push({ title, author, isbns: [...new Set(isbns)], copies });
  }
  return rows;
}

export function readMarcHoldings(bytes: Uint8Array): Holdings {
  return buildHoldings(readMarcRecords(bytes));
}
