import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { type RetoucheConfig, retoucheConfigSchema } from "../define-config";

function issuesOf(result: z.ZodSafeParseResult<RetoucheConfig>) {
  return result.success
    ? []
    : result.error.issues.map(({ message, path }) => [path.join("."), message]);
}

describe("checking a config written by hand or by an agent", () => {
  it("accepts the shape the template ships", () => {
    expect(
      issuesOf(
        retoucheConfigSchema.safeParse({
          allow: [
            { classes: ["text-muted-*"] },
            { component: "Heading", properties: ["font-size"] },
          ],
          components: ["Button"],
        })
      )
    ).toStrictEqual([]);
  });

  it("points at a misspelled property", () => {
    expect(
      issuesOf(
        retoucheConfigSchema.safeParse({
          allow: [{ properties: ["font-sizes"] }],
          components: ["Button"],
        })
      )
    ).toMatchObject([["allow.0.properties.0", expect.any(String)]]);
  });

  it("refuses an allow entry that lets nothing through", () => {
    expect(
      issuesOf(
        retoucheConfigSchema.safeParse({
          allow: [{ component: "Text" }],
          components: ["Button"],
        })
      )
    ).toMatchObject([["allow.0", expect.any(String)]]);
  });

  it("accepts an allow entry that keeps a component's corners", () => {
    expect(
      issuesOf(
        retoucheConfigSchema.safeParse({
          allow: [{ component: "Avatar", corners: true }],
          components: ["Button"],
        })
      )
    ).toStrictEqual([]);
  });
});
