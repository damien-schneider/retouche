import * as m from "motion/react-m";

import { cn } from "../../ui/class-names";
import { Heading } from "../../ui/heading";
import type { ConceptGroup } from "./concept-section";
import { CornerSpecimens } from "./corner-specimens";
import { useRise } from "./scroll-reveal";

function PropertiesIcon() {
  return (
    <span
      aria-hidden="true"
      className="text-brand w-3.5 text-[11px] leading-none font-semibold"
    >
      Aa
    </span>
  );
}

function Specimens({ samples }: { samples: readonly string[] }) {
  return (
    <div className="flex items-baseline gap-4 leading-none">
      {samples.map((sample, step) => (
        <Specimen key={sample} sample={sample} step={step} />
      ))}
    </div>
  );
}

function Specimen({ sample, step }: { sample: string; step: number }) {
  const rise = useRise(step);
  return (
    <m.span {...rise} className={cn("text-[34px]", sample)}>
      Aa
    </m.span>
  );
}

function OversizedTitle({ children }: { children: string }) {
  return (
    <Heading className="text-[17px]/5" level={3}>
      {children}
    </Heading>
  );
}

function BoldTitle({ children }: { children: string }) {
  return (
    <Heading className="font-bold" level={3}>
      {children}
    </Heading>
  );
}

function SerifTitle({ children }: { children: string }) {
  return (
    <Heading className="font-serif" level={3}>
      {children}
    </Heading>
  );
}

function UppercaseTitle({ children }: { children: string }) {
  return (
    <Heading className="tracking-wide uppercase" level={3}>
      {children}
    </Heading>
  );
}

function BrandTitle({ children }: { children: string }) {
  return (
    <Heading className="text-brand" level={3}>
      {children}
    </Heading>
  );
}

export const PROPERTY_CONCEPTS: ConceptGroup = {
  concepts: [
    {
      art: (
        <Specimens
          samples={["text-faint text-base", "text-faint text-2xl", "text-ink"]}
        />
      ),
      description: "A font size or line height set at the call site.",
      id: "size",
      override: OversizedTitle,
      title: "Size",
    },
    {
      art: (
        <Specimens
          samples={[
            "text-faint font-light",
            "text-faint font-medium",
            "text-ink font-bold",
          ]}
        />
      ),
      description: "A font weight set at the call site.",
      id: "weight",
      override: BoldTitle,
      title: "Weight",
    },
    {
      art: (
        <Specimens samples={["text-faint font-sans", "text-ink font-serif"]} />
      ),
      description: "A font family set at the call site.",
      id: "family",
      override: SerifTitle,
      title: "Family",
    },
    {
      art: (
        <Specimens
          samples={[
            "text-faint underline decoration-2 underline-offset-4",
            "text-faint italic",
            "text-ink uppercase",
          ]}
        />
      ),
      description:
        "Tracking, case, italics, underline or figures set at the call site.",
      id: "texture",
      override: UppercaseTitle,
      title: "Texture",
    },
    {
      art: <Specimens samples={["text-ink", "text-muted", "text-brand"]} />,
      description:
        "A text color set at the call site. This site allows ink and muted in its config.",
      id: "text-color",
      override: BrandTitle,
      title: "Text color",
    },
    {
      art: <CornerSpecimens />,
      description:
        "A corner that doesn’t follow the curve it sits in. A pill in a pill or an avatar circle fits.",
      id: "corners",
      title: "Corners",
    },
  ],
  Icon: PropertiesIcon,
  id: "properties",
  lead: "What Retouche watches. The titles below override each one as you scroll, and the first tile’s corner stops fitting.",
  title: "Properties",
};
