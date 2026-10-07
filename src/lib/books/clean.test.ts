import { describe, expect, it } from "vitest";
import { authorOf, cleanTitle, isMerch, seriesOf, tidy, type QlooBook } from "./clean";

const book = (name: string, disambiguation = "2020, Ada Writer", series?: string): QlooBook => ({
  entity_id: name,
  name,
  disambiguation,
  properties: series ? { series_name: series } : {},
});

describe("isMerch", () => {
  it.each([
    "The Official Comic Colouring Book",
    "The Story Yearbook",
    "Author Collection 6 Books Set (One, Two, Three)",
    "Comic Series Volume 1-3",
    "Trilogy Boxed Set",
    "A Year of Dragons Calendar",
    "Dream Big Guided Journal",
  ])("flags %s", (title) => expect(isMerch(title)).toBe(true));

  it.each(["The Lightning Thief", "Collected Stories of Courage", "Volume Control", "Field Notes: A Cadet's Journal"])("keeps %s", (title) =>
    expect(isMerch(title)).toBe(false),
  );
});

describe("authorOf / seriesOf / cleanTitle", () => {
  it("reads the author after the year", () => {
    expect(authorOf(book("X", "2019, Holly  Jackson"))).toBe("Holly Jackson");
    expect(authorOf(book("X", "2019"))).toBeNull();
  });

  it("reads the series from the property or the title suffix", () => {
    expect(seriesOf(book("Book", "2020, A", "Sky Saga"))).toBe("Sky Saga");
    expect(seriesOf(book("The Dragon Path (Wing Tales, #15)"))).toBe("Wing Tales");
    expect(seriesOf(book("Standalone"))).toBeNull();
  });

  it("drops the series suffix from titles", () => {
    expect(cleanTitle("The Dragon Path (Wing Tales, #15)")).toBe("The Dragon Path");
    expect(cleanTitle("Four Tales (Divide, #0.1-0.4)")).toBe("Four Tales");
  });
});

describe("tidy", () => {
  it("drops merch, keeps one per series and caps each author", () => {
    const ranked = [
      book("Sky Saga Colouring Book"),
      book("Sky One (Sky Saga, #1)", "2018, Ada Writer"),
      book("Sky Two (Sky Saga, #2)", "2019, Ada Writer"),
      book("Other Story", "2020, Ada Writer"),
      book("Third Story", "2021, Ada Writer"),
      book("Different Voice", "2022, Bo Author"),
    ].map((b) => ({ book: b }));
    expect(tidy(ranked).map((r) => r.book.name)).toEqual(["Sky One (Sky Saga, #1)", "Other Story", "Different Voice"]);
  });
});
