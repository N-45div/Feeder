import { describe, expect, it } from "vitest";
import { isbn10to13, isbnsIn, isValidIsbn10, isValidIsbn13, toIsbn13 } from "./isbn";

describe("checksums", () => {
  it("validates ISBN-13 and ISBN-10", () => {
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
    expect(isValidIsbn10("0306406152")).toBe(true);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(isValidIsbn10("0306406153")).toBe(false);
  });

  it("converts ISBN-10 to ISBN-13", () => {
    expect(isbn10to13("0306406152")).toBe("9780306406157");
  });
});

describe("toIsbn13", () => {
  it("normalises punctuation and rejects bad digits", () => {
    expect(toIsbn13("978-0-306-40615-7")).toBe("9780306406157");
    expect(toIsbn13("0-306-40615-2")).toBe("9780306406157");
    expect(toIsbn13("978-0-306-40615-8")).toBeNull();
    expect(toIsbn13("")).toBeNull();
  });
});

describe("isbnsIn", () => {
  it("pulls every valid ISBN out of a messy catalogue cell", () => {
    expect(isbnsIn("9780306406157 (pbk.) ; 080442957X (hbk.)")).toEqual(["9780306406157", "9780804429573"]);
    expect(isbnsIn("978-0-306-40615-7 | 978-0-306-40615-7")).toEqual(["9780306406157"]);
    expect(isbnsIn("no isbn here 12345")).toEqual([]);
  });
});
