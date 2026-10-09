// Resolves every catalogue interest to a Qloo signal and caches the result in data/cache/interests.json
// (gitignored: it holds Qloo output). Run: npx --yes tsx scripts/resolve-interests.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { QlooClient } from "../src/lib/qloo/client";
import { INTERESTS } from "../src/lib/interests/catalog";
import { resolveInterest, type Resolution } from "../src/lib/interests/resolve";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const client = new QlooClient({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_BASE_URL });
const get = (path: string, params: Record<string, unknown>) => client.get<{ results?: unknown }>(path, params as never);

const resolved: Resolution[] = [];
for (const interest of INTERESTS) resolved.push(await resolveInterest(get, interest));

mkdirSync("data/cache", { recursive: true });
writeFileSync("data/cache/interests.json", JSON.stringify(resolved, null, 1));
const missing = resolved.filter((r) => !r.signal);
console.log(`resolved ${resolved.length - missing.length}/${resolved.length}`);
for (const r of missing) console.log(`  unresolved: ${r.interestId}`);
