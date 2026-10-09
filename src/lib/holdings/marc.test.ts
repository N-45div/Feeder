import { describe, expect, it } from "vitest";
import { matchBook } from "./holdings";
import { readMarcHoldings, readMarcRecords } from "./marc";

// Builds an ISO 2709 record (UTF-8) from [tag, fieldText] pairs, the way catalogue systems export them.
function marcRecord(fields: [string, string][]): Uint8Array {
  const enc = new TextEncoder();
  const bodies = fields.map(([, text]) => enc.encode(`${text}\u001e`));
  let directory = "";
  let offset = 0;
  fields.forEach(([tag], i) => {
    directory += tag + String(bodies[i].length).padStart(4, "0") + String(offset).padStart(5, "0");
    offset += bodies[i].length;
  });
  const dir = enc.encode(`${directory}\u001e`);
  const base = 24 + dir.length;
  const total = base + offset + 1;
  const leader = enc.encode(`${String(total).padStart(5, "0")}nam a22${String(base).padStart(5, "0")} a 4500`);
  const out = new Uint8Array(total);
  out.set(leader, 0);
  out.set(dir, 24);
  let at = base;
  for (const b of bodies) { out.set(b, at); at += b.length; }
  out[total - 1] = 0x1d;
  return out;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

const S = "\u001f";
const sky = marcRecord([
  ["020", `  ${S}a9780306406157 (pbk.)`],
  ["100", `1 ${S}aWriter, Ada,`],
  ["245", `10${S}aThe sky road :${S}ba novel /`],
  ["852", `  ${S}bMAIN${S}p1001`],
  ["852", `  ${S}bMAIN${S}p1002`],
]);
const water = marcRecord([
  ["100", `1 ${S}aAuthor, Bö.`],
  ["245", `10${S}aDeep water.`],
]);

describe("readMarcRecords", () => {
  it("reads ISBN, title, author and copies from each record", () => {
    expect(readMarcRecords(concat(sky, water))).toEqual([
      { title: "The sky road : a novel", author: "Writer, Ada", isbns: ["9780306406157"], copies: 2 },
      { title: "Deep water", author: "Author, Bö", isbns: [], copies: 1 },
    ]);
  });

  it("skips truncated records instead of failing", () => {
    expect(readMarcRecords(new Uint8Array([0x30, 0x31, 0x1d]))).toEqual([]);
  });
});

describe("readMarcHoldings", () => {
  it("feeds the same matcher as CSV holdings", () => {
    const holdings = readMarcHoldings(concat(sky, water));
    expect(matchBook(holdings, { title: "x", isbn13: "9780306406157" })).toEqual({ status: "owned", copies: 2, via: "isbn" });
    expect(matchBook(holdings, { title: "Deep Water", author: "Bö Author" })).toEqual({ status: "owned", copies: 1, via: "title" });
  });
});
