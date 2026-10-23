import Link from "next/link";
import feeder from "../../data/eval/feeder.json";
import { listUniversities } from "@/lib/data/desk";
import { Picker } from "./picker";

/** The worked example on the home page. */
const EXAMPLE = 209551; // University of Oregon

const STEPS = [
  { n: "01", title: "Read the state board", body: "Where people aged 24 and younger lean toward your university, against how many freshmen each state actually sent and what geography predicts." },
  { n: "02", title: "Plan the road trip", body: "The metros outside your state where young people lean your way most, ranked for recruiter travel." },
  { n: "03", title: "Open a metro brief", body: "The high schools Qloo ranks highest for your audience there, the colleges you compete with, and what young people there listen to and watch." },
  { n: "04", title: "Ask Feeder", body: "An agent with the desk's tools that plans trips and drafts outreach. It also works inside Claude." },
];

export default async function Home() {
  const universities = await listUniversities();
  const r = feeder.fall2022;
  const young = feeder.amendment2_young.fall2022.partial_spearman_vs_gravity_residual;
  return (
    <div className="space-y-14">
      <section className="flex flex-wrap items-center gap-10 pt-4">
        <div className="min-w-0 flex-[1_1_480px]">
          <p className="kicker">For enrollment and admissions teams</p>
          <h1 className="mt-3 font-varsity text-5xl leading-[0.95] tracking-wide sm:text-[68px]">FIND YOUR NEXT FRESHMEN.</h1>
          <p className="mt-5 max-w-[36rem] text-lg leading-relaxed text-muted">
            Feeder shows where your university&apos;s brand already pulls beyond its freshman pipeline, which metros and high schools to visit, and what resonates
            there. Taste data from Qloo, checked against federal enrollment records.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a href="#pick" className="press card-sm inline-flex min-h-[52px] items-center rounded-full bg-pennant px-6 text-[17px] font-bold">Pick your university</a>
            <Link href={`/u/${EXAMPLE}`} className="font-bold text-pennant-ink hover:underline">See the University of Oregon&apos;s desk</Link>
          </div>
        </div>
        <dl className="grid min-w-0 flex-[1_1_380px] grid-cols-2 gap-3">
          {[
            [String(universities.length), "universities with a desk"],
            [String(r.universities), "tested against IPEDS, 2022 and 2020"],
            [`+${young.young.mean.toFixed(2)}`, "what Qloo's under-25 pull explains beyond population and distance"],
            [`+${young.assistant.mean.toFixed(2)}`, "the same for an AI assistant asked directly"],
          ].map(([value, label], i) => (
            <div key={label} className="card pop flex flex-col-reverse p-4" style={{ animationDelay: `${150 + i * 90}ms` }}>
              <dt className="mt-1 text-sm leading-snug text-muted">{label}</dt>
              <dd className="figure text-[34px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-[30px] font-bold tracking-tight">How a recruiting season plays</h2>
        <ol className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
          {STEPS.map((s, i) => (
            <li key={s.n} className="card rise flex flex-col gap-2 p-5" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="font-varsity text-3xl text-pennant-ink">{s.n}</span>
              <h3 className="text-xl font-bold">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pick" className="scroll-mt-6">
        <Picker universities={universities} />
      </section>
    </div>
  );
}
