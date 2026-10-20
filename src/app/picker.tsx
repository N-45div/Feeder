"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { UniversitySummary } from "@/lib/data/desk";

const KINDS = [
  { key: null, label: "All" },
  { key: "public", label: "Public" },
  { key: "private nonprofit", label: "Private" },
] as const;

export function Picker({ universities }: { universities: UniversitySummary[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter((u) => (!kind || u.control === kind) && (!q || `${u.name} ${u.city} ${u.state}`.toLowerCase().includes(q)));
  }, [universities, query, kind]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="pick" className="text-[30px] font-bold tracking-tight">Pick your university</h2>
        <label className="flex w-full max-w-sm flex-col gap-1.5 text-[13px] font-bold">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="University, city or state"
            className="card-sm min-h-12 rounded-full bg-surface px-5 text-base font-normal outline-none focus:ring-4 focus:ring-pennant/30"
          />
        </label>
      </div>
      <div role="group" aria-label="Kind of university" className="mt-4 inline-flex gap-1.5 rounded-2xl border-[1.5px] border-ink bg-surface p-1.5">
        {KINDS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={() => setKind(k.key)}
            aria-pressed={kind === k.key}
            className={`min-h-11 rounded-xl px-4 text-[15px] font-bold ${kind === k.key ? "bg-ink text-white" : "hover:bg-bg"}`}
          >
            {k.label} <span className="figure ml-1">{k.key ? universities.filter((u) => u.control === k.key).length : universities.length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="mt-6 text-muted">No university matches “{query}”.</p>}
      <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
        {shown.map((u, i) => (
          <li key={u.unitid} className="rise" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
            <Link href={`/u/${u.unitid}`} className="press group flex items-center gap-3 rounded-[18px] border-[1.5px] border-ink bg-surface px-4 py-3">
              <svg viewBox="0 0 34 34" className="h-9 w-9 shrink-0 transition-transform group-hover:-rotate-6" aria-hidden="true">
                <path d="M6 3v28" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M7 5l22 7.5L7 20z" fill={u.control === "public" ? "var(--pennant)" : "var(--teal)"} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <span className="min-w-0 flex-1">
                <span className="block font-bold leading-snug">{u.name}</span>
                <span className="mt-0.5 block text-[13px] text-muted">
                  {u.city}, {u.state} · <span className="figure">{Math.round(u.outShare2022 * 100)}%</span> out of state
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
