import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Graduate, Instrument_Sans } from "next/font/google";
import { Pennant } from "./ui";
import "./globals.css";

const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const graduate = Graduate({ variable: "--font-graduate", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Feeder · recruiting desk",
  description: "Where a university's brand already pulls beyond its freshman pipeline, which metros and high schools to visit, and what resonates there. Qloo taste data checked against federal enrollment records.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrument.variable} ${geistMono.variable} ${graduate.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b-[1.5px] border-ink bg-surface">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <Pennant className="h-9 w-9" />
              <span className="font-varsity text-[26px] tracking-wide">FEEDER</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold">
              <Link href="/" className="rounded-full px-3.5 py-2.5 hover:bg-bg">Universities</Link>
              <Link href="/evidence" className="rounded-full px-3.5 py-2.5 hover:bg-bg">Evidence</Link>
              <Link href="/evidence#mcp" className="press card-sm rounded-full bg-surface px-3.5 py-2 text-sm font-bold">Use it in Claude</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-7 sm:px-6">{children}</main>
        <footer className="border-t-[1.5px] border-ink bg-surface">
          <div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-3 px-4 py-5 text-[13px] text-muted sm:px-6">
            <span>Taste data from Qloo. Enrollment from IPEDS (US Department of Education), Fall 2020 and 2022. Population from the Census Bureau.</span>
            <span>Not affiliated with any university.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
