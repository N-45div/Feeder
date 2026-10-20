// Builds Feeder's public-domain data from source files, following docs/eval-plan.md:
//   data/geo/states.json            50 states + DC: 2020 census population and population centre (Census Bureau)
//   data/ipeds/universities.json    four-year, degree-granting, >= 1,000 first-time students in Fall 2022, >= 20% from out of state
//   data/ipeds/residence.json       for those universities: first-time students from each state, Fall 2022 and Fall 2020
// Sources are downloaded into data/raw (gitignored). Run: node scripts/build-data.mjs
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const RAW = "data/raw";
const SOURCES = {
  "EF2022C.zip": "https://nces.ed.gov/ipeds/datacenter/data/EF2022C.zip",
  "EF2020C.zip": "https://nces.ed.gov/ipeds/datacenter/data/EF2020C.zip",
  "HD2024.zip": "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
  "CenPop2020_Mean_ST.txt": "https://www2.census.gov/geo/docs/reference/cenpop2020/CenPop2020_Mean_ST.txt",
};
mkdirSync(RAW, { recursive: true });
for (const [file, url] of Object.entries(SOURCES)) {
  if (existsSync(`${RAW}/${file}`)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  writeFileSync(`${RAW}/${file}`, Buffer.from(await res.arrayBuffer()));
  if (file.endsWith(".zip")) execSync(`unzip -o -q ${RAW}/${file} -d ${RAW}/${file.slice(0, -4)}`);
}

/** Minimal CSV reader for IPEDS files: quoted fields, no embedded newlines. */
function csv(path) {
  const lines = readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const split = (line) => {
    const out = [];
    let cur = "", quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
const file = (dir, pick) => `${RAW}/${dir}/${readdirSync(`${RAW}/${dir}`).find(pick)}`;

// ---- states
const states = csv(`${RAW}/CenPop2020_Mean_ST.txt`)
  .filter((r) => Number(r.STATEFP) <= 56 && r.STNAME !== "Puerto Rico")
  .map((r) => ({ fips: Number(r.STATEFP), name: r.STNAME, pop2020: Number(r.POPULATION), lat: Number(r.LATITUDE), lon: Number(r.LONGITUDE) }));
const byFips = new Map(states.map((s) => [s.fips, s]));
mkdirSync("data/geo", { recursive: true });
writeFileSync("data/geo/states.json", JSON.stringify({ source: "US Census Bureau, 2020 Census centers of population by state", states }, null, 1) + "\n");

// ---- residence: EFCSTATE is a state FIPS code; 99 is the total of all first-time students.
function residence(dir) {
  const rows = csv(file(dir, (f) => /_rv\.csv$/i.test(f)) );
  const out = new Map();
  for (const r of rows) {
    const id = Number(r.UNITID), code = Number(r.EFCSTATE), n = Number(r.EFRES01);
    if (!Number.isFinite(n)) continue;
    const entry = out.get(id) ?? { total: 0, states: {} };
    if (code === 99) entry.total = n;
    else if (byFips.has(code)) entry.states[code] = n;
    out.set(id, entry);
  }
  return out;
}
const r2022 = residence("EF2022C");
const r2020 = residence("EF2020C");

// ---- universities, by the pre-registered rule
const universities = [];
for (const h of csv(file("HD2024", (f) => /\.csv$/i.test(f)))) {
  const id = Number(h.UNITID), fips = Number(h.FIPS);
  if (h.ICLEVEL !== "1" || h.DEGGRANT !== "1" || !byFips.has(fips)) continue;
  const r = r2022.get(id);
  if (!r || r.total < 1000) continue;
  const home = r.states[fips] ?? 0;
  const outShare = (r.total - home) / r.total;
  if (outShare < 0.2) continue;
  universities.push({
    unitid: id,
    name: h.INSTNM,
    aliases: h.IALIAS ? h.IALIAS.split("|").map((a) => a.trim()).filter((a) => a && a !== " ") : [],
    city: h.CITY,
    state: byFips.get(fips).name,
    stateFips: fips,
    lat: Number(h.LATITUDE),
    lon: Number(h.LONGITUD),
    website: h.WEBADDR || null,
    control: { 1: "public", 2: "private nonprofit", 3: "private for-profit" }[h.CONTROL] ?? null,
    firstTime2022: r.total,
    outOfStateShare2022: Math.round(outShare * 1000) / 1000,
  });
}
universities.sort((a, b) => b.firstTime2022 - a.firstTime2022);
const ids = new Set(universities.map((u) => u.unitid));
const pick = (m) => Object.fromEntries([...m].filter(([id]) => ids.has(id)).map(([id, r]) => [id, { total: r.total, states: r.states }]));
mkdirSync("data/ipeds", { recursive: true });
writeFileSync("data/ipeds/universities.json", JSON.stringify({ source: "IPEDS HD2024 and EF2022C (NCES), public domain", rule: "docs/eval-plan.md", universities }) + "\n");
writeFileSync("data/ipeds/residence.json", JSON.stringify({ source: "IPEDS EF2022C and EF2020C revised files, EFRES01 by state FIPS", fall2022: pick(r2022), fall2020: pick(r2020) }) + "\n");
// ---- metros: metropolitan areas of 250,000+ people (2025 estimate), with their internal point, for recruiter travel
if (!existsSync(`${RAW}/gaz_cbsa`)) {
  writeFileSync(`${RAW}/gaz_cbsa.zip`, Buffer.from(await (await fetch("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_cbsa_national.zip")).arrayBuffer()));
  execSync(`unzip -o -q ${RAW}/gaz_cbsa.zip -d ${RAW}/gaz_cbsa`);
}
if (!existsSync(`${RAW}/cbsa-est2025-alldata.csv`)) {
  writeFileSync(`${RAW}/cbsa-est2025-alldata.csv`, Buffer.from(await (await fetch("https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/metro/totals/cbsa-est2025-alldata.csv")).arrayBuffer()));
}
const gaz = readFileSync(file("gaz_cbsa", (f) => f.endsWith(".txt")), "utf8").split(/\r?\n/).filter(Boolean).map((l) => l.split("\t").map((v) => v.trim()));
const gazHead = gaz[0];
const point = new Map(gaz.slice(1).map((r) => {
  const row = Object.fromEntries(gazHead.map((h, i) => [h, r[i]]));
  return [row.GEOID, { type: row.CBSA_TYPE, lat: Number(row.INTPTLAT), lon: Number(row.INTPTLONG) }];
}));
// The population file is Latin-1 (place names like Cañon City).
const popText = new TextDecoder("latin1").decode(readFileSync(`${RAW}/cbsa-est2025-alldata.csv`));
const popLines = popText.split(/\r?\n/).filter(Boolean);
const popHead = popLines[0].split(",");
const metros = [];
for (const line of popLines.slice(1)) {
  // NAME is quoted and contains commas ("Abilene, TX"); the fields before it are plain.
  const m = /^(\d+),(\d*),(\d*),"([^"]+)",([^,]+),(.*)$/.exec(line);
  if (!m || m[2] || m[3] || m[5] !== "Metropolitan Statistical Area") continue;
  const rest = m[6].split(",");
  const pop = Number(rest[popHead.indexOf("POPESTIMATE2025") - 5]);
  const p = point.get(m[1]);
  if (!p || pop < 250000) continue;
  const [city, st] = m[4].split(/,\s*/);
  metros.push({ cbsa: m[1], name: m[4], city: city.split("-")[0], states: st.split("-"), pop2025: pop, lat: p.lat, lon: p.lon });
}
metros.sort((a, b) => b.pop2025 - a.pop2025);
writeFileSync("data/geo/metros.json", JSON.stringify({ source: "US Census Bureau: 2023 Gazetteer (CBSA internal points) and Vintage 2025 metro population estimates", metros }, null, 1) + "\n");
console.log(`${states.length} states; ${metros.length} metros; ${universities.length} universities qualify (of ${r2022.size} reporting Fall 2022 residence)`);
