// Builds the four arms in docs/eval-plan.md and matches every title to Seattle's shelves.
// Output: data/cache/eval/seattle-arms.json (gitignored: holds Qloo and LLM book lists). Stats: analysis/seattle_eval.py
// Run: npx --yes tsx analysis/seattle-arms.mts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { QlooClient } from "../src/lib/qloo/client";
import { findBooks, type InterestSignal } from "../src/lib/books/engine";
import { authorOf, cleanTitle } from "../src/lib/books/clean";
import { INTEREST_BY_ID } from "../src/lib/interests/catalog";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
// One key is shared by every script: run evaluations alone, and retry rate limits patiently.
const qloo = new QlooClient({ apiKey: env.QLOO_API_KEY, baseUrl: env.QLOO_BASE_URL, maxAttempts: 6 });
const get = (path: string, params: Record<string, unknown>) => qloo.get<any>(path, params as never);
const CACHE = "data/cache/eval";
mkdirSync(`${CACHE}/llm`, { recursive: true });

// 20 seeds: 10 games, 8 shows, 2 films (fixed in the plan).
const SEEDS = ["minecraft", "roblox", "fortnite", "zelda", "pokemon-games", "among-us", "fnaf", "genshin", "last-of-us", "call-of-duty", "stranger-things", "wednesday", "percy-jackson", "avatar-tla", "heartstopper", "arcane", "demon-slayer", "jujutsu-kaisen", "spider-verse", "hunger-games"];
const resolved: { interestId: string; signal: InterestSignal | null }[] = JSON.parse(readFileSync("data/cache/interests.json", "utf8"));
const signalOf = (id: string) => resolved.find((r) => r.interestId === id)?.signal;

// ---------- Seattle index ----------
const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const normTitle = (t: string) => words(t.split(/\s[/:]\s?|:\s/)[0]).replace(/^(the|a|an) /, "");
const surnameFromCall = (call: string) => words(call.replace(/^(YA|J)(-GN)?\s+/i, "").split(/\s+/)[0] ?? "");
const surnameOf = (author: string | null | undefined) => {
  if (!author) return "";
  const a = author.split(/;| and |,(?=\s*\w+\s*$)/i)[0];
  return words(a.includes(",") ? a.split(",")[0] : a.trim().split(/\s+/).at(-1) ?? "");
};
type Agg = { checkouts: number; copies: number; graphic: boolean; year: number | null };
function index(window: string, shelves: string[]) {
  const rows: { title: string; call: string; shelf: string; collection: string; checkouts: number; copies: number }[] = JSON.parse(readFileSync(`data/raw/seattle-${window}.json`, "utf8"));
  const map = new Map<string, Agg>();
  for (const r of rows) {
    if (!shelves.includes(r.shelf)) continue;
    const key = `${normTitle(r.title)}|${surnameFromCall(r.call)}`;
    const e = map.get(key) ?? { checkouts: 0, copies: 0, graphic: false, year: null };
    e.checkouts += r.checkouts;
    e.copies += r.copies;
    e.graphic ||= /comic|manga/.test(r.collection);
    const y = Number(r.call.match(/\b(19|20)\d{2}\b/)?.[0]);
    if (y) e.year = Math.max(e.year ?? 0, y);
    map.set(key, e);
  }
  return map;
}
const INDEX = {
  teen2025: index("2025", ["teen"]),
  teen2026: index("2026-jan-aug", ["teen"]),
  any2025: index("2025", ["teen", "children"]),
  any2026: index("2026-jan-aug", ["teen", "children"]),
};
function lookup(map: Map<string, Agg>, title: string, author: string | null) {
  const t = normTitle(title);
  const s = surnameOf(author);
  if (!t || !s) return null;
  const exact = map.get(`${t}|${s}`);
  if (exact) return exact;
  // Seattle sometimes prefixes the series ("percy jackson the olympians book one the lightning thief").
  for (const [key, v] of map) {
    const [kt, ks] = key.split("|");
    if (ks === s && t.split(" ").length >= 2 && kt.endsWith(` ${t}`)) return v;
  }
  return null;
}

// ---------- arms ----------
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
async function llmList(label: string, id: string) {
  const file = `${CACHE}/llm/seattle-${id}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as { title: string; author: string | null }[];
  const prompt = `List 20 books for teen readers, published in 2005 or later, that a teen who loves ${label} would enjoy. Return one per line as: Title — Author. No commentary.`;
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.VERCEL_OIDC_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "anthropic/claude-haiku-5.5", temperature: 0, reasoning: { enabled: false }, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text: string = (await res.json()).choices[0].message.content;
  const list = text.split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, "").replace(/\*/g, "").trim()).filter(Boolean).map((l) => {
    const [title, author] = l.split(/\s+[—–-]\s+|\s+by\s+/i);
    return { title: title.replace(/^["“]|["”]$/g, "").trim(), author: author?.trim() ?? null };
  }).slice(0, 20);
  writeFileSync(file, JSON.stringify(list));
  return list;
}

const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const out: any[] = [];
for (const id of SEEDS) {
  const interest = INTEREST_BY_ID.get(id)!;
  const signal = signalOf(id);
  if (!signal) throw new Error(`seed ${id} is unresolved`);
  const pool = await findBooks(get, [{ id, label: interest.label, count: 1, signal }], { perInterest: 50, limit: 50 });
  const asBook = (p: (typeof pool)[number]) => ({ title: cleanTitle(p.book.name), author: authorOf(p.book), popularity: p.book.popularity ?? 0 });
  const books = pool.map(asBook);
  const arms: Record<string, { title: string; author: string | null }[]> = {
    desk: books.slice(0, 20),
    llm: await llmList(interest.label, id),
    popularity: [...books].sort((a, b) => b.popularity - a.popularity).slice(0, 20),
    random: shuffle(books).slice(0, 20),
  };
  for (const [arm, list] of Object.entries(arms)) {
    for (const b of list) {
      out.push({ seed: id, arm, title: b.title, author: b.author, teen2025: lookup(INDEX.teen2025, b.title, b.author), teen2026: lookup(INDEX.teen2026, b.title, b.author), any2025: lookup(INDEX.any2025, b.title, b.author), any2026: lookup(INDEX.any2026, b.title, b.author) });
    }
  }
  console.log(`${id}: pool ${pool.length}, matched teen 2025 -> ${Object.keys(arms).map((a) => `${a} ${out.filter((r) => r.seed === id && r.arm === a && r.teen2025).length}/${arms[a].length}`).join(", ")}`);
}
writeFileSync(`${CACHE}/seattle-arms.json`, JSON.stringify(out));
