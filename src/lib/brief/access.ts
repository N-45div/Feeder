// The visit day with its access stop: the top Qloo high schools plus the large low-income public school nearest them (Title I
// schoolwide, or 40%+ free or reduced-price lunch where a state reports no Title I status), from the federal school directory in
// public_high_schools (scripts/public-schools.mjs). Without that table, the day is Qloo's alone.

import { sql } from "../db";
import type { BriefPlace } from "./brief";
import { pickAccess, VISIT_STOPS, visitDay, type AccessSchool, type Stop } from "./route";

/** Schools are searched within this distance of the metro's centre, as the brief's own places are. */
const RADIUS_KM = 40;

async function lowIncomeSchoolsNear(lat: number, lon: number): Promise<AccessSchool[]> {
  const dLat = RADIUS_KM / 111;
  const dLon = RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180));
  return (await sql()`select name, city, lat, lon, enrollment, basis from public_high_schools
    where low_income and lat between ${lat - dLat} and ${lat + dLat} and lon between ${lon - dLon} and ${lon + dLon}`) as AccessSchool[];
}

export async function planVisitDay(cbsa: string, highSchools: BriefPlace[]): Promise<Stop[]> {
  const qloo = visitDay(highSchools, VISIT_STOPS - 1);
  if (!qloo.length) return [];
  const [metro] = (await sql()`select lat, lon from metros where cbsa = ${cbsa}`) as { lat: number; lon: number }[];
  const access = metro
    ? pickAccess(
        await lowIncomeSchoolsNear(metro.lat, metro.lon).catch((error) => {
          console.error("[access] school lookup failed", error);
          return [];
        }),
        qloo,
      )
    : null;
  return visitDay(highSchools, VISIT_STOPS, access);
}
