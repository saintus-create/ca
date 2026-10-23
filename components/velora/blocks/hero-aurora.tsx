import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/velora/ui/button";
import { BlurFade } from "@/components/velora/blur-fade";
import { DotPattern } from "@/components/velora/grid-pattern";
import { ShimmerButton } from "@/components/velora/shimmer-button";

/**
 * Centered hero with a drifting aurora, a dotted backdrop and staggered
 * copy. Replace the copy and links; everything else re-themes from your
 * brand tokens.
 */
export function HeroAurora() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-24 sm:py-32 lg:px-8">
      <DotPattern
        aria-hidden
        className="absolute inset-0 -z-10 size-full fill-foreground/10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <BlurFade>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <SparklesIcon className="size-4 text-primary" />
            Now indexing all 36 California datasets
            <ArrowRightIcon className="size-3.5" />
          </a>
        </BlurFade>

        <h1 className="mt-8 text-4xl font-medium tracking-tight text-balance sm:text-6xl">
          The whole of California law,{" "}
          <span className="text-muted-foreground">one search away</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
          California Law reads every California code, the Rules of Court and
          the Judicial Council forms, then reasons over them live and cites the
          exact section behind each answer.
        </p>

        <BlurFade delay={0.3}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ShimmerButton>Start researching</ShimmerButton>
            <Button variant="ghost" size="lg" asChild>
              <a href="#">
                Explore the corpus <ArrowRightIcon />
              </a>
            </Button>
          </div>
        </BlurFade>

        <BlurFade delay={0.4}>
          <p className="mt-8 text-sm text-muted-foreground">
            36 datasets indexed · Bring your own Anthropic key
          </p>
        </BlurFade>
      </div>
    </section>
  );
}
