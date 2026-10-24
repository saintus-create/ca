import { BlurFade } from "@/components/velora/blur-fade";
import { Button } from "@/components/velora/ui/button";

/**
 * Centered hero with a drifting aurora, a dotted backdrop and staggered
 * copy. Replace the copy and links; everything else re-themes from your
 * brand tokens.
 */
export function HeroAurora() {
  return (
    <section className="relative isolate overflow-hidden px-6 py-16 sm:py-20 lg:px-8">
      <div className="relative mx-auto max-w-3xl">
        <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-6xl">
          The whole of California law,{" "}
          <span className="text-muted-foreground">one search away</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
          Every California code, the Rules of Court and the Judicial Council
          forms, in one search. Answers cite the section they rest on.
        </p>

        <BlurFade delay={0.3}>
          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 rounded-full px-6 text-[15px]">
              <a href="#research">Start researching</a>
            </Button>
          </div>
        </BlurFade>

      </div>
    </section>
  );
}
