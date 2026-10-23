/**
 * The landing page, assembled entirely from Velora UI's own blocks
 * (`components/velora/blocks/*`, copied verbatim from ColorlibHQ/velora-ui).
 *
 * Nothing here is hand-built: this file is just the running order. The copy
 * lives in each block's module-level consts, which is where the block author
 * intends it to be edited.
 */
import { NavbarFloating } from "@/components/velora/blocks/navbar-floating";
import { HeroAurora } from "@/components/velora/blocks/hero-aurora";
import { LogosMarquee } from "@/components/velora/blocks/logos-marquee";
import { FeaturesBento } from "@/components/velora/blocks/features-bento";
import { FeaturesSteps } from "@/components/velora/blocks/features-steps";
import { TestimonialsGrid } from "@/components/velora/blocks/testimonials-grid";
import { FaqAccordion } from "@/components/velora/blocks/faq-accordion";
import { CtaSplitImage } from "@/components/velora/blocks/cta-split-image";
import { FooterColumns } from "@/components/velora/blocks/footer-columns";

export const metadata = {
  title: "California Law",
  description:
    "California law, researched in seconds. Corpus plus web, every claim cited.",
};

export default function RedesignPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <NavbarFloating />
      <HeroAurora />
      <LogosMarquee />
      <FeaturesBento />
      <FeaturesSteps />
      <TestimonialsGrid />
      <FaqAccordion />
      <CtaSplitImage />
      <FooterColumns />
    </div>
  );
}
