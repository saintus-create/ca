import { MessageCircleIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/velora/ui/accordion";
import { Button } from "@/components/velora/ui/button";
import { AvatarCircles } from "@/components/velora/avatar-circles";
import { BlurFade } from "@/components/velora/blur-fade";
import { DotPattern } from "@/components/velora/grid-pattern";

const FAQS = [
  {
    question: "What does it actually search?",
    answer:
      "Two sources. A 73 MB California corpus held on the site, covering all 36 code datasets, the Rules of Court, Judicial Council forms and case annotations, and the live web via Firecrawl.",
  },
  {
    question: "Do I need an API key?",
    answer:
      "No. The site runs on keys set up by its operator, so there is nothing to bring and nothing to paste in. Web search is included whenever it is switched on for the deployment.",
  },
  {
    question: "Does the corpus get bundled into the serverless function?",
    answer:
      "No. It ships as static assets and is excluded from file tracing, so the functions stay small. On serverless hosts it is read from the site's own static URLs.",
  },
  {
    question: "Which model does it use?",
    answer:
      "The model the operator configured for the site, Sarvam by default, with Venice as an alternative. Answers stream in as the research runs, step by step.",
  },
  {
    question: "Can I trust the citations?",
    answer:
      "Every claim links to the section it came from, with the snippet highlighted in place. You should still check anything you intend to rely on. That is what the link is for.",
  },
  {
    question: "Does it work offline?",
    answer:
      "No. Both sources are remote: the corpus is fetched over HTTP and the web via Firecrawl.",
  },
  {
    question: "Can I deploy it myself?",
    answer:
      "Yes. It is a Next.js app under the MIT licence. Clone it, add a key and ship it to Vercel. The corpus is already in the repo as static assets.",
  },
  {
    question: "Is my data stored?",
    answer:
      "No. Requests are stateless and questions are not kept. The one exception is an optional web search key you can add in the interface, and that stays in your browser.",
  },
];

const SUPPORT_TEAM = ["D. Rivera", "M. Kaur", "J. Tan"];

/**
 * Centered FAQ: a single-open accordion of common questions, then a
 * contact row for anything the list doesn't answer.
 */
export function FaqAccordion() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <DotPattern
        aria-hidden
        className="absolute inset-0 -z-10 size-full fill-foreground/10 [mask-image:radial-gradient(ellipse_at_top,black,transparent_55%)]"
      />

      <div className="mx-auto max-w-3xl">
        <BlurFade className="text-center">
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-balance sm:text-5xl">
            Questions, answered
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            Everything you need to know about the corpus, the API keys and
            your data. Can&apos;t find what you&apos;re looking for? We&apos;re a
            message away.
          </p>
        </BlurFade>

        <BlurFade delay={0.1} className="mt-14">
          <Accordion
            type="single"
            collapsible
            defaultValue="item-0"
            className="rounded-2xl border bg-card/80 px-6 shadow-sm backdrop-blur sm:px-8"
          >
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.question} value={`item-${i}`}>
                <AccordionTrigger className="py-5 text-base hover:no-underline hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pr-8 pb-5 text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </BlurFade>

        <BlurFade delay={0.2} className="mt-10">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed bg-muted/40 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
            <AvatarCircles
              people={SUPPORT_TEAM}
              aria-hidden
              className="shrink-0"
            />
            <div className="flex-1">
              <h3 className="font-medium">Still have questions?</h3>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                Questions, bugs and dataset requests are welcome on the
                GitHub repo.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              className="h-10 shrink-0 rounded-full px-5"
            >
              <a href="#">
                <MessageCircleIcon aria-hidden />
                Open an issue
              </a>
            </Button>
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
