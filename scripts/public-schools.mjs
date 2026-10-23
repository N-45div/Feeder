// Public high schools from the federal Common Core of Data (NCES, public domain), through the Urban Institute's Education Data API:
// location, metro (cbsa), enrollment, and whether the school serves mostly low-income students. Feeds the visit day's access
// stop (src/lib/brief/route.ts). Kept: open, regular, non-virtual schools that offer grade 12.
// Low income means Title I schoolwide in the 2021 directory (the latest year with Title I filled in). A state that reports no
// Title I status that year (California) falls back to the 2022 directory: at least 40% of students eligible for free or
// reduced-price lunch, the same 40% that qualifies a school for a schoolwide Title I programme.
// Output: data/raw/public-high-schools.json (gitignored). Run: node scripts/public-schools.mjs, then npx tsx scripts/load-schools.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OPEN = new Set([1, 3, 4, 5, 8]); // open, new, added, changed agency, reopened
const LUNCH_SHARE = 0.4;

async function directory(year, fips) {
  const rows = [];
  let url = `https://educationdata.urban.org/api/v1/schools/ccd/directory/${year}/?school_level=3&fips=${fips}`;
  while (url) {
    let body;
    for (let attempt = 0; attempt < 5 && !body; attempt++) {
      // The API turns away requests without a User-Agent.
      const res = await fetch(url, { headers: { "User-Agent": "Feeder/1.0 (public data loader)" }, signal: AbortSignal.timeout(180_000) }).catch(() => null);
      if (res?.ok) body = await res.json();
      else await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
    if (!body) throw new Error(`gave up on ${url}`);
    rows.push(...body.results);
    url = body.next;
  }
  return rows;
}

// One state at a time: the whole country in one request times out.
const fips = JSON.parse(readFileSync("data/geo/states.json", "utf8")).states.map((s) => s.fips);
const kept = [];
for (const f of fips) {
  const rows = (await directory(2021, f)).filter((s) => OPEN.has(s.school_status) && s.school_type === 1 && s.virtual !== 1 && s.highest_grade_offered >= 12 && s.latitude != null && s.longitude != null);
  const reportsTitleI = rows.some((s) => s.title_i_schoolwide === 0 || s.title_i_schoolwide === 1);
  let lunch = new Map();
  if (!reportsTitleI) {
    lunch = new Map((await directory(2022, f)).filter((s) => s.enrollment > 0 && s.free_or_reduced_price_lunch >= 0).map((s) => [String(s.ncessch), s.free_or_reduced_price_lunch / s.enrollment]));
  }
  for (const s of rows) {
    const share = lunch.get(String(s.ncessch));
    kept.push({
      ncessch: String(s.ncessch),
      name: s.school_name,
      city: s.city_location,
      state: s.state_location,
      lat: s.latitude,
      lon: s.longitude,
      cbsa: s.cbsa != null && s.cbsa > 0 ? String(s.cbsa).padStart(5, "0") : null,
      enrollment: s.enrollment != null && s.enrollment >= 0 ? s.enrollment : null,
      lowIncome: reportsTitleI ? s.title_i_schoolwide === 1 : share != null && share >= LUNCH_SHARE,
      basis: reportsTitleI ? "title_i" : "lunch",
    });
  }
  console.log(`state ${f}: ${rows.length} kept${reportsTitleI ? "" : " (no Title I reported: lunch share used)"}`);
}
mkdirSync("data/raw", { recursive: true });
writeFileSync("data/raw/public-high-schools.json", JSON.stringify(kept));
console.log(`kept ${kept.length}; low income ${kept.filter((s) => s.lowIncome).length} (by lunch share ${kept.filter((s) => s.lowIncome && s.basis === "lunch").length})`);
