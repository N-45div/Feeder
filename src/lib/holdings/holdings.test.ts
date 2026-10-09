import { describe, expect, it } from "vitest";
import { detectColumns, matchBook, parseCsv, readHoldings, surname, titleKey } from "./holdings";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, CRLF and a BOM", () => {
    expect(parseCsv('﻿Title,Author\r\n"Sky, Sea",Ada Writer\r\n"He said ""hi""",Bo\r\n')).toEqual([
      ["Title", "Author"],
      ["Sky, Sea", "Ada Writer"],
      ['He said "hi"', "Bo"],
    ]);
  });

  it("detects tab-separated files", () => {
    expect(parseCsv("Title\tISBN\nSky\t9780306406157\n")).toEqual([["Title", "ISBN"], ["Sky", "9780306406157"]]);
  });
});

describe("detectColumns", () => {
  it("finds Destiny-style headers", () => {
    expect(detectColumns(["Barcode", "Title", "Author", "ISBN", "Call Number"])).toMatchObject({ title: 1, author: 2, isbn: 3, copies: -1 });
  });

  it("refuses files without a title or ISBN column", () => {
    expect(() => detectColumns(["Barcode", "Price"])).toThrow(/Title or ISBN/);
  });
});

describe("titleKey / surname", () => {
  it("normalises author order, subtitles, leading articles and series suffixes", () => {
    expect(surname("Writer, Ada")).toBe("writer");
    expect(surname("Ada Writer")).toBe("writer");
    expect(titleKey("The Sky Road: A Novel", "Writer, Ada")).toBe(titleKey("Sky Road (Road Saga, #1)", "Ada Writer"));
  });
});

const CSV = [
  "Barcode,Title,Author,ISBN",
  "1001,The Sky Road,\"Writer, Ada\",9780306406157 (pbk.)",
  "1002,The Sky Road,\"Writer, Ada\",9780306406157 (pbk.)",
  "1003,Deep Water,\"Author, Bo\",",
].join("\n");

describe("readHoldings / matchBook", () => {
  const holdings = readHoldings(CSV);

  it("folds one-row-per-copy exports into copy counts", () => {
    expect(holdings.rows).toHaveLength(2);
    expect(holdings.rows[0]).toMatchObject({ title: "The Sky Road", copies: 2, isbns: ["9780306406157"] });
  });

  it("matches by ISBN-13, by ISBN-10, then by title and surname", () => {
    expect(matchBook(holdings, { title: "Anything", isbn13: "9780306406157" })).toEqual({ status: "owned", copies: 2, via: "isbn" });
    expect(matchBook(holdings, { title: "Anything", isbn10: "0306406152" })).toEqual({ status: "owned", copies: 2, via: "isbn" });
    expect(matchBook(holdings, { title: "Deep Water (Tide, #1)", author: "Bo Author", isbn13: "9780000000000" })).toEqual({ status: "owned", copies: 1, via: "title" });
    expect(matchBook(holdings, { title: "Unknown Book", author: "Cy Nobody" })).toEqual({ status: "missing" });
  });
});
