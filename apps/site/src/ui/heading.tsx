import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./class-names";

const headingVariants = cva("text-ink text-balance", {
  defaultVariants: { size: "section" },
  variants: {
    size: {
      page: "text-base font-medium",
      section: "text-sm font-medium",
    },
  },
});

const HEADING_TAGS = { 1: "h1", 2: "h2", 3: "h3" } as const;

type HeadingProps = ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & { level?: keyof typeof HEADING_TAGS };

export function Heading({
  className,
  level = 2,
  size,
  ...props
}: HeadingProps) {
  const Tag = HEADING_TAGS[level];
  return (
    <Tag className={cn(headingVariants({ size }), className)} {...props} />
  );
}
