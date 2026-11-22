import { z } from "zod";

import { WATCHED_GROUPS } from "./class-groups";

const allowEntrySchema = z
  .object({
    classes: z.array(z.string().min(1)).optional(),
    component: z.string().min(1).optional(),
    properties: z.array(z.enum(WATCHED_GROUPS)).optional(),
  })
  .refine(
    (entry) =>
      (entry.classes ?? []).length > 0 || (entry.properties ?? []).length > 0,
    {
      message:
        "An allow entry needs `classes` or `properties` to let anything through.",
    }
  );

export const retoucheConfigSchema = z.object({
  allow: z.array(allowEntrySchema).optional(),
  components: z.array(z.string().min(1)).min(1),
});

export type RetoucheConfig = z.infer<typeof retoucheConfigSchema>;
export type AllowEntry = z.infer<typeof allowEntrySchema>;

export function defineConfig(config: RetoucheConfig): RetoucheConfig {
  return config;
}
