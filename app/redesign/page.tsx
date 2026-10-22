import {
  ArrowRight,
  BookOpen,
  Check,
  Download,
  Globe,
  Scale,
  Search,
  Sparkles,
  Star,
} from "lucide-react";

import { AuroraBackground } from "@/components/velora/aurora-background";
import { AnimatedGradientText } from "@/components/velora/animated-gradient-text";
import { AnimatedTestimonials } from "@/components/velora/animated-testimonials";
import { BackgroundBeams } from "@/components/velora/background-beams";
import { BorderBeam } from "@/components/velora/border-beam";
import { BrowserMockup } from "@/components/velora/browser-mockup";
import { BlurFade } from "@/components/velora/blur-fade";
import { Dock, DockIcon } from "@/components/velora/dock";
import { DotPattern } from "@/components/velora/grid-pattern";
import { Lamp } from "@/components/velora/lamp";
import { LogoCloud } from "@/components/velora/logo-cloud";
import { Marquee } from "@/components/velora/marquee";
import { Meteors } from "@/components/velora/meteors";
import { NumberTicker } from "@/components/velora/number-ticker";
import { ShimmerButton } from "@/components/velora/shimmer-button";
import { SpotlightCard } from "@/components/velora/spotlight-card";
import { TracingBeam } from "@/components/velora/tracing-beam";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Open Researcher — Velora redesign",
  description:
    "California law, researched in seconds — corpus plus web, every claim cited.",
};

const CODES: [string, string][] = [
  ["PEN", "Penal Code"],
  ["CIV", "Civil Code"],
  ["FAM", "Family Code"],
  ["EVID", "Evidence Code"],
  ["CCP", "Civil Procedure"],
  ["GOV", "Government Code"],
  ["HSC", "Health & Safety"],
  ["WIC", "Welfare & Inst."],
  ["BPC", "Business & Prof."],
  ["VEH", "Vehicle Code"],
  ["RTC", "Revenue & Tax."],
  ["PRC", "Public Resources"],
];

const SETS: [string, string][] = [
  ["RULES", "California Rules of Court"],
  ["FORMS", "Judicial Council forms"],
  ["CASES", "Case annotations"],
  ["LEG", "Pending legislation"],
  ["LIB", "Practice library"],
  ["DIR", "Court directory"],
];

const FEATURES = [
  {
    icon: BookOpen,
    title: "Statutory text, not summaries",
    body: "The search_california_law tool queries the full text of every code, court rule, judicial form and case annotation held on the site — so answers quote the section, not a paraphrase of it.",
    span: "lg:col-span-2",
  },
  {
    icon: Search,
    title: "Corpus-first ranking",
    body: "Weighted toward the exact citation you asked for, across 36 datasets.",
    span: "",
  },
  {
    icon: Globe,
    title: "Live web, via Firecrawl",
    body: "Current pages alongside the corpus, so amendments aren't missed.",
    span: "",
  },
  {
    icon: Sparkles,
    title: "Reasoning you can watch",
    body: "The model's thinking streams in live, step by step, before the answer.",
    span: "",
  },
  {
    icon: Scale,
    title: "Citations you can open",
    body: "Every claim links back to its section, with the snippet highlighted.",
    span: "",
  },
];

const STEPS = [
  {
    n: "Step 01",
    t: "Ask in plain English",
    b: "“Does a landlord have to return a deposit within 21 days?” — or just “PEN 459”. Both work.",
  },
  {
    n: "Step 02",
    t: "It searches the corpus, then the web",
    b: "Ranked hits across 36 datasets, then live pages to catch what changed this session — streamed as it goes.",
  },
  {
    n: "Step 03",
    t: "You get the answer, cited",
    b: "Plain-language reasoning with the exact section, quoted and linked — ready to check before you rely on it.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "It reads like a paralegal who has actually opened the code. The citation on every claim is the part that sold me.",
    name: "D. Rivera",
    role: "Public defender",
  },
  {
    quote:
      "I used to keep four tabs of leginfo open. Now I ask once and check the section it hands me.",
    name: "M. Kaur",
    role: "Solo practitioner",
  },
  {
    quote:
      "Watching it search the corpus before it answers is what makes it trustworthy. It doesn't bluff.",
    name: "J. Tan",
    role: "Policy analyst",
  },
];

const SOURCES: [string, string, number, boolean][] = [
  ["COM § 2201 — Formal requirements", "Corpus", 94, true],
  ["COM § 2201(3)(c) — Exceptions", "Corpus", 71, false],
  ["leginfo.legislature.ca.gov", "Web", 58, false],
];

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative border-b border-border/50 ${className}`}>
      <div className="mx-auto max-w-6xl px-6 py-24">{children}</div>
    </section>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-to">
      {children}
    </span>
  );
}

export default function RedesignPage() {
  return (
    <div className="dark">
      <div className="min-h-screen bg-background font-sans text-foreground">
        {/* ---------- nav ---------- */}
        <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-2.5 text-[15px] font-semibold">
              <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand-from to-brand-to text-brand-foreground">
                <Scale className="size-4" />
              </span>
              Open Researcher
            </div>
            <nav className="hidden items-center gap-7 text-[13.5px] text-muted-foreground md:flex">
              {["Corpus", "How it works", "Sources", "Docs", "GitHub"].map((l) => (
                <a key={l} href="#" className="transition-colors hover:text-foreground">
                  {l}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                <Star className="size-3.5 text-brand-to" /> 4.9k
              </span>
              <Button variant="outline" size="lg" className="rounded-full px-4">
                Add API key
              </Button>
            </div>
          </div>
        </header>

        {/* ---------- hero ---------- */}
        <section className="relative isolate overflow-hidden border-b border-border/50">
          <AuroraBackground intensity="vivid" />
          <BackgroundBeams className="opacity-70" />
          <DotPattern className="absolute inset-0 -z-10 size-full fill-foreground/10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent_75%)]" />
          <Meteors number={16} />

          <Lamp className="pb-14">
            <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
              <BlurFade delay={0.05}>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-[13px] text-muted-foreground backdrop-blur">
                  <span className="size-1.5 animate-pulse rounded-full bg-brand-to" />
                  Now indexing all 36 California datasets
                </span>
              </BlurFade>

              <h1 className="mt-7 text-balance text-5xl font-extrabold leading-[1.03] tracking-tight sm:text-7xl">
                The whole of California law,{" "}
                <AnimatedGradientText>one search away.</AnimatedGradientText>
              </h1>

              <BlurFade delay={0.15}>
                <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
                  Open Researcher reads every California code, the Rules of Court
                  and the Judicial Council forms — then reasons over them live and
                  shows the exact section behind each answer.
                </p>
              </BlurFade>

              <BlurFade delay={0.25}>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
                  <ShimmerButton>
                    Start researching
                    <ArrowRight className="size-4" />
                  </ShimmerButton>
                  <Button variant="outline" size="lg" className="h-12 rounded-full px-6 text-[15px]">
                    Explore the corpus
                  </Button>
                </div>
              </BlurFade>

              <BlurFade delay={0.35}>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
                  {["36 datasets indexed", "Corpus + live web", "Every claim cited", "Open source"].map(
                    (t) => (
                      <span key={t} className="inline-flex items-center gap-1.5">
                        <Check className="size-3.5 text-brand-to" />
                        {t}
                      </span>
                    )
                  )}
                </div>
              </BlurFade>
            </div>

            <BlurFade delay={0.45} className="mt-12">
              <Dock baseSize={44} magnification={62} distance={150}>
                <DockIcon label="Corpus">
                  <BookOpen className="size-5" />
                </DockIcon>
                <DockIcon label="search_california_law">
                  <Search className="size-5" />
                </DockIcon>
                <DockIcon label="Web search">
                  <Globe className="size-5" />
                </DockIcon>
                <DockIcon label="Thinking">
                  <Sparkles className="size-5" />
                </DockIcon>
                <DockIcon label="Citations">
                  <Scale className="size-5" />
                </DockIcon>
                <DockIcon label="Export">
                  <Download className="size-5" />
                </DockIcon>
              </Dock>
            </BlurFade>
          </Lamp>
        </section>

        {/* ---------- marquee ---------- */}
        <section className="relative overflow-hidden border-b border-border/50 bg-card/30 py-14">
          <p className="mb-7 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Every code, rule and form — indexed in one place
          </p>
          <div className="space-y-3.5">
            <Marquee pauseOnHover className="[--duration:46s] [--gap:0.75rem]">
              {CODES.map(([k, name]) => (
                <span
                  key={k}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-border/60 bg-background/40 px-3.5 py-2 text-[13px] text-muted-foreground"
                >
                  <b className="font-semibold text-foreground">{k}</b> {name}
                </span>
              ))}
            </Marquee>
            <Marquee reverse pauseOnHover className="[--duration:56s] [--gap:0.75rem]">
              {SETS.map(([k, name]) => (
                <span
                  key={k}
                  className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-border/60 bg-background/40 px-3.5 py-2 text-[13px] text-muted-foreground"
                >
                  <span className="text-[10px] tracking-wide text-brand-to">{k}</span> {name}
                </span>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ---------- showcase ---------- */}
        <Section className="text-center">
          <Kicker>The workspace</Kicker>
          <h2 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Chat on the left.{" "}
            <span className="text-muted-foreground">The law itself on the right.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
            Watch it think, search the corpus and the web, then land on an answer —
            with every source ranked, highlighted and one click from the statute.
          </p>

          <BlurFade delay={0.1} className="mt-14">
            <div className="relative mx-auto max-w-5xl">
              <BrowserMockup url="openresearcher.app / research" className="relative text-left">
                <BorderBeam size={220} duration={9} />
                <div className="grid min-h-[440px] grid-cols-1 md:grid-cols-[1.12fr_.88fr]">
                  <div className="space-y-4 border-b border-border/60 p-7 md:border-b-0 md:border-r">
                    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                      <div className="mb-2 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                        You
                      </div>
                      <p className="text-[14.5px] leading-relaxed">
                        Is a verbal agreement to sell a car enforceable in California?
                      </p>
                    </div>
                    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-brand-to">
                        <span className="size-2 animate-pulse rounded-full bg-brand-to" />
                        Thinking · searching the corpus
                      </div>
                      <div className="mt-3 space-y-1.5 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
                        <div>
                          search_california_law(&quot;sale of goods statute of frauds&quot;){" "}
                          <span className="text-brand-to">→ COM § 2201</span>
                        </div>
                        <div>
                          search_california_law(&quot;contract for sale over $500&quot;){" "}
                          <span className="text-brand-to">→ COM § 2201(1)</span>
                        </div>
                        <div>
                          web_search(&quot;California UCC 2201 used car verbal agreement&quot;){" "}
                          <span className="text-brand-to">→ 3 sources</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
                      <p className="text-[14.5px] leading-relaxed">
                        Under California&apos;s statute of frauds, a contract for the
                        sale of goods priced at <b>$500 or more</b> isn&apos;t
                        enforceable unless there&apos;s a signed writing — so a verbal
                        car deal is generally unenforceable, barring narrow exceptions
                        for goods received and accepted, or payment made and accepted.{" "}
                        <span className="text-brand-to">[1][2]</span>
                      </p>
                    </div>
                  </div>
                  <div className="bg-background/40 p-7">
                    <h4 className="mb-4 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Sources · 3
                    </h4>
                    {SOURCES.map(([t, kind, w, on]) => (
                      <div
                        key={t}
                        className={`mb-3 rounded-xl border p-3.5 ${
                          on ? "border-brand/40 bg-brand/10" : "border-border/60 bg-background/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[13px] font-semibold">
                          <span>{t}</span>
                          <em className="rounded-full border border-brand-to/40 px-2 py-0.5 text-[10px] not-italic tracking-wide text-brand-to">
                            {kind}
                          </em>
                        </div>
                        <div
                          className="mt-2 h-[3px] rounded-full bg-gradient-to-r from-brand to-brand-to opacity-75"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMockup>
            </div>
          </BlurFade>
        </Section>

        {/* ---------- features ---------- */}
        <Section>
          <Kicker>Why it&apos;s different</Kicker>
          <h2 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            A research assistant that
            <br />
            actually knows California law.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
            Most AI search tools guess from the open web. Open Researcher searches a
            73 MB statute corpus <em>and</em> the live web — then shows its work.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body, span }) => (
              <SpotlightCard key={title} className={`p-6 ${span}`}>
                <span className="mb-4 grid size-10 place-items-center rounded-xl border border-border bg-gradient-to-br from-brand/25 to-brand-to/20 text-brand-to">
                  <Icon className="size-5" />
                </span>
                <h3 className="text-[18px] font-semibold tracking-tight">{title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </Section>

        {/* ---------- how it works ---------- */}
        <Section>
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <Kicker>How it works</Kicker>
              <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                Three steps,
                <br />
                one citation.
              </h2>
              <p className="mt-5 text-pretty text-[17px] leading-relaxed text-muted-foreground">
                No query language, no boolean strings. Ask the way you&apos;d ask a
                colleague — the corpus does the rest.
              </p>
            </div>
            <TracingBeam className="pl-10">
              <div className="space-y-11">
                {STEPS.map(({ n, t, b }, i) => (
                  <div key={n} className="relative">
                    <span className="absolute -left-10 top-0 grid size-7 place-items-center rounded-full border border-brand/50 bg-background text-brand-to shadow-[0_0_0_5px] shadow-brand/10">
                      {i === STEPS.length - 1 ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Search className="size-3.5" />
                      )}
                    </span>
                    <div className="text-[11.5px] uppercase tracking-[0.14em] text-muted-foreground">
                      {n}
                    </div>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight">{t}</h3>
                    <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                      {b}
                    </p>
                  </div>
                ))}
              </div>
            </TracingBeam>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {([
              [36, "", "California datasets indexed"],
              [73, " MB", "of cleaned statutory text"],
              [2, "", "sources per answer"],
              [12000, "+", "sections searchable"],
            ] as [number, string, string][]).map(([v, s, l]) => (
              <div
                key={l}
                className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center"
              >
                <div className="text-4xl font-extrabold tracking-tight">
                  <AnimatedGradientText>
                    <NumberTicker value={v} suffix={s} />
                  </AnimatedGradientText>
                </div>
                <div className="mt-2 text-[13px] text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- logos ---------- */}
        <Section className="py-16">
          <p className="mb-9 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Grounded in the sources California actually cites
          </p>
          <LogoCloud
            dimUntilHover={false}
            logos={[
              { name: "leginfo.legislature.ca.gov", logo: <span className="text-[15px] font-semibold">leginfo</span> },
              { name: "California Courts", logo: <span className="text-[15px] font-semibold">courts.ca.gov</span> },
              { name: "Judicial Council", logo: <span className="text-[15px] font-semibold">Judicial Council</span> },
              { name: "Firecrawl", logo: <span className="text-[15px] font-semibold">Firecrawl</span> },
              { name: "Anthropic", logo: <span className="text-[15px] font-semibold">Anthropic</span> },
            ]}
          />
        </Section>

        {/* ---------- testimonials ---------- */}
        <Section>
          <Kicker>In use</Kicker>
          <h2 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Built for people who have to be right.
          </h2>
          <BlurFade delay={0.1} className="mt-12">
            <div className="max-w-3xl">
              <AnimatedTestimonials testimonials={TESTIMONIALS} interval={6} />
            </div>
          </BlurFade>
        </Section>

        {/* ---------- final CTA ---------- */}
        <section className="relative border-b border-border/50 px-6 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-card/40 px-8 py-20 text-center">
            <AuroraBackground intensity="medium" />
            <Meteors number={12} />
            <DotPattern className="absolute inset-0 size-full fill-foreground/10 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent_75%)]" />
            <BorderBeam size={280} duration={11} />
            <div className="relative z-10">
              <h2 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
                Ask California law anything.
                <br />
                <AnimatedGradientText>Watch it answer, cited.</AnimatedGradientText>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-muted-foreground">
                Bring your own Anthropic key and start in under a minute. The corpus
                is already indexed.
              </p>
              <div className="mt-9 flex justify-center">
                <ShimmerButton>
                  Start researching
                  <ArrowRight className="size-4" />
                </ShimmerButton>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- footer ---------- */}
        <footer className="px-6 py-14">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-10">
            <div>
              <div className="flex items-center gap-2.5 text-[14.5px] font-semibold">
                <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-brand-from to-brand-to text-brand-foreground">
                  <Scale className="size-3.5" />
                </span>
                Open Researcher
              </div>
              <p className="mt-3.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                California law, researched in seconds — corpus plus web, every claim
                cited.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground">
                Built with <b className="text-foreground">Velora UI</b>
              </span>
            </div>
            <div className="flex gap-14">
              {([
                ["Product", ["Corpus", "How it works", "Sources"]],
                ["Developers", ["Docs", "API", "GitHub"]],
                ["Legal", ["Privacy", "Terms", "Disclaimer"]],
              ] as [string, string[]][]).map(([h, items]) => (
                <div key={h}>
                  <h5 className="mb-3.5 text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    {h}
                  </h5>
                  <ul className="space-y-2.5 text-[13px] text-muted-foreground">
                    {items.map((it) => (
                      <li key={it}>
                        <a href="#" className="transition-colors hover:text-foreground">
                          {it}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
