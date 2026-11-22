import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "./class-names";

const textVariants = cva("text-ink", {
  defaultVariants: { size: "body" },
  variants: {
    size: {
      body: "text-muted text-sm/5",
      small: "text-muted text-xs",
    },
  },
});

export function Text({
  className,
  size,
  ...props
}: ComponentProps<"p"> & VariantProps<typeof textVariants>) {
  return <p className={cn(textVariants({ size }), className)} {...props} />;
}
