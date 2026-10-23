import feeder from "../../../data/eval/feeder.json";
import retired from "../../../docs/retired/shelf-desk-seattle-result.json";
import { McpUrl } from "./mcp-url";

export const metadata = { title: "Evidence · Feeder" };

type Stat = { mean: number; ci95: number[] };
const ci = (s: Stat) => `${s.ci95[0].toFixed(2)} to ${s.ci95[1].toFixed(2)}`;
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

function Card({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="font-varsity text-3xl text-pennant-ink">{n}</span>
        <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h2>
      </div>
      <div className="mt-3 space-y-4 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

const TOOLS: [string, string][] = [
  ["find_universities", "Any of the universities Feeder covers, by name, city or state."],
  ["state_board", "Freshmen by state against what geography predicts, with Qloo pull and a group."],
  ["recruiter_metros", "The metros where pull is strongest, for recruiter travel."],
  ["metro_brief", "High schools to visit, rival colleges nearby, and what resonates there."],
  ["audience_hotspots", "Asks Qloo live where young people who'd like a given brand, show or game lean your way."],
  ["plan_trips", "Who goes where each week, by territory."],
  ["get_evidence", "These numbers and their limits."],
];

export default function Evidence() {
  const years = [
    ["Fall 2022", feeder.fall2022],
    ["Fall 2020 (replication)", feeder.fall2020_replication],
  ] as const;
  const r = feeder.fall2022;
  const young = [
    ["Fall 2022", feeder.amendment2_young.fall2022],
    ["Fall 2020 (replication)", feeder.amendment2_young.fall2020_replication],
  ] as const;
  const y = feeder.amendment2_young.fall2022;
  const y20 = feeder.amendment2_young.fall2020_replication;
  const seattle = retired.primary_teen_shelves;
  const head = "px-4 py-2.5 text-xs font-bold tracking-[0.1em] text-muted";
  return (
    <article className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="kicker">Evidence</p>
        <h1 className="mt-1 font-varsity text-4xl tracking-wide sm:text-5xl">HOW SURE IS FEEDER?</h1>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-muted">
          Each test was written down and pushed before it ran (docs/eval-plan.md in the repository, with two amendments, each made before its scores
          existed). The results below are as they came out, including where an AI assistant does better.
        </p>
      </header>

      <Card n="01" title="Asking about the right people: 24 and younger">
        <p className="text-muted">
          The students a university recruits are about 18, but the first test counted everyone who leans toward it, alumni and sports fans included. Amendment 2
          asked Qloo the same question about people aged 24 and younger, scored the same way on the same {y.universities} universities, and was written down
          before any of it was fetched.
        </p>
        <div className="overflow-x-auto rounded-2xl border-[1.5px] border-ink">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-bg">
              <tr>
                <th scope="col" className={head}>BEYOND POPULATION AND DISTANCE</th>
                {young.map(([label]) => <th key={label} scope="col" className={head}>{label.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(["young", "qloo", "assistant", "placebo_young"] as const).map((k) => (
                <tr key={k} className={k === "young" ? "bg-pennant-soft" : ""}>
                  <th scope="row" className="px-4 py-2.5 font-semibold">{{ young: "Qloo pull, 24 and younger", qloo: "Qloo pull, all ages", assistant: "AI assistant alone (Claude Haiku 5.5)", placebo_young: "Placebo: another university's young pull" }[k]}</th>
                  {young.map(([label, t]) => (
                    <td key={label} className="px-4 py-2.5"><span className="figure text-lg font-bold">{signed(t.partial_spearman_vs_gravity_residual[k].mean)}</span> <span className="text-xs text-muted">{ci(t.partial_spearman_vs_gravity_residual[k])}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>It beats the AI assistant:</strong> {signed(y.young_minus_assistant.mean)} in 2022 (range {ci(y.young_minus_assistant)}) and {signed(y20.young_minus_assistant.mean)} in 2020. What young people actually like explains more of where freshmen come from than what an assistant remembers.</li>
          <li><strong>It beats the all-ages pull</strong> by {signed(y.young_minus_all_ages.mean)} (range {ci(y.young_minus_all_ages)}), in both years. The rule written in advance said the board would switch to it if so, and it has.</li>
          <li><strong>A caution:</strong> another university&apos;s young pull also explains some ({signed(y.partial_spearman_vs_gravity_residual.placebo_young.mean)}), so part of the gain is where young people are in general. A university&apos;s own young pull still beats that placebo by {signed(y.young_minus_placebo.mean)} (range {ci(y.young_minus_placebo)}).</li>
          <li><strong>For ranking every state outright, the assistant is still better</strong> ({y.out_of_sample_spearman["gravity+assistant"].mean.toFixed(2)} against {y.out_of_sample_spearman["gravity+young"].mean.toFixed(2)} with young pull), and young pull adds nothing on top of it ({signed(y.assistant_plus_young_minus_gravity_plus_assistant.mean)}).</li>
        </ul>
      </Card>

      <Card n="02" title="The first test: everyone who leans your way">
        <p className="text-muted">
          Ground truth: IPEDS, the federal record of where each university&apos;s first-time freshmen lived, by state. {feeder.test_universities} universities that
          Qloo knows by name, with at least 1,000 freshmen and a fifth from out of state; ten universities tried by hand first were left out. The question is
          what Qloo explains beyond the obvious: big states and nearby states send more students.
        </p>
        <div className="overflow-x-auto rounded-2xl border-[1.5px] border-ink">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-bg">
              <tr>
                <th scope="col" className={head}>BEYOND POPULATION AND DISTANCE</th>
                {years.map(([label]) => <th key={label} scope="col" className={head}>{label.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(["qloo", "assistant", "placebo"] as const).map((k) => (
                <tr key={k} className={k === "qloo" ? "bg-pennant-soft" : ""}>
                  <th scope="row" className="px-4 py-2.5 font-semibold">{{ qloo: "Qloo pull", assistant: "AI assistant alone (Claude Haiku 5.5)", placebo: "Placebo: another university's pull" }[k]}</th>
                  {years.map(([label, y]) => (
                    <td key={label} className="px-4 py-2.5"><span className="figure text-lg font-bold">{signed(y.partial_spearman_vs_gravity_residual[k].mean)}</span> <span className="text-xs text-muted">{ci(y.partial_spearman_vs_gravity_residual[k])}</span></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">Partial Spearman with what population and distance leave unexplained, averaged over universities, with 95% bootstrap intervals.</p>
        <div className="overflow-x-auto rounded-2xl border-[1.5px] border-ink">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-bg">
              <tr>
                <th scope="col" className={head}>PREDICTING EVERY STATE, OUT OF SAMPLE</th>
                {years.map(([label]) => <th key={label} scope="col" className={head}>{label.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(["gravity", "gravity+qloo", "gravity+assistant", "gravity+qloo+assistant"] as const).map((k) => (
                <tr key={k}>
                  <th scope="row" className="px-4 py-2.5 font-semibold">{{ gravity: "Population and distance", "gravity+qloo": "… plus Qloo", "gravity+assistant": "… plus the assistant", "gravity+qloo+assistant": "… plus both" }[k]}</th>
                  {years.map(([label, y]) => <td key={label} className="figure px-4 py-2.5 text-lg font-bold">{y.out_of_sample_spearman[k].mean.toFixed(2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Qloo&apos;s signal is real.</strong> It explains part of what geography misses ({signed(r.partial_spearman_vs_gravity_residual.qloo.mean)}) in both years, and a placebo explains nothing.</li>
          <li><strong>It matches the assistant there</strong> ({signed(r.qloo_minus_assistant.mean)} in 2022, range {ci(r.qloo_minus_assistant)}; {signed(feeder.fall2020_replication.qloo_minus_assistant.mean)} in 2020), from measured taste rather than memory.</li>
          <li><strong>For ranking every state, the assistant is better,</strong> and adding Qloo to the assistant adds nothing ({signed(r.all_three_minus_gravity_plus_assistant.mean)}). Feeder&apos;s state board shows pull next to real enrollment so a team can see both; it does not claim Qloo beats an assistant at the ranking.</li>
        </ul>
      </Card>

      <Card n="03" title="What this does not establish">
        <ul className="list-disc space-y-2 pl-5 text-muted">
          <li>Qloo&apos;s data is from 2026 and the enrollment data from 2020 and 2022, so this measures alignment, not a forecast.</li>
          <li>Where students come from also reflects past recruiting, alumni, athletics and price; the test can&apos;t separate taste from those.</li>
          <li><strong className="text-ink">Metros, high schools, rival colleges and what resonates are untested.</strong> IPEDS has no detail below the state.</li>
          <li>Only first-time freshmen are counted, not transfers or graduate students.</li>
          <li>Qloo&apos;s age groups are its own estimates of who engages with what, and &ldquo;24 and younger&rdquo; is wider than freshmen.</li>
        </ul>
      </Card>

      <Card n="04" title="What came before: an idea that failed its test">
        <p>
          This repository first held Shelf Desk, which picked teen books for students&apos; interests from Qloo&apos;s book graph. Its pre-registered test on Seattle
          Public Library checkouts failed: per copy, its picks were borrowed {Math.abs(seattle["2025"].main.llm.desk_advantage_pct)}% less than an assistant&apos;s in
          2025 and {Math.abs(seattle["2026_jan_aug"].main.llm.desk_advantage_pct)}% less in 2026, and no better than random picks from the same pool. It was dropped;
          the record is in docs/retired. Feeder exists because the test said to stop.
        </p>
      </Card>

      <section id="mcp" className="card scroll-mt-6 bg-ink p-5 text-white sm:p-7">
        <p className="text-[13px] font-bold tracking-[0.14em] text-[#ffb89c]">USE IT IN CLAUDE</p>
        <h2 className="mt-1 text-2xl font-bold sm:text-[28px]">Feeder as a connector</h2>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#dcd8ea]">
          The same tools Ask Feeder uses are served over MCP, with no sign-in. In Claude, open Settings, then Connectors, add a custom connector and paste this address:
        </p>
        <McpUrl />
        <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {TOOLS.map(([name, text]) => (
            <li key={name} className="rounded-2xl border-[1.5px] border-white/25 px-4 py-3">
              <code className="text-sm font-bold text-[#ffb89c]">{name}</code>
              <p className="mt-0.5 text-sm text-[#dcd8ea]">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
