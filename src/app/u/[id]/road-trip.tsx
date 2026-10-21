"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/brief/brief";
import type { MetroEvents } from "@/lib/brief/events";
import type { MetroRow } from "@/lib/data/desk";
import { fmt } from "../../ui";
import { VisitDay, type VisitPlan } from "./visit-day";

/** A brief as /api/brief sends it; a response cached before the visit day existed lacks the last two. */
type DayBrief = Brief & { visit?: VisitPlan; events?: MetroEvents };
type Load = { status: "ready"; brief: DayBrief } | { status: "error"; message: string };

const people = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((x) => (
        <span key={x} className="rounded-full border-[1.5px] border-ink bg-surface px-2.5 py-0.5 text-[13px] font-semibold">{x}</span>
      ))}
    </div>
  );
}

export interface AudienceMap {
  /** State shapes and heat cells, drawn on the server as SVG. */
  base: ReactNode;
  campus: [number, number] | null;
  /** Map positions of the metros, by cbsa. */
  pins: Record<string, [number, number]>;
}

export function RoadTrip({ unitid, metros, school, map }: { unitid: number; metros: MetroRow[]; school: string; map?: AudienceMap }) {
  const [pick, setPick] = useState(metros.find((m) => m.pop2025 >= 1_000_000)?.cbsa ?? metros[0]?.cbsa);
  const [briefs, setBriefs] = useState<Record<string, Load>>({});
  const metro = metros.find((m) => m.cbsa === pick);
  const load = pick ? briefs[pick] : undefined;

  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!pick || requested.current.has(pick)) return;
    requested.current.add(pick);
    fetch(`/api/brief?u=${unitid}&cbsa=${pick}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "The brief couldn't load.");
        setBriefs((b) => ({ ...b, [pick]: { status: "ready", brief: body } }));
      })
      .catch((e: Error) => {
        requested.current.delete(pick);
        setBriefs((b) => ({ ...b, [pick]: { status: "error", message: e.message } }));
      });
  }, [pick, unitid]);

  if (!metros.length) return null;
  return (
    <>
      <section aria-labelledby="metros-h">
        <p className="kicker">Road trip</p>
        <h2 id="metros-h" className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[30px]">Where to send recruiters</h2>
        <p className="mt-1.5 max-w-3xl leading-relaxed text-muted">Metros of 500,000+ people outside your home state where the pull for {school} is strongest, from the same Qloo map. Pick one for its brief.</p>
        {map && (
          <figure className="card mt-4 p-3 sm:p-4">
            <div className="relative">
              <svg viewBox="0 0 960 600" className="block h-auto w-full" role="img" aria-label={`Where people who lean toward ${school} live, from Qloo's heatmap, with the top metros pinned`}>
                {map.base}
                {map.campus && (
                  <g transform={`translate(${map.campus[0]} ${map.campus[1]})`} aria-hidden="true">
                    <circle r={9} fill="#1a1530" />
                    <path d="M-2 -5v11" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
                    <path d="M-1.5 -5l6 2.4-6 2.4z" fill="#ff6a2b" />
                  </g>
                )}
              </svg>
              {metros.slice(0, 8).map((m, i) => {
                const at = map.pins[m.cbsa];
                if (!at) return null;
                const on = m.cbsa === pick;
                return (
                  <button
                    key={m.cbsa}
                    type="button"
                    onClick={() => setPick(m.cbsa)}
                    aria-pressed={on}
                    aria-label={`${m.city}, pull ${m.pull.toFixed(2)}`}
                    title={`${m.city} · pull ${m.pull.toFixed(2)}`}
                    className={`pop figure absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink text-xs font-bold transition-transform hover:scale-110 ${on ? "z-10 scale-125 bg-ink text-white" : "bg-surface text-ink"}`}
                    style={{ left: `${(at[0] / 960) * 100}%`, top: `${(at[1] / 600) * 100}%`, animationDelay: `${300 + i * 60}ms` }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 bg-[#ff6a2b]" />Strongest lean toward {school}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 bg-[#ff6a2b]/55" />Strong</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-3.5 bg-[#ffb89c]/60" />Above average</span>
              <span>Each square is about 30 by 20 km of Qloo&apos;s map. Numbers match the metro cards.</span>
            </figcaption>
          </figure>
        )}
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
          {metros.slice(0, 8).map((m, i) => (
            <button
              key={m.cbsa}
              type="button"
              onClick={() => setPick(m.cbsa)}
              aria-pressed={m.cbsa === pick}
              className={`press rise flex min-h-11 flex-col gap-2 rounded-[18px] border-[1.5px] border-ink p-3.5 text-left ${m.cbsa === pick ? "bg-pennant-soft shadow-[4px_4px_0_var(--ink)]" : "bg-surface"}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="flex items-baseline justify-between gap-1.5">
                <span className="text-lg font-bold leading-tight"><span className="figure mr-1.5 text-sm text-pennant-ink">{i + 1}</span>{m.city}</span>
                <span className="figure text-xs text-muted">{m.states.join("-")}</span>
              </span>
              <span className="h-2 overflow-hidden rounded bg-quiet">
                <span className="bar-grow block h-full bg-pennant" style={{ width: `${Math.round(m.pull * 100)}%` }} />
              </span>
              <span className="flex justify-between text-[13px] text-muted">
                <span>pull <b className="figure text-ink">{m.pull.toFixed(2)}</b></span>
                <span>{people(m.pop2025)} · {fmt(m.distanceKm)} km</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {metro && (
        <section aria-labelledby="brief-h" className="card p-5 sm:p-6">
          <p className="kicker">Metro brief</p>
          <h2 id="brief-h" className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[30px]">{metro.name.split(",")[0].split("-").slice(0, 2).join("–")}</h2>
          <p className="mt-1.5 text-[15px] text-muted">Ranked by Qloo for people who lean toward {school}, within 40 km of the metro. Untested: federal data has no high-school or metro detail.</p>
          {load?.status === "ready" ? (
              <>
              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
                <div className="rounded-[18px] border-[1.5px] border-ink bg-pennant-soft px-4 py-3.5">
                  <p className="text-xs font-bold tracking-[0.12em]">HIGH SCHOOLS TO VISIT</p>
                  {load.brief.highSchools.length ? (
                    <ol className="mt-2.5 space-y-2">
                      {load.brief.highSchools.map((p, i) => (
                        <li key={p.name} className="flex gap-2.5 text-[15px]">
                          <span className="figure font-bold text-pennant-ink">{i + 1}</span>
                          <span>
                            {p.name}
                            {p.address && <span className="block text-xs text-muted">{p.address}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2.5 text-sm text-muted">Qloo ranked no high schools here for this audience.</p>
                  )}
                </div>
                <div className="rounded-[18px] border-[1.5px] border-ink bg-bg px-4 py-3.5">
                  <p className="text-xs font-bold tracking-[0.12em]">RIVAL COLLEGES NEARBY</p>
                  {load.brief.colleges.length ? (
                    <ul className="mt-2.5 space-y-2 text-[15px]">{load.brief.colleges.map((p) => <li key={p.name}>{p.name}</li>)}</ul>
                  ) : (
                    <p className="mt-2.5 text-sm text-muted">None ranked here.</p>
                  )}
                </div>
                <div className="rounded-[18px] border-[1.5px] border-ink bg-teal-soft px-4 py-3.5">
                  <p className="text-xs font-bold tracking-[0.12em]">WHAT RESONATES THERE</p>
                  <p className="mb-1 mt-2.5 text-xs font-bold text-muted">MUSIC</p>
                  <Chips items={load.brief.hooks.music.slice(0, 6)} />
                  <p className="mb-1 mt-3 text-xs font-bold text-muted">TV</p>
                  <Chips items={load.brief.hooks.tv.slice(0, 6)} />
                </div>
              </div>
              {load.brief.visit && load.brief.events && <VisitDay key={pick} plan={load.brief.visit} events={load.brief.events} metro={metro.city} />}
            </>
          ) : load?.status === "error" ? (
            <p className="mt-4 rounded-xl border-[1.5px] border-ink bg-warn-soft px-4 py-3 text-sm text-warn">{load.message}</p>
          ) : (
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5" aria-label="Loading the brief">
              {[0, 1, 2].map((i) => <div key={i} className="shimmer h-56 rounded-[18px]" />)}
            </div>
          )}
        </section>
      )}
    </>
  );
}
