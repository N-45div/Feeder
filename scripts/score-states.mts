// Turns each cached national heatmap into per-state pull (src/lib/score/pull.ts).
// Output: data/cache/state-pulls.json (gitignored: derived from Qloo output). Run: npx --yes tsx scripts/score-states.mts
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { shapesFrom } from "../src/lib/geo/geo";
import { statePull, type Cell } from "../src/lib/score/pull";

const shapes = shapesFrom(JSON.parse(readFileSync("data/geo/us-states.geojson", "utf8")));
const out: Record<string, Record<string, { pull: number; meanAffinity: number; cells: number }>> = {};
const dir = "data/cache/heatmaps";
for (const file of existsSync(dir) ? readdirSync(dir) : []) {
  const cells: Cell[] = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  const pulls = statePull(cells, shapes);
  out[file.replace(".json", "")] = Object.fromEntries([...pulls].map(([state, p]) => [state, { pull: p.pull, meanAffinity: p.meanAffinity, cells: p.cells }]));
}
writeFileSync("data/cache/state-pulls.json", JSON.stringify(out));
console.log(`scored ${Object.keys(out).length} universities`);
