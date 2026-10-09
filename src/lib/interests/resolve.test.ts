import { describe, expect, it } from "vitest";
import type { Interest } from "./catalog";
import { coverage, resolveInterest } from "./resolve";

const game: Interest = { id: "g", label: "Skyfarm", category: "games", entityType: "urn:entity:videogame", query: "Skyfarm Adventures" };
const topic: Interest = { id: "t", label: "Dragons", category: "topics", tagQuery: "dragons" };

const fake = (results: unknown) => async () => ({ results });

describe("coverage", () => {
  it("measures how many query words the name contains", () => {
    expect(coverage("Skyfarm Adventures", "Skyfarm Adventures: Deluxe")).toBe(1);
    expect(coverage("Skyfarm Adventures", "Skyfarm")).toBe(0.5);
    expect(coverage("Pokémon GO", "Pokemon GO")).toBe(1);
  });
});

describe("resolveInterest", () => {
  it("takes the first search hit whose name covers the query", async () => {
    const r = await resolveInterest(fake([{ entity_id: "wrong", name: "Starbound Farm" }, { entity_id: "right", name: "Skyfarm Adventures" }]), game);
    expect(r).toEqual({ interestId: "g", signal: { entityId: "right" }, matched: "Skyfarm Adventures" });
  });

  it("refuses near-misses instead of guessing", async () => {
    const r = await resolveInterest(fake([{ entity_id: "x", name: "Sky Kingdom" }]), game);
    expect(r.signal).toBeNull();
  });

  it("rejects candidates that only contain the query inside a longer phrase", async () => {
    const tags = { tags: [{ id: "urn:tag:genre:media:beauty_beast", name: "Beauty and the beast" }] };
    const beauty: Interest = { id: "b", label: "Beauty", category: "topics", tagQuery: "beauty" };
    expect((await resolveInterest(fake(tags), beauty)).signal).toBeNull();
  });

  it("prefers an exact name over an earlier, longer hit", async () => {
    const r = await resolveInterest(fake([{ entity_id: "spin", name: "Skyfarm Adventures Kart Racing Deluxe" }, { entity_id: "main", name: "Skyfarm Adventures" }]), game);
    expect(r.signal).toEqual({ entityId: "main" });
  });

  it("prefers book genre tags, then keyword tags", async () => {
    const tags = { tags: [{ id: "urn:tag:keyword:media:dragons", name: "Dragons" }, { id: "urn:tag:genre:media:dragons", name: "Dragons" }] };
    expect((await resolveInterest(fake(tags), topic)).signal).toEqual({ tagId: "urn:tag:genre:media:dragons" });
    const keywordOnly = { tags: [{ id: "urn:tag:keyword:media:dragons", name: "Dragons" }] };
    expect((await resolveInterest(fake(keywordOnly), topic)).signal).toEqual({ tagId: "urn:tag:keyword:media:dragons" });
  });
});
