import { ArrowRightIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/velora/ui/avatar";
import { Button } from "@/components/velora/ui/button";
import { BlurFade } from "@/components/velora/blur-fade";
import { TextHighlighter } from "@/components/velora/text-highlighter";
import { TweetCard } from "@/components/velora/tweet-card";

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=160&h=160&q=70&auto=format&fit=crop`;

const FEATURED = {
  before:
    "We put our whole practice on California Law last spring. Six months later, drafting a memo takes",
  highlight: "a third of the time",
  after: "and every citation lands on the right section.",
  name: "Dana Whitfield",
  role: "Managing Partner, Whitfield & Cole",
  avatar: photo("1580489944761-15a19d654956"),
  metric: "3.2×",
  metricLabel: "faster from question to cited answer",
  secondary: "12,000+ sections at their fingertips",
};

type Post =
  | {
      kind: "tweet";
      name: string;
      handle: string;
      time: string;
      verified?: boolean;
      avatar?: string;
      text: string;
    }
  | {
      kind: "quote";
      name: string;
      role: string;
      avatar?: string;
      text: string;
    };

const POSTS: Post[] = [
  {
    kind: "tweet",
    name: "M. Kaur",
    handle: "mkaur_esq",
    time: "Mar 14",
    verified: true,
    avatar: photo("1500648767791-00dcc994a43e"),
    text: "Asked it whether a verbal car deal is enforceable in California. It went straight to COM 2201 and quoted the section.",
  },
  {
    kind: "quote",
    name: "D. Rivera",
    role: "Public defender",
    avatar: photo("1438761681033-6461ffad8d80"),
    text: "It reads like a paralegal who has actually opened the code. The citation on every claim is the part that sold me.",
  },
  {
    kind: "tweet",
    name: "J. Tan",
    handle: "jtan_policy",
    time: "Feb 2",
    text: "I used to keep four tabs of leginfo open. Now I ask once and check the section it hands me.",
  },
  {
    kind: "quote",
    name: "A. Osei",
    role: "Paralegal, Bay Area",
    text: "Watching it search the corpus before it answers is what makes it trustworthy. It does not bluff.",
  },
  {
    kind: "tweet",
    name: "S. Iyer",
    handle: "siyer_law",
    time: "Jan 28",
    verified: true,
    avatar: photo("1534528741775-53994a69daeb"),
    text: "It cites the section and shows the snippet. That is the whole thing. I can verify an answer in seconds.",
  },
  {
    kind: "quote",
    name: "P. Nakamura",
    role: "Policy analyst",
    avatar: photo("1507003211169-0a1dd7228f2d"),
    text: "We use it for legislative research now. Pending bills and the existing code, in one answer.",
  },
  {
    kind: "tweet",
    name: "K. Alvarez",
    handle: "kalvarez",
    time: "Dec 9",
    text: "36 datasets, and I never have to remember which code a section lives in. It finds it.",
  },
  {
    kind: "tweet",
    name: "T. Mbeki",
    handle: "tmbeki",
    time: "Nov 21",
    verified: true,
    avatar: photo("1544005313-94ddf0286df2"),
    text: "Deployed it on Vercel in a few minutes. The corpus ships as static assets, so there was no ingest step.",
  },
  {
    kind: "quote",
    name: "H. Lindqvist",
    role: "Solo practitioner",
    avatar: photo("1506794778202-cad84cf45f1d"),
    text: "It shows its working. For anything I would rely on, that is the difference between a toy and a tool.",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

/** Colours @mentions so they read like a real post. */
function withMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-brand">
        {part}
      </span>
    ) : (
      part
    )
  );
}

function Person({
  name,
  detail,
  avatar,
  size = "default",
}: {
  name: string;
  detail: string;
  avatar?: string;
  size?: "default" | "lg";
}) {
  return (
    <figcaption className="flex items-center gap-3">
      <Avatar size="lg" className={size === "lg" ? "size-12" : undefined}>
        {avatar && <AvatarImage src={avatar} alt="" />}
        <AvatarFallback className="bg-gradient-to-br from-brand-from to-brand-to text-xs font-medium text-brand-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-sm">
        <div className="font-medium">{name}</div>
        <div className="text-muted-foreground">{detail}</div>
      </div>
    </figcaption>
  );
}

/**
 * Review wall: a wide case-study quote with its headline metric, then a
 * masonry of social posts and quote cards laid out with CSS columns — no
 * JavaScript measuring, and cards never split across columns.
 */
export function TestimonialsGrid() {
  return (
    <section className="px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <BlurFade className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand">In use</p>
            <h2 className="mt-3 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
              Built for people who have to be right
            </h2>
            <p className="mt-5 text-lg text-pretty text-muted-foreground">
              Public defenders, solo practitioners and policy analysts on what
              changed after they moved their practice to California Law.
            </p>
          </div>
          <Button variant="outline" asChild className="self-start lg:self-auto">
            <a href="#">
              Read more <ArrowRightIcon />
            </a>
          </Button>
        </BlurFade>

        <div className="relative mt-14 grid overflow-hidden rounded-3xl border bg-card lg:grid-cols-[1fr_20rem]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-brand/15 blur-3xl"
          />
          <figure className="relative flex flex-col justify-between gap-10 p-6 sm:p-10">
            <blockquote className="text-xl font-medium tracking-tight text-pretty sm:text-2xl lg:text-3xl">
              <p>
                &ldquo;{FEATURED.before}{" "}
                <TextHighlighter>{FEATURED.highlight}</TextHighlighter>{" "}
                {FEATURED.after}&rdquo;
              </p>
            </blockquote>
            <Person
              name={FEATURED.name}
              detail={FEATURED.role}
              avatar={FEATURED.avatar}
              size="lg"
            />
          </figure>
          <div className="relative flex flex-col justify-center gap-2 border-t bg-muted/40 p-6 sm:p-10 lg:border-t-0 lg:border-l">
            <p className="bg-gradient-to-br from-brand-from via-brand-via to-brand-to bg-clip-text text-6xl font-medium tracking-tight text-transparent sm:text-7xl">
              {FEATURED.metric}
            </p>
            <p className="text-base font-medium">{FEATURED.metricLabel}</p>
            <p className="text-sm text-muted-foreground">{FEATURED.secondary}</p>
          </div>
        </div>

        <div className="mt-4 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {POSTS.map((post) =>
            post.kind === "tweet" ? (
              <TweetCard
                key={post.handle}
                name={post.name}
                handle={post.handle}
                time={post.time}
                verified={post.verified}
                avatar={post.avatar}
                content={withMentions(post.text)}
                className="mb-4 max-w-none break-inside-avoid p-5"
              />
            ) : (
              <figure
                key={post.name}
                className="mb-4 flex break-inside-avoid flex-col gap-5 rounded-2xl border bg-card p-6 text-card-foreground"
              >
                <blockquote className="text-sm leading-relaxed text-pretty sm:text-base">
                  <p>&ldquo;{post.text}&rdquo;</p>
                </blockquote>
                <Person name={post.name} detail={post.role} avatar={post.avatar} />
              </figure>
            )
          )}
        </div>
      </div>
    </section>
  );
}
