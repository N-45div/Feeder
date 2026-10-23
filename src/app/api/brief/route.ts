import { getBrief } from "@/lib/brief/brief";
import { getMetroEvents, type MetroEvents } from "@/lib/brief/events";
import { planVisitDay } from "@/lib/brief/access";
import { mapsRoute } from "@/lib/brief/route";
import { sql } from "@/lib/db";
import { LIMITS, perAddress, take } from "@/lib/limits";

export const maxDuration = 60;

/** GET /api/brief?u=<unitid>&cbsa=<metro>: a metro brief, from the cache or fetched from Qloo once and kept. */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const unitid = Number(url.searchParams.get("u"));
  const cbsa = url.searchParams.get("cbsa") ?? "";
  if (!Number.isInteger(unitid) || unitid <= 0 || !/^\d{5}$/.test(cbsa)) return Response.json({ error: "Send u (a university id) and cbsa (a metro code)." }, { status: 400 });
  if (!(await take(perAddress("brief", request.headers), LIMITS.briefPerAddress))) return Response.json({ error: `This demo opens ${LIMITS.briefPerAddress} briefs per visitor per day.` }, { status: 429 });

  const [cached] = (await sql()`select 1 from metro_briefs where unitid = ${unitid} and cbsa = ${cbsa}`) as unknown[];
  if (!cached && !(await take("brief:fresh", LIMITS.freshBriefsPerDay))) {
    return Response.json({ error: "Today's budget for new briefs is used up; briefs already opened still work." }, { status: 429 });
  }
  try {
    const [brief, events] = await Promise.all([
      getBrief(unitid, cbsa),
      // Events are extra: a SerpApi failure leaves the brief intact.
      getMetroEvents(cbsa).catch((error): MetroEvents => {
        console.error("[events] failed", error);
        return { events: [], fetchedAt: null, status: "error" };
      }),
    ]);
    if (!brief) return Response.json({ error: "No such university or metro." }, { status: 404 });
    const stops = await planVisitDay(cbsa, brief.highSchools);
    return Response.json({ ...brief, events, visit: { stops, mapsUrl: mapsRoute(stops) } }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (error) {
    console.error("[brief] failed", error);
    return Response.json({ error: "Qloo didn't answer in time. Try this metro again in a moment." }, { status: 502 });
  }
}
