import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/velora/ui/accordion";
import { BlurFade } from "@/components/velora/blur-fade";

const FAQS = [
  {
    question: "What does it actually search?",
    answer:
      "The California codes, the Rules of Court, the Judicial Council forms and case law annotations held on this site, and the live web.",
  },
  {
    question: "Do I need an API key?",
    answer:
      "No. The site runs on keys set up by its operator, so there is nothing to bring and nothing to paste in. Web search is included whenever it is switched on for the deployment.",
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
    question: "Is my data stored?",
    answer:
      "No. Requests are stateless and questions are not kept. The one exception is an optional web search key you can add in the interface, and that stays in your browser.",
  },
];

/**
 * Centered FAQ: a single-open accordion of common questions, then a
 * contact row for anything the list doesn't answer.
 */
export function FaqAccordion() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-16 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <BlurFade>
          <h2 className="text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Common questions
          </h2>
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

      </div>
    </section>
  );
}
