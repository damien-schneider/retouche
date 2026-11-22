#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { WATCHED_GROUPS } from "./rules/class-groups";

const USAGE = `Usage: retouche prompt [tarball-url]

  Print the setup prompt to hand to your coding agent.
  Without a URL, the prompt installs the local tarball:
  run \`bun run pack\` in the retouche repo first.\n`;

const tarballUrl = z.url({ protocol: /^https?$/ });

function localTarball(): string | null {
  const tarball = fileURLToPath(new URL("../retouche.tgz", import.meta.url));
  if (existsSync(tarball)) {
    return tarball;
  }
  process.stderr.write(`No tarball at ${tarball}\n\n${USAGE}`);
  return null;
}

function tarballLocation(argument: string | undefined): string | null {
  if (argument === undefined) {
    return localTarball();
  }
  const url = tarballUrl.safeParse(argument);
  if (url.success) {
    return url.data;
  }
  process.stderr.write(`Not an http(s) URL: ${argument}\n\n${USAGE}`);
  return null;
}

function printPrompt(tarball: string): void {
  const prompt = readFileSync(
    new URL("../PROMPT.md", import.meta.url),
    "utf-8"
  );
  process.stdout.write(
    prompt
      .replaceAll("{{RETOUCHE_TARBALL}}", tarball)
      .replaceAll(
        "{{PROPERTIES}}",
        WATCHED_GROUPS.map((group) => `\`${group}\``).join(", ")
      )
  );
}

if (process.argv[2] === "prompt") {
  const tarball = tarballLocation(process.argv[3]);
  if (tarball === null) {
    process.exitCode = 1;
  } else {
    printPrompt(tarball);
  }
} else {
  process.stdout.write(USAGE);
  process.exitCode = (process.argv[2] ?? "") === "" ? 0 : 1;
}
