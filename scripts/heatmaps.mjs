// Fetches one national Qloo heatmap per resolved university (docs/eval-plan.md, arm 1):
// filter.type=urn:heatmap, signal.interests.entities=<university>, filter.location.query=United States.
// Output: data/cache/heatmaps/<unitid>.json (gitignored: Qloo output). Resumable. Run: node scripts/heatmaps.mjs
// --young adds signal.demographics.age=24_and_younger (amendment 2) and writes to data/cache/heatmaps-young/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const BASE = env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
const YOUNG = process.argv.includes("--young");
const OUT = YOUNG ? "data/cache/heatmaps-young" : "data/cache/heatmaps";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

async function heatmap(entityId) {
  const params = { "filter.type": "urn:heatmap", "signal.interests.entities": entityId, "filter.location.query": "United States", ...(YOUNG ? { "signal.demographics.age": "24_and_younger" } : {}) };
  const url = `${BASE}/v2/insights?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "X-Api-Key": env.QLOO_API_KEY } });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`heatmap ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).results?.heatmap ?? [];
  }
  throw new Error("heatmap kept failing");
}

// The evaluation's strict matches plus product-only matches (scripts/resolve-more.mjs).
const resolved = { ...JSON.parse(readFileSync("data/cache/resolved.json", "utf8")), ...(existsSync("data/cache/resolved-extra.json") ? Object.fromEntries(Object.entries(JSON.parse(readFileSync("data/cache/resolved-extra.json", "utf8"))).filter(([, r]) => r.entityId)) : {}) };
const todo = Object.entries(resolved).filter(([id, r]) => r.entityId && !existsSync(`${OUT}/${id}.json`));
let next = 0, failed = 0;
async function worker() {
  while (next < todo.length) {
    const [id, r] = todo[next++];
    try {
      const cells = await heatmap(r.entityId);
      // Keep only what scoring reads: geohash, affinity, popularity.
      writeFileSync(`${OUT}/${id}.json`, JSON.stringify(cells.map((c) => [c.location.geohash, c.query.affinity, c.query.popularity])));
    } catch (error) {
      failed++;
      console.log(`${r.qlooName}: ${error.message}`);
    }
    await sleep(400);
  }
}
await Promise.all([worker(), worker()]);
console.log(`heatmaps fetched ${todo.length - failed}, failed ${failed}`);
