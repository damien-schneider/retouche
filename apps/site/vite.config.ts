import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { retouche } from "retouche/vite";
import { defineConfig, type Plugin } from "vite";
import { z } from "zod";

import { REPOSITORY } from "./src/credits.ts";

const DEV_PORT = 4517;
const PACKAGE = new URL("../../packages/retouche/", import.meta.url);
const PUBLIC = new URL("public/", import.meta.url);
const TARBALL = "retouche.tgz";

function siteOrigin(): string {
  const siteUrl = process.env.SITE_URL;
  if (siteUrl === undefined || siteUrl === "") {
    throw new Error(
      "SITE_URL is unset. The site serves the setup prompt and the tarball from its own origin: SITE_URL=https://… bun run build:site"
    );
  }
  return new URL(siteUrl).origin;
}

function writeSetupFiles(origin: string): void {
  const tarball = new URL(TARBALL, PACKAGE);
  if (!existsSync(tarball)) {
    throw new Error(`No ${fileURLToPath(tarball)}: run bun run pack first`);
  }
  mkdirSync(PUBLIC, { recursive: true });
  copyFileSync(tarball, new URL(TARBALL, PUBLIC));
  const prompt = execFileSync(
    "node",
    [
      fileURLToPath(new URL("dist/cli.js", PACKAGE)),
      "prompt",
      `${origin}/${TARBALL}`,
    ],
    { encoding: "utf-8" }
  );
  writeFileSync(new URL("setup.md", PUBLIC), prompt);
}

function hostedSetup(): Plugin {
  return {
    config(_, { command, isPreview }) {
      if (isPreview === true) {
        return;
      }
      const origin =
        command === "serve" ? `http://localhost:${DEV_PORT}` : siteOrigin();
      writeSetupFiles(origin);
      return { define: { "import.meta.env.SITE_URL": JSON.stringify(origin) } };
    },
    name: "site:hosted-setup",
  };
}

const GITHUB_REPOSITORY = z.object({
  stargazers_count: z.number().int().nonnegative(),
});

async function requestRepository(): Promise<Response | null> {
  try {
    return await fetch(`https://api.github.com/repos/${REPOSITORY}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
}

async function fetchStars(): Promise<number | null> {
  const response = await requestRepository();
  if (response === null || !response.ok) {
    return null;
  }
  return GITHUB_REPOSITORY.parse(await response.json()).stargazers_count;
}

function githubStars(): Plugin {
  return {
    async config(_, { isPreview }) {
      if (isPreview === true) {
        return;
      }
      const stars = await fetchStars();
      return {
        define: { "import.meta.env.GITHUB_STARS": JSON.stringify(stars) },
      };
    },
    name: "site:github-stars",
  };
}

export default defineConfig({
  build: { rolldownOptions: { output: { keepNames: true } }, sourcemap: true },
  plugins: [
    hostedSetup(),
    githubStars(),
    tailwindcss(),
    tanstackStart({ prerender: { enabled: true } }),
    react(),
    retouche(),
  ],
  server: { port: DEV_PORT },
});
