import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { retouche } from "retouche-dev/vite";
import { defineConfig, type Plugin } from "vite";

import { pageMarkdown } from "./page-markdown.ts";
import { fetchStars } from "./src/home/github-stars.ts";

const DEV_PORT = 4517;
const PACKAGE = new URL("../../packages/retouche/", import.meta.url);
const PUBLIC = new URL("public/", import.meta.url);
const CLIENT_OUTPUT = fileURLToPath(new URL("dist/client/", import.meta.url));
const ROBOTS_RULES = [
  "User-agent: *",
  "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
  "Allow: /",
];

function siteOrigin(): string {
  const siteUrl = process.env.SITE_URL;
  if (siteUrl === undefined || siteUrl === "") {
    throw new Error(
      "SITE_URL is unset. The site's links, sitemap and setup prompt use its public origin: SITE_URL=https://… bun run build:site"
    );
  }
  return new URL(siteUrl).origin;
}

function writeSetupFile(): void {
  const prompt = execFileSync(
    "node",
    [fileURLToPath(new URL("dist/cli.js", PACKAGE)), "prompt"],
    { encoding: "utf-8" }
  );
  writeFileSync(new URL("setup.md", PUBLIC), prompt);
}

function hostedFiles(origin: string): Plugin {
  return {
    config(_, { isPreview }) {
      if (isPreview === true) {
        return;
      }
      mkdirSync(PUBLIC, { recursive: true });
      writeSetupFile();
      writeFileSync(
        new URL("robots.txt", PUBLIC),
        [...ROBOTS_RULES, "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n")
      );
      return { define: { "import.meta.env.SITE_URL": JSON.stringify(origin) } };
    },
    name: "site:hosted-files",
  };
}

function githubStars(): Plugin {
  return {
    async config(_, { isPreview }) {
      if (isPreview === true) {
        return;
      }
      const stars = await fetchStars(AbortSignal.timeout(5000));
      return {
        define: { "import.meta.env.GITHUB_STARS": JSON.stringify(stars) },
      };
    },
    name: "site:github-stars",
  };
}

export default defineConfig(({ command }) => {
  const origin =
    command === "serve" ? `http://localhost:${DEV_PORT}` : siteOrigin();
  return {
    build: {
      rolldownOptions: { output: { keepNames: true } },
      sourcemap: true,
    },
    plugins: [
      hostedFiles(origin),
      githubStars(),
      tailwindcss(),
      tanstackStart({
        prerender: {
          enabled: true,
          onSuccess: ({ html, page }) => {
            writeFileSync(
              join(CLIENT_OUTPUT, page.path, "index.md"),
              pageMarkdown(html, `${origin}${page.path}`)
            );
          },
        },
        sitemap: { enabled: true, host: origin },
      }),
      react(),
      retouche(),
    ],
    server: { port: DEV_PORT },
  };
});
