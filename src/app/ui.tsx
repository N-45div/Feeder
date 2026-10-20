// Shared pieces of the Feeder look.

import type { Group } from "@/lib/score/board";

export function Pennant({ className = "", fill = "var(--pennant)" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <path d="M6 3v28" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      <path className="wave" d="M7 5l22 7.5L7 20z" fill={fill} stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export const GROUP: Record<Group, { label: string; fill: string; text: string; line: string }> = {
  untapped: { label: "Untapped", fill: "bg-pennant", text: "text-ink", line: "People here lean toward you, but fewer freshmen come than geography predicts. A place to recruit harder." },
  stronghold: { label: "Stronghold", fill: "bg-teal", text: "text-white", line: "Strong pull and more freshmen than geography predicts. Keep doing what works here." },
  earned: { label: "Enrolls without pull", fill: "bg-lilac", text: "text-ink", line: "More freshmen than geography predicts, without much pull: likely programs, price or past recruiting." },
  quiet: { label: "Quiet", fill: "bg-quiet", text: "text-ink", line: "Little pull and fewer freshmen than geography predicts." },
};

export function SectionHead({ kicker, title, id, children }: { kicker: string; title: string; id?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="kicker">{kicker}</p>
      <h2 id={id} className="mt-1 text-[28px] font-bold leading-tight tracking-tight sm:text-[30px]">{title}</h2>
      {children && <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("en-US");
