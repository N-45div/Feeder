// The assistant-only arm (docs/eval-plan.md, arm 3): Claude Haiku 5.5, given only the university's name, ranks every state
// except the home state by how many out-of-state first-time freshmen the university draws from it. No tools, no data.
// Output: data/cache/assistant/<unitid>.json (gitignored). Resumable. Run: node analysis/assistant-arm.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const OUT = "data/cache/assistant";
mkdirSync(OUT, { recursive: true });
const { universities } = JSON.parse(readFileSync("data/ipeds/universities.json", "utf8"));
const { states } = JSON.parse(readFileSync("data/geo/states.json", "utf8"));
const resolved = JSON.parse(readFileSync("data/cache/resolved.json", "utf8"));
const names = new Set(states.map((s) => s.name));

async function rank(u) {
  const others = states.filter((s) => s.name !== u.state).map((s) => s.name);
  const prompt = [
    `${u.name} is in ${u.city}, ${u.state}.`,
    `Rank these ${others.length} states (including DC) by how many first-time freshmen ${u.name} enrolls from each, most first.`,
    "Use only what you already know. Answer with the state names only, one per line, every state exactly once, nothing else.",
    "",
    ...others,
  ].join("\n");
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.VERCEL_OIDC_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "anthropic/claude-haiku-5.5", reasoning: { enabled: false }, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const text = (await res.json()).choices[0].message.content ?? "";
    const seen = new Set();
    const order = text.split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter((l) => names.has(l) && l !== u.state && !seen.has(l) && seen.add(l));
    if (order.length >= others.length - 3) return order;
  }
  throw new Error(`incomplete ranking for ${u.name}`);
}

let done = 0;
for (const u of universities) {
  const r = resolved[u.unitid];
  if (!r?.entityId || r.pilot || existsSync(`${OUT}/${u.unitid}.json`)) continue;
  writeFileSync(`${OUT}/${u.unitid}.json`, JSON.stringify({ model: "anthropic/claude-haiku-5.5", order: await rank(u) }));
  done++;
}
console.log(`assistant rankings written: ${done}`);
