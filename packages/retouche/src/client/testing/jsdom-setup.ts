import { beforeEach } from "vitest";

import { stubSystemTheme } from "./system-theme";

beforeEach(() => {
  stubSystemTheme("light");
});
