// Pulls Seattle Public Library teen-shelf (collection codes "ny...") and children's-shelf ("nc...") checkout
// aggregates per title: checkouts and distinct copies, for 2025 and January-August 2026.
// Source: data.seattle.gov "Checkouts By Title (Physical Items)" (public domain). No patron data exists in it.
// Output: data/raw/seattle-<window>.json (gitignored). Run: node scripts/seattle-checkouts.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const WINDOWS = { 2025: ["2025-01-01T00:00:00", "2025-12-31T23:59:59"], "2026-jan-aug": ["2026-01-01T00:00:00", "2026-08-31T23:59:59"] };
const PAGE = 50000;

async function pull(from, to) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      $select: "itemtitle,callnumber,collection,count(*) as checkouts,count(distinct itembarcode) as copies",
      $where: `(collection like 'ny%' OR collection like 'nc%') AND checkoutdatetime between '${from}' and '${to}'`,
      $group: "itemtitle,callnumber,collection",
      $order: "itemtitle,callnumber,collection",
      $limit: String(PAGE),
      $offset: String(offset),
    });
    const res = await fetch(`https://data.seattle.gov/resource/5src-czff.json?${params}`);
    if (!res.ok) throw new Error(`Seattle open data ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    rows.push(...page.map((r) => ({ title: r.itemtitle, call: r.callnumber ?? "", shelf: r.collection.startsWith("ny") ? "teen" : "children", collection: r.collection, checkouts: Number(r.checkouts), copies: Number(r.copies) })));
    if (page.length < PAGE) break;
  }
  return rows;
}

mkdirSync("data/raw", { recursive: true });
for (const [name, [from, to]] of Object.entries(WINDOWS)) {
  const rows = await pull(from, to);
  writeFileSync(`data/raw/seattle-${name}.json`, JSON.stringify(rows));
  const teen = rows.filter((r) => r.shelf === "teen");
  console.log(`${name}: ${rows.length} title rows (${teen.length} teen, ${teen.reduce((s, r) => s + r.checkouts, 0)} teen checkouts)`);
}
