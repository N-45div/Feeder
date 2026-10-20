// Resolves each qualifying university to a Qloo brand entity by the rule in docs/eval-plan.md: the entity's name must match
// the IPEDS name or one of its IPEDS aliases, ignoring case, a leading "The", punctuation and a trailing campus label.
// Output: data/cache/resolved.json (gitignored: Qloo output). Run: node scripts/resolve.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const BASE = env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const OUT = "data/cache/resolved.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ten pilot universities are excluded from the test (docs/eval-plan.md); they stay in the product.
export const PILOT = new Set([100751, 170976, 123961, 104151, 209551, 217882, 196413, 164988, 126614, 176017]);

const CAMPUS = /\s*(-|–|,)?\s*(main campus|campus immersion)\s*$/i;
export function norm(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(CAMPUS, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the /, "")
    .trim();
}

async function search(query) {
  const url = `${BASE}/search?${new URLSearchParams({ query, types: "urn:entity:brand", take: "10" })}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "X-Api-Key": env.QLOO_API_KEY } });
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`search ${res.status}`);
    return (await res.json()).results ?? [];
  }
  throw new Error("search kept failing");
}

const { universities } = JSON.parse(readFileSync("data/ipeds/universities.json", "utf8"));
mkdirSync("data/cache", { recursive: true });
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
for (const u of universities) {
  if (done[u.unitid]) continue;
  const names = [u.name, ...u.aliases.filter((a) => a.length >= 4)];
  const wanted = new Set(names.map(norm));
  let match = null;
  for (const query of [u.name.replace(CAMPUS, ""), ...u.aliases.filter((a) => a.length >= 4)].slice(0, 3)) {
    const hits = await search(query);
    match = hits.find((h) => wanted.has(norm(h.name)));
    await sleep(350);
    if (match) break;
  }
  done[u.unitid] = match ? { entityId: match.entity_id, qlooName: match.name, pilot: PILOT.has(u.unitid) } : { entityId: null, pilot: PILOT.has(u.unitid) };
  writeFileSync(OUT, JSON.stringify(done));
}
const all = Object.values(done);
const resolved = all.filter((r) => r.entityId);
console.log(`resolved ${resolved.length} of ${all.length}; test set (resolved, not pilot): ${resolved.filter((r) => !r.pilot).length}`);
