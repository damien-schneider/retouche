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
        <div className="@4xl:pointer-events-none @4xl:absolute @4xl:inset-y-0 @4xl:left-0 @4xl:z-10">
          <div className="@4xl:pointer-events-auto @4xl:sticky @4xl:top-0">
            <SiteHeader />
            <Sidebar />
          </div>
        </div>
        <SiteCredits />
        <div className="mx-auto flex max-w-[640px] flex-col gap-20 px-6 pt-16 @2xl:px-8 @4xl:pt-28">
          <Intro />
          <ConceptSection group={PROPERTY_CONCEPTS} />
          <OverlayStory />
        </div>
      </main>
      <BarArrow />
    </LazyMotion>
  );
}
