"use client";

import { useId, useRef, type Ref } from "react";
import {
  BellIcon,
  BotIcon,
  CalendarIcon,
  CloudIcon,
  CommandIcon,
  CreditCardIcon,
  DatabaseIcon,
  GitBranchIcon,
  MailIcon,
  MessageSquareIcon,
  SearchIcon,
  TrendingUpIcon,
  WebhookIcon,
  WorkflowIcon,
  ZapIcon,
} from "lucide-react";

import { AnimatedBeam } from "@/components/velora/animated-beam";
import { BentoCard, BentoGrid } from "@/components/velora/bento-grid";
import { BlurFade } from "@/components/velora/blur-fade";
import { Globe, type GlobeArc, type GlobeMarker } from "@/components/velora/globe";
import { Marquee } from "@/components/velora/marquee";
import { NumberTicker } from "@/components/velora/number-ticker";
import { OrbitingCircles } from "@/components/velora/orbiting-circles";
import { cn } from "@/lib/utils";

const HEADING = {
  eyebrow: "The corpus",
  title: "A research assistant that knows California law",
  description:
    "California Law searches 73 MB of statute text and the live web, then reasons over both and shows the exact section behind every answer.",
};

const CARDS = {
  integrations: {
    name: "Statutory text, not summaries",
    description: "search_california_law queries the full text of every code, court rule, judicial form and case annotation.",
    cta: "Browse the corpus",
  },
  automations: {
    name: "The live web, alongside the corpus",
    description: "Firecrawl pulls current pages so amendments and news aren't missed.",
    cta: "See how it searches",
  },
  analytics: {
    name: "Reasoning you can watch",
    description: "The model's thinking streams in live, step by step, before the answer lands.",
    cta: "See the thinking view",
  },
  search: {
    name: "Find anything instantly",
    description: "One search across 36 datasets, by keyword or by citation like \u201cPEN 459\u201d.",
    cta: "Try a search",
  },
  edge: {
    name: "Answers you can check",
    description: "Every claim links back to its section, with the snippet highlighted in place.",
    cta: "View citations",
  },
};

const TAGS = [
  "PEN 459",
  "FAM 7600",
  "EVID 1220",
  "COM 2201",
  "CCP 425.16",
  "CIV 1714",
  "VEH 23152",
  "GOV 12940",
  "HSC 11350",
  "WIC 300",
  "RTC 17041",
  "PRC 21000",
];

// Sections returned per query, over the last 12 weeks.
const SERIES = [18, 22, 20, 27, 25, 31, 29, 34, 38, 36, 43, 48];

const MARKERS: GlobeMarker[] = [
  { lat: 34.05, lng: -118.24, label: "Los Angeles" },
  { lat: 37.77, lng: -122.42, label: "San Francisco" },
  { lat: 38.58, lng: -121.49, label: "Sacramento" },
  { lat: 32.72, lng: -117.16, label: "San Diego" },
  { lat: 36.75, lng: -119.77, label: "Fresno" },
];

const ARCS: GlobeArc[] = [
  { from: [34.05, -118.24], to: [37.77, -122.42] },
  { from: [34.05, -118.24], to: [38.58, -121.49] },
  { from: [37.77, -122.42], to: [36.75, -119.77] },
];

/**
 * Bento feature grid: five cards, each with a live visual — integration
 * beams, orbiting automations, an indexed-sections chart, a tag marquee and a globe.
 * Edit the consts above; the visuals re-theme from your brand tokens.
 */
export function FeaturesBento() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-brand/5 to-transparent"
      />
      <div className="mx-auto max-w-7xl">
        <BlurFade>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">{HEADING.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
              {HEADING.title}
            </h2>
            <p className="mt-5 text-lg text-pretty text-muted-foreground">
              {HEADING.description}
            </p>
          </div>
        </BlurFade>

        <BlurFade delay={0.1}>
          <BentoGrid className="mt-16 md:grid-cols-2 lg:grid-cols-3">
            <BentoCard
              {...CARDS.integrations}
              href="#research"
              className="md:col-span-2"
              background={<IntegrationsVisual />}
            />
            <BentoCard {...CARDS.automations} href="#research" background={<AutomationsVisual />} />
            <BentoCard {...CARDS.analytics} href="#research" background={<AnalyticsVisual />} />
            <BentoCard {...CARDS.search} href="#research" background={<SearchVisual />} />
            <BentoCard {...CARDS.edge} href="#research" background={<EdgeVisual />} />
          </BentoGrid>
        </BlurFade>
      </div>
    </section>
  );
}

function Node({
  ref,
  className,
  children,
}: {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 grid size-11 place-items-center rounded-full border bg-card text-muted-foreground shadow-md shadow-foreground/5 sm:size-12 [&_svg]:size-5",
        className
      )}
    >
      {children}
    </div>
  );
}

function IntegrationsVisual() {
  const container = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const l1 = useRef<HTMLDivElement>(null);
  const l2 = useRef<HTMLDivElement>(null);
  const l3 = useRef<HTMLDivElement>(null);
  const r1 = useRef<HTMLDivElement>(null);
  const r2 = useRef<HTMLDivElement>(null);
  const r3 = useRef<HTMLDivElement>(null);
  // Beams start at the hub: the component's highlight eases out, so it
  // lingers where each beam ends — at the integration it syncs with.
  const beams = [
    { to: l1, curvature: -40, delay: 0, reverse: true },
    { to: l2, curvature: 0, delay: 0.8, reverse: true },
    { to: l3, curvature: 40, delay: 1.6, reverse: true },
    { to: r1, curvature: -40, delay: 0.4 },
    { to: r2, curvature: 0, delay: 1.2 },
    { to: r3, curvature: 40, delay: 2 },
  ];

  return (
    <div aria-hidden className="absolute inset-x-0 top-0 h-60 px-6 pt-6 sm:px-16">
      <div ref={container} className="relative flex h-full items-center justify-between">
        <div className="flex h-full flex-col justify-between py-2">
          <Node ref={l1}>
            <DatabaseIcon />
          </Node>
          <Node ref={l2} className="-translate-x-2 sm:-translate-x-6">
            <MailIcon />
          </Node>
          <Node ref={l3}>
            <CreditCardIcon />
          </Node>
        </div>

        <div
          ref={hub}
          className="relative z-10 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-from via-brand-via to-brand-to text-brand-foreground shadow-xl shadow-brand/30 ring-4 ring-background sm:size-20"
        >
          <ZapIcon className="size-7 sm:size-9" />
        </div>

        <div className="flex h-full flex-col justify-between py-2">
          <Node ref={r1}>
            <CalendarIcon />
          </Node>
          <Node ref={r2} className="translate-x-2 sm:translate-x-6">
            <MessageSquareIcon />
          </Node>
          <Node ref={r3}>
            <CloudIcon />
          </Node>
        </div>

        {beams.map((beam, i) => (
          <AnimatedBeam
            key={i}
            containerRef={container}
            fromRef={hub}
            toRef={beam.to}
            curvature={beam.curvature}
            delay={beam.delay}
            reverse={beam.reverse}
            duration={4}
            gradientStartColor="var(--brand-from)"
            gradientStopColor="var(--brand-to)"
          />
        ))}
      </div>
    </div>
  );
}

function Satellite({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid size-full place-items-center rounded-full border bg-card text-muted-foreground shadow-sm [&_svg]:size-4">
      {children}
    </div>
  );
}

function AutomationsVisual() {
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 flex h-64 items-center justify-center">
      <div className="grid size-14 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-lg shadow-primary/20">
        <WorkflowIcon className="size-6" />
      </div>
      <OrbitingCircles radius={56} iconSize={32} duration={16}>
        <Satellite>
          <BellIcon />
        </Satellite>
        <Satellite>
          <BotIcon />
        </Satellite>
        <Satellite>
          <WebhookIcon />
        </Satellite>
      </OrbitingCircles>
      <OrbitingCircles radius={100} iconSize={36} duration={28} reverse>
        <Satellite>
          <MailIcon />
        </Satellite>
        <Satellite>
          <GitBranchIcon />
        </Satellite>
        <Satellite>
          <CalendarIcon />
        </Satellite>
        <Satellite>
          <DatabaseIcon />
        </Satellite>
      </OrbitingCircles>
    </div>
  );
}

function AnalyticsVisual() {
  const id = useId();
  const w = 300;
  const h = 110;
  const max = Math.max(...SERIES);
  const points = SERIES.map(
    (v, i) => [(i / (SERIES.length - 1)) * w, h - (v / max) * (h - 12)] as const
  );
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <div aria-hidden className="absolute inset-x-0 top-0 flex h-60 flex-col gap-4 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Sections indexed</p>
          <p className="mt-1 text-3xl font-medium tracking-tight">
            <NumberTicker value={12000} suffix="+" />
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          <TrendingUpIcon className="size-3.5" />
          12.4%
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full flex-1 overflow-visible"
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--brand)", stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: "var(--brand)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={w}
            y1={h * f}
            y2={h * f}
            className="stroke-border"
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          className="stroke-brand"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={lastX} cy={lastY} r="4" className="fill-brand stroke-card" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground">
      <span className="text-primary">#</span>
      {children}
    </span>
  );
}

function SearchVisual() {
  const half = Math.ceil(TAGS.length / 2);
  return (
    <div aria-hidden className="absolute inset-x-0 top-0 flex h-60 flex-col gap-4 pt-6">
      <div className="mx-6 flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 text-sm text-muted-foreground shadow-sm">
        <SearchIcon className="size-4 shrink-0" />
        <span className="truncate">Search issues, docs and people…</span>
        <kbd className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[11px]">
          <CommandIcon className="size-3" />K
        </kbd>
      </div>
      <div className="flex flex-col gap-2.5">
        <Marquee className="[--duration:30s] [--gap:0.5rem]">
          {TAGS.slice(0, half).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Marquee>
        <Marquee reverse className="[--duration:34s] [--gap:0.5rem]">
          {TAGS.slice(half).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Marquee>
        <Marquee className="[--duration:38s] [--gap:0.5rem]">
          {[...TAGS].reverse().map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Marquee>
      </div>
    </div>
  );
}

function EdgeVisual() {
  return (
    <div className="absolute inset-x-0 -top-6 flex justify-center">
      <Globe
        markers={MARKERS}
        arcs={ARCS}
        center={[30, -20]}
        className="w-72 sm:w-80"
        label="Globe showing California Law regions in Los Angeles, San Francisco, Sacramento, San Diego and Fresno"
      />
    </div>
  );
}
