"use client";

import { useState } from "react";
import type { StateRow } from "@/lib/data/desk";
import type { Group } from "@/lib/score/board";
import { fmt, GROUP } from "../../ui";

// A tile grid of the states: row and column for each, so small states stay as easy to find as big ones.
const GRID: Record<string, [number, number]> = Object.fromEntries(
  "AK 1 1|ME 1 12|WI 2 7|VT 2 11|NH 2 12|WA 3 2|ID 3 3|MT 3 4|ND 3 5|MN 3 6|IL 3 7|MI 3 8|NY 3 10|MA 3 11|OR 4 2|NV 4 3|WY 4 4|SD 4 5|IA 4 6|IN 4 7|OH 4 8|PA 4 9|NJ 4 10|CT 4 11|RI 4 12|CA 5 2|UT 5 3|CO 5 4|NE 5 5|MO 5 6|KY 5 7|WV 5 8|VA 5 9|MD 5 10|DE 5 11|AZ 6 3|NM 6 4|KS 6 5|AR 6 6|TN 6 7|NC 6 8|SC 6 9|DC 6 10|OK 7 5|LA 7 6|MS 7 7|AL 7 8|GA 7 9|HI 8 1|TX 8 5|FL 8 10"
    .split("|")
    .map((t) => {
      const [abbr, row, col] = t.split(" ");
      return [abbr, [Number(row), Number(col)]];
    }),
);
const ORDER: Group[] = ["untapped", "stronghold", "earned", "quiet"];

export function StateBoard({ board, home, homeName, homeFreshmen, school }: { board: StateRow[]; home: string; homeName: string; homeFreshmen: number; school: string }) {
  const byAbbr = new Map(board.map((r) => [r.abbr, r]));
  const firstUntapped = [...board].filter((r) => r.group === "untapped").sort((a, b) => a.gap - b.gap)[0];
  const [pick, setPick] = useState(firstUntapped?.abbr ?? board[0]?.abbr ?? home);
  const sel = byAbbr.get(pick);
  const untapped = board.filter((r) => r.group === "untapped").sort((a, b) => a.gap - b.gap).slice(0, 6);

  return (
    <section aria-labelledby="board-h" className="card rise p-5 sm:p-6">
      <p className="kicker">State board</p>
      <h2 id="board-h" className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[30px]">Where you pull vs where you enroll</h2>
      <p className="mt-1.5 max-w-3xl leading-relaxed text-muted">
        Pull is Qloo&apos;s measure of how much people aged 24 and younger in a state lean toward {school}: the age of the students you recruit. Enrollment is how many first-time freshmen came from there in Fall 2022,
        against what population and distance alone predict.
      </p>

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[1_1_440px]">
          <div className="grid grid-cols-12 gap-[5px]" role="group" aria-label="States, coloured by recruiting group">
            {Object.entries(GRID).map(([abbr, [row, col]], i) => {
              const r = byAbbr.get(abbr);
              const isHome = abbr === home;
              const style = isHome ? "bg-ink text-white border-[1.5px] border-ink" : r ? `${GROUP[r.group].fill} ${GROUP[r.group].text} border-[1.5px] border-ink` : "bg-surface text-muted border-[1.5px] border-dashed border-[#9c95b5]";
              const selected = abbr === pick;
              return (
                <button
                  key={abbr}
                  type="button"
                  onClick={() => setPick(abbr)}
                  aria-pressed={selected}
                  aria-label={`${abbr}${isHome ? ", home state" : r ? `, ${GROUP[r.group].label}` : ", not enough data"}`}
                  className={`pop figure aspect-square rounded-[9px] text-[11px] font-bold transition-transform hover:-translate-y-0.5 sm:text-xs ${style} ${selected ? "ring-[3px] ring-ink ring-offset-2" : ""}`}
                  style={{ gridRow: row, gridColumn: col, animationDelay: `${i * 12}ms` }}
                >
                  {abbr}
                </button>
              );
            })}
          </div>
          <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-semibold" aria-label="Legend">
            {ORDER.map((g) => (
              <li key={g} className="inline-flex items-center gap-1.5">
                <span className={`h-3.5 w-3.5 rounded border-[1.5px] border-ink ${GROUP[g].fill}`} />
                {GROUP[g].label} · {board.filter((r) => r.group === g).length}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
          <div aria-live="polite" className="rounded-[18px] border-[1.5px] border-ink bg-bg p-4">
            {pick === home ? (
              <>
                <p className="text-xs font-bold tracking-[0.12em] text-muted">HOME STATE</p>
                <p className="mt-0.5 text-[26px] font-bold">{homeName}</p>
                <p className="mt-2 text-sm">
                  <span className="figure text-xl font-bold">{fmt(homeFreshmen)}</span> in-state freshmen. In-state is left off the board.
                </p>
              </>
            ) : sel ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{GROUP[sel.group].label}</p>
                <p className="mt-0.5 text-[26px] font-bold">{sel.state}</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div><p className="figure text-2xl font-bold">{fmt(sel.freshmen)}</p><p className="text-xs text-muted">freshmen</p></div>
                  <div><p className="figure text-2xl font-bold">~{fmt(sel.expected)}</p><p className="text-xs text-muted">geography predicts</p></div>
                  <div><p className="figure text-2xl font-bold text-pennant-ink">{sel.pull.toFixed(2)}</p><p className="text-xs text-muted">Qloo pull</p></div>
                </div>
                <p className="mt-2.5 text-sm leading-snug">{GROUP[sel.group].line}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold tracking-[0.12em] text-muted">NOT ENOUGH DATA</p>
                <p className="mt-0.5 text-[26px] font-bold">{pick}</p>
                <p className="mt-2 text-sm">Too few map cells in this state to measure pull.</p>
              </>
            )}
          </div>
          {untapped.length > 0 && (
            <div className="rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3.5">
              <p className="text-xs font-bold tracking-[0.12em] text-pennant-ink">UNTAPPED: THEY LEAN YOUR WAY, FEW ENROLL</p>
              <ol className="mt-2 space-y-1">
                {untapped.map((r) => (
                  <li key={r.state}>
                    <button type="button" onClick={() => setPick(r.abbr)} className="flex w-full justify-between gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-pennant-soft">
                      <span className="font-semibold">{r.state}</span>
                      <span className="figure">{fmt(r.freshmen)} vs ~{fmt(r.expected)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
