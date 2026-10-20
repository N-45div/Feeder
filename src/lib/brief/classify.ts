// Sorts the places Qloo ranks near a metro for a university's audience into what a recruiter can use. Qloo gives schools no
// place tags, so names decide: high schools to visit, other colleges (rivals for the same students), and everything else.

export type PlaceKind = "high_school" | "college" | "other";

const HIGH_SCHOOL = /\b(high school|preparatory|prep|academy|secondary school|middle and high school|charter school|catholic high|jesuit high|day school)\b/i;
const COLLEGE = /\b(college|university|universidad|institute of technology|community college|polytechnic|school of (law|medicine|business|nursing))\b/i;
// Parts of a university (a business school, an athletics venue) aren't separate colleges.
const PART = /\b(stadium|arena|field|hall|library|museum|collection|gallery|center for|centre for|department of)\b/i;

// "The Athenian School" is a high school; "Alonzo King LINES Ballet School" and "Haas School of Business" are not.
const ENDS_SCHOOL = /\bschool$/i;
const NOT_HIGH_SCHOOL = /\b(dance|ballet|music|art|arts|driving|montessori|elementary|preschool|language|cooking|culinary|surf|flight|yoga|beauty|swim|martial|kindergarten|nursery|graduate|law|medical|medicine|business|nursing|dental|divinity)\b/i;

export function placeKind(name: string): PlaceKind {
  const trimmed = name.trim();
  const collegiate = /\bcollege\b|\buniversity\b/i.test(trimmed);
  if (!collegiate && (HIGH_SCHOOL.test(trimmed) || (ENDS_SCHOOL.test(trimmed) && !NOT_HIGH_SCHOOL.test(trimmed)))) return "high_school";
  if (COLLEGE.test(name) && !PART.test(name)) return "college";
  return "other";
}

/** True when a place is the university itself or one of its parts (its business school, its campus). */
export function isOwnPlace(place: string, university: string): boolean {
  const core = university.toLowerCase().replace(/^the /, "").replace(/\s*-.*$/, "").trim();
  return place.toLowerCase().includes(core);
}
