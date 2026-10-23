// Loads data/raw/public-high-schools.json (scripts/public-schools.mjs) into Postgres. Safe to re-run: every row is an upsert.
// Run: npx --yes tsx scripts/load-schools.mts
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));
const sql = neon(env.DATABASE_URL);
const schema = readFileSync("db/schema.sql", "utf8");
const table = schema.slice(schema.indexOf("create table if not exists public_high_schools"), schema.indexOf("-- Live audience questions"));
for (const statement of table.split(";").map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean)) await sql.query(statement);

const schools = JSON.parse(readFileSync("data/raw/public-high-schools.json", "utf8")) as { ncessch: string; name: string; city: string; state: string; lat: number; lon: number; cbsa: string | null; enrollment: number | null; lowIncome: boolean; basis: string }[];
// Some states file names in capitals ("BROOKLYN HIGH SCHOOL OF THE ARTS"); show them as names, keeping short words lowercase.
const SMALL = new Set(["of", "the", "for", "and", "at", "in", "on", "a", "an", "de", "la", "del"]);
const tidy = (name: string | null) =>
  name && name === name.toUpperCase() && /[A-Z]{3}/.test(name)
    ? name.toLowerCase().replace(/[a-z][a-z'.]*/g, (w, i: number) => (i > 0 && SMALL.has(w) ? w : w[0].toUpperCase() + w.slice(1)))
    : name;
for (const s of schools) {
  s.name = tidy(s.name)!;
  s.city = tidy(s.city)!;
}

for (let i = 0; i < schools.length; i += 2000) {
  const batch = schools.slice(i, i + 2000).map((s) => ({ ...s, low_income: s.lowIncome }));
  await sql.query(
    `insert into public_high_schools (ncessch, name, city, state, lat, lon, cbsa, enrollment, low_income, basis)
     select ncessch, name, city, state, lat, lon, cbsa, enrollment, low_income, basis
     from jsonb_to_recordset($1::jsonb) as x(ncessch text, name text, city text, state text, lat double precision, lon double precision, cbsa text, enrollment integer, low_income boolean, basis text)
     on conflict (ncessch) do update set name = excluded.name, city = excluded.city, state = excluded.state, lat = excluded.lat, lon = excluded.lon,
       cbsa = excluded.cbsa, enrollment = excluded.enrollment, low_income = excluded.low_income, basis = excluded.basis`,
    [JSON.stringify(batch)],
  );
  console.log(`${Math.min(i + 2000, schools.length)} of ${schools.length}`);
}
