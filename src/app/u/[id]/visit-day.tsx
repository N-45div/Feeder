"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { MetroEvents } from "@/lib/brief/events";
import type { Stop } from "@/lib/brief/route";

export interface VisitPlan {
  stops: Stop[];
  mapsUrl: string | null;
}

// OpenFreeMap: OpenStreetMap vector tiles with no key. Positron is the quiet light style, so the pins carry the colour.
const STYLE = "https://tiles.openfreemap.org/styles/positron";

/** The day's stops on a street map, numbered in driving order with the legs drawn between them. */
function StopMap({ stops, metro }: { stops: Stop[]; metro: string }) {
  const box = useRef<HTMLElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let gone = false;
    import("maplibre-gl")
      .then(({ default: maplibregl }) => {
        if (gone || !box.current) return;
        const lons = stops.map((s) => s.lon);
        const lats = stops.map((s) => s.lat);
        const bounds: [number, number, number, number] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        // Room for the pins themselves and the zoom buttons (top right). The map credit sits in the caption, clear of the pins.
        const fit = { padding: { top: 48, right: 60, bottom: 40, left: 40 }, maxZoom: 13 };
        map = new maplibregl.Map({ container: box.current, style: STYLE, bounds, fitBoundsOptions: fit, cooperativeGestures: true, attributionControl: false });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        // The box can still grow after the map starts (fonts settling the column beside it): keep the day framed until someone moves the map.
        let moved = false;
        map.on("movestart", (e) => {
          if (e.originalEvent) moved = true;
        });
        map.on("resize", () => {
          if (!moved) map!.fitBounds(bounds, { ...fit, duration: 0 });
        });
        stops.forEach((s, i) => {
          const pin = document.createElement("div");
          pin.className = s.access ? "visit-pin access" : i === 0 ? "visit-pin first" : "visit-pin";
          pin.textContent = String(i + 1);
          pin.title = s.name;
          new maplibregl.Marker({ element: pin })
            .setLngLat([s.lon, s.lat])
            .setPopup(new maplibregl.Popup({ offset: 18, closeButton: false }).setText(`${i + 1}. ${s.name}`))
            .addTo(map!);
        });
        // On style load, not "load": the route shouldn't wait for every tile.
        map.once("style.load", () => {
          map!.addSource("day", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops.map((s) => [s.lon, s.lat]) } } });
          map!.addLayer({ id: "day", type: "line", source: "day", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1a1530", "line-width": 2.5, "line-dasharray": [1.5, 1.5] } });
        });
      })
      // No WebGL here (or the tiles didn't load): the numbered list below still carries the day.
      .catch(() => setFailed(true));
    return () => {
      gone = true;
      map?.remove();
    };
  }, [stops]);

  if (failed) return <p className="grid h-full place-items-center p-4 text-center text-sm text-muted">The map couldn&apos;t load here; the stops are listed in order.</p>;
  return <section ref={box} className="h-full w-full" aria-label={`Street map of the visit day in ${metro}`} />;
}

function fairsNote(events: MetroEvents, metro: string): string | null {
  if (events.status === "off") return "Fair search isn't connected in this copy of Feeder.";
  if (events.status === "budget") return "This month's fair searches are used up; metros already searched still show theirs.";
  if (!events.events.length) return `No upcoming college fairs near ${metro} on Google Events.`;
  return null;
}

export function VisitDay({ plan, events, metro }: { plan: VisitPlan; events: MetroEvents; metro: string }) {
  const note = fairsNote(events, metro);
  return (
    <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <figure className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-quiet">
        {plan.stops.length ? (
          <>
            <div className="h-72 sm:h-80 lg:h-auto lg:min-h-80 lg:flex-1">
              <StopMap stops={plan.stops} metro={metro} />
            </div>
            <figcaption className="border-t-[1.5px] border-ink bg-surface px-3 py-1.5 text-[11px] text-muted">
              Map ©{" "}
              <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer" className="underline">OpenFreeMap</a>,{" "}
              <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer" className="underline">OpenMapTiles</a>,{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>
            </figcaption>
          </>
        ) : (
          <p className="grid h-40 place-items-center p-4 text-center text-sm text-muted">Qloo gave no locations for these high schools, so there is no day to map.</p>
        )}
      </figure>

      <div className="flex flex-col gap-3.5">
        <div className="rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3.5">
          <p className="text-xs font-bold tracking-[0.12em]">A VISIT DAY</p>
          {plan.stops.length > 0 && (
            <ol className="mt-2.5 space-y-2">
              {plan.stops.map((s, i) => (
                <li key={s.name} className="flex items-start gap-2.5 text-[15px]">
                  <span className={`figure grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${s.access ? "bg-teal" : i === 0 ? "bg-pennant" : "bg-ink"}`}>{i + 1}</span>
                  <span>
                    {s.name}
                    {s.access && <span className="ml-1.5 rounded-full bg-teal-soft px-2 py-0.5 align-middle text-[11px] font-bold text-teal">ACCESS STOP</span>}
                    <span className="block text-xs text-muted">
                      {s.access
                        ? `${s.access.basis === "title_i" ? "Title I public school" : "Public school, 40%+ low-income"}${s.access.enrollment ? ` · ${s.access.enrollment.toLocaleString("en-US")} students` : ""}`
                        : `Qloo rank ${s.rank}`}{" "}
                      · {i === 0 ? "start here" : `${s.legKm} km from stop ${i}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {plan.mapsUrl && (
            <a
              href={plan.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="press card-sm mt-3.5 inline-flex min-h-11 items-center gap-2 rounded-full bg-pennant px-4 text-sm font-bold text-ink"
            >
              Open the day in Google Maps <span aria-hidden="true">↗</span>
            </a>
          )}
          <p className="mt-2 text-xs text-muted">Nearest school next, from the top-ranked one. Straight-line km; Google Maps gives the drive times.</p>
          {plan.stops.some((s) => s.access) && (
            <p className="mt-1.5 text-xs text-muted">
              The access stop is the large public school nearest the route where many students come from low-income families (Title I, or 40%+ free or
              reduced-price lunch), from federal school data. Out-of-state recruiting visits tend to skip schools like it.
            </p>
          )}
        </div>

        <div className="rounded-[18px] border-[1.5px] border-ink bg-lilac/25 px-4 py-3.5">
          <p className="text-xs font-bold tracking-[0.12em]">COLLEGE FAIRS NEARBY</p>
          {note ? (
            <p className="mt-2.5 text-sm text-muted">{note}</p>
          ) : (
            <ul className="mt-2.5 space-y-2 text-[15px]">
              {events.events.map((e) => (
                <li key={`${e.title}-${e.when}`}>
                  {e.link ? (
                    <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-pennant decoration-2 underline-offset-2">{e.title}</a>
                  ) : (
                    <span className="font-semibold">{e.title}</span>
                  )}
                  <span className="block text-xs text-muted">{[e.when, e.venue].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          )}
          {events.fetchedAt && <p className="mt-2 text-xs text-muted">Google Events through SerpApi, searched {new Date(events.fetchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.</p>}
        </div>
      </div>
    </div>
  );
}
