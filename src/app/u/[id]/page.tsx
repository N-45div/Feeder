import Link from "next/link";
import { notFound } from "next/navigation";
import feeder from "../../../../data/eval/feeder.json";
import { getAudienceCells, getDesk, listUniversities, stateAbbr } from "@/lib/data/desk";
import { project } from "@/lib/geo/project";
import { AudienceBase } from "./audience-base";
import { fmt } from "../../ui";
import { AskFeeder } from "./ask-feeder";
import { RoadTrip } from "./road-trip";
import { StateBoard } from "./state-board";

/** Every university's desk is prerendered; an unknown id renders on request and 404s. */
export async function generateStaticParams() {
  return (await listUniversities()).map((u) => ({ id: String(u.unitid) }));
}

export async function generateMetadata({ params }: PageProps<"/u/[id]">) {
  const desk = await getDesk(Number((await params).id));
  return { title: desk ? `${desk.university.qlooName} · Feeder` : "Not found · Feeder" };
}

export default async function UniversityPage({ params }: PageProps<"/u/[id]">) {
  const id = Number((await params).id);
  const desk = Number.isInteger(id) ? await getDesk(id) : null;
  if (!desk) notFound();
  const { university: u, board, metros } = desk;
  const cells = await getAudienceCells(u.unitid);
  const pins = Object.fromEntries(metros.map((m) => [m.cbsa, project(m.lon, m.lat)]).filter(([, xy]) => xy)) as Record<string, [number, number]>;
  const school = u.qlooName;
  const y = feeder.amendment2_young.fall2022;

  return (
    <div className="space-y-6">
      <section aria-label="University" className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">← All universities</Link>
          <div className="pennant rise mt-2 bg-ink py-4 pl-6 pr-16 text-white sm:pr-20">
            <p className="text-xs font-bold tracking-[0.16em] text-[#ffb89c]">RECRUITING DESK</p>
            <h1 className="mt-1 font-varsity text-3xl leading-none tracking-wide sm:text-[44px]">{school.toUpperCase()}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full border-[1.5px] border-ink bg-surface px-3 py-1.5">{u.city}, {u.state}{u.control ? ` · ${u.control}` : ""}</span>
          <span className="rounded-full border-[1.5px] border-ink bg-surface px-3 py-1.5"><span className="figure">{fmt(u.firstTime2022)}</span> first-time freshmen, Fall 2022</span>
          <span className="rounded-full border-[1.5px] border-ink bg-pennant px-3 py-1.5"><span className="figure">{Math.round(u.outShare2022 * 100)}%</span> from out of state</span>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
          <StateBoard board={board} home={stateAbbr(u.state)} homeName={u.state} homeFreshmen={u.home2022} school={school} />
          <RoadTrip unitid={u.unitid} metros={metros} school={school} map={{ base: <AudienceBase cells={cells} home={stateAbbr(u.state)} />, campus: project(u.lon, u.lat), pins }} />
          <section id="evidence" aria-labelledby="ev-h">
            <h2 id="ev-h" className="text-2xl font-bold">How sure is this?</h2>
            <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              <Tile value={`+${y.partial_spearman_vs_gravity_residual.young.mean.toFixed(2)}`} text={`Qloo pull among people 24 and younger tracks what population and distance can't explain, across ${y.universities} universities, in 2022 and again in 2020.`} />
              <Tile value={`+${y.partial_spearman_vs_gravity_residual.assistant.mean.toFixed(2)}`} text="An AI assistant asked the same question explains less. Qloo gets there from measured taste, and goes down to metros and high schools." />
              <Tile value={y.out_of_sample_spearman["gravity+assistant"].mean.toFixed(2)} text={`For ranking every state outright, the assistant still predicts better (${y.out_of_sample_spearman["gravity+assistant"].mean.toFixed(2)} against ${y.out_of_sample_spearman["gravity+young"].mean.toFixed(2)} with Qloo). Feeder says so.`} />
            </div>
            <Link href="/evidence" className="mt-3 inline-block text-sm font-bold text-pennant-ink hover:underline">All the evidence and its limits</Link>
          </section>
        </div>
        <AskFeeder
          unitid={u.unitid}
          name={school}
          suggestions={[
            "Where are we under-recruiting?",
            "Plan two recruiters' fall trips, three weeks each",
            metros[0] ? `Which ${metros[0].city} high schools should we visit?` : "Which metros should we visit first?",
          ]}
        />
        <div className="h-20 w-full lg:hidden" aria-hidden="true" />
      </div>
    </div>
  );
}

function Tile({ value, text }: { value: string; text: string }) {
  return (
    <div className="rounded-[18px] bg-ink p-4 text-white">
      <p className="figure text-[32px] font-bold text-[#ffb89c]">{value}</p>
      <p className="mt-1.5 text-sm leading-snug">{text}</p>
    </div>
  );
}
