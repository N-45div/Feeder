// Product coverage only (never the evaluation): tries name variants for universities the plan's strict rule left out, such as
// "University of Michigan-Ann Arbor" -> "University of Michigan". Matches must still be exact on the variant.
// Output: data/cache/resolved-extra.json (gitignored), kept apart from resolved.json so the scored test set never changes.
// Branch campuses that match a different institution (BYU-Idaho to BYU, Penn State Harrisburg to Penn State) are rejected by hand.
// Run: node scripts/resolve-more.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const BASE = env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const OUT = "data/cache/resolved-extra.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();

function variants(name) {
  const base = name.replace(/\s*-\s*(main campus|campus immersion)$/i, "");
  const out = new Set([base]);
  const dash = base.split(/\s*-\s*/);
  if (dash.length === 2) {
    out.add(dash[0]); // University of Michigan-Ann Arbor -> University of Michigan
    out.add(`${dash[0]} ${dash[1]}`); // Indiana University-Bloomington -> Indiana University Bloomington
    out.add(`${dash[0]}, ${dash[1]}`.replace(/ Campus$/, ""));
  }
  if (/^Ohio State University/.test(base)) out.add("The Ohio State University");
  return [...out].filter((v) => v.length >= 8);
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

const strict = JSON.parse(readFileSync("data/cache/resolved.json", "utf8"));
const { universities } = JSON.parse(readFileSync("data/ipeds/universities.json", "utf8"));
const extra = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
for (const u of universities) {
  if (strict[u.unitid]?.entityId || extra[u.unitid]) continue;
  const tries = variants(u.name);
  const wanted = new Set(tries.map(norm));
  let match = null;
  for (const q of tries.slice(0, 3)) {
    match = (await search(q)).find((h) => wanted.has(norm(h.name)));
    await sleep(350);
    if (match) break;
  }
  extra[u.unitid] = match ? { entityId: match.entity_id, qlooName: match.name } : { entityId: null };
  writeFileSync(OUT, JSON.stringify(extra));
}
const found = Object.values(extra).filter((r) => r.entityId).length;
console.log(`extra product matches: ${found} of ${Object.keys(extra).length} tried`);
