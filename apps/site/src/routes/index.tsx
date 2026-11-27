import { createFileRoute } from "@tanstack/react-router";
import { domMin, LazyMotion } from "motion/react";

import { BarArrow } from "../home/bar-arrow";
import { ConceptSection } from "../home/concepts/concept-section";
import { PROPERTY_CONCEPTS } from "../home/concepts/property-concepts";
import { Intro } from "../home/intro";
import { Sidebar } from "../home/sidebar";
import { SiteCredits, SiteHeader } from "../home/site-header";
import { OverlayStory } from "../home/story/overlay-story";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <LazyMotion features={domMin} strict>
      <main className="@container relative">
        <div className="relative z-10 w-fit @4xl:sticky @4xl:top-0">
          <SiteHeader />
          <Sidebar />
        </div>
        <SiteCredits />
        <div className="mx-auto flex max-w-[640px] flex-col gap-20 px-6 pt-16 @2xl:px-8">
          <Intro />
          <ConceptSection group={PROPERTY_CONCEPTS} />
          <OverlayStory />
        </div>
      </main>
      <BarArrow />
    </LazyMotion>
  );
}
