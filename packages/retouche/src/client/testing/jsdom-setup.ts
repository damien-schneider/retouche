import React from "react";
import { beforeEach } from "vitest";
import { z } from "zod";

import { stubSystemTheme } from "./system-theme";

const REACT_INTERNALS =
  "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE";

const ownerStackBudgetSchema = z.object({
  recentlyCreatedOwnerStacks: z.number(),
});

type OwnerStackBudget = z.infer<typeof ownerStackBudgetSchema>;

function holdsOwnerStackBudget(value: unknown): value is OwnerStackBudget {
  return ownerStackBudgetSchema.safeParse(value).success;
}

function giveEachTestAFreshPageLoad() {
  const internals: unknown =
    REACT_INTERNALS in React ? React[REACT_INTERNALS] : undefined;
  if (!holdsOwnerStackBudget(internals)) {
    throw new Error(
      "React no longer exposes recentlyCreatedOwnerStacks: tests would share one budget of recorded call sites"
    );
  }
  internals.recentlyCreatedOwnerStacks = 0;
}

beforeEach(() => {
  stubSystemTheme("light");
  giveEachTestAFreshPageLoad();
});
