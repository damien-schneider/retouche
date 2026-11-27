# Contributing

## Requirements

- [Bun 1.4.4](https://bun.sh/), the version pinned in `package.json`.
- Node.js, to run the CLI.

## Setup

```bash
bun install
bun run dev
```

The site runs at `http://localhost:4517`. In both local development and the static site build, the live overlay marks each Properties example as its override appears on scroll. You can hide the demo's arrows with the toolbar's dots switch; they return when you reload.

The site also hosts the setup prompt: every dev or build run writes `apps/site/public/setup.md`, which installs `retouche-dev` from npm. In dev the origin is `http://localhost:4517`; a build takes it from `SITE_URL` and fails without it.

For agents and crawlers, a build also writes `/robots.txt` (every crawler allowed, with Content Signals `search=yes, ai-input=yes, ai-train=yes`), `/sitemap.xml`, and the page as markdown at `/index.md`, converted from the prerendered `<main>` without its navigation, its buttons and anything `aria-hidden`. On Vercel, `vercel.json` serves that markdown at `/` to requests whose `Accept` includes `text/markdown`, and points to it from the page with a `Link` header.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Build the package and run the site with the overlay |
| `bun run build` | Build `packages/retouche/dist` |
| `SITE_URL=<origin> bun run build:site` | Build the package, then prerender the site to `apps/site/dist/client` with `/setup.md`, `/robots.txt`, `/sitemap.xml` and `/index.md` |
| `bun run pack` | Build and pack `packages/retouche/retouche.tgz` |
| `bun run prompt` | Pack, then print the setup prompt installing that tarball |
| `bun run test` | Run the package's Vitest suite (jsdom, real React rendering) |
| `bun run typecheck` | Type-check every workspace |
| `bun run check` | Lint with oxlint, check formatting with oxfmt |
| `bun run fix` | Apply oxlint fixes, then format with oxfmt |

## Releasing

The package is published to npm as `retouche-dev` by `.github/workflows/publish.yml`:

1. Bump `version` in `packages/retouche/package.json` and push it to `main`.
2. Tag that commit `v<version>` and push the tag: `git tag v0.2.0 && git push origin v0.2.0`.

The workflow fails when the tag and the version differ, then builds, checks, tests and runs `npm publish` with provenance. It authenticates through npm trusted publishing, so no npm token is stored in the repository.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `packages/retouche/src/rules` | Config schema, class and style grouping, allow matching, override detection, property diff, corner fit |
| `packages/retouche/src/client/fiber` | Fiber scan, call-site grouping, override stripping and measurement |
| `packages/retouche/src/client/dots` | Dot placement in document space, viewport windowing, the dots, the element outline |
| `packages/retouche/src/client/surface` | The one surface that is the bar, the panel or the narrow-screen sheet: dock geometry, pin, toolbar, the resize handle on the seam, and in `gestures/` snap drag, resize and the sheet's handle |
| `packages/retouche/src/client/panel` | Panel head and stepper, property lenses, overrides list, config issues |
| `packages/retouche/src/client/inspector` | Property diff, hold to compare, code trace, fix and allow prompts |
| `packages/retouche/src/client/picker` | Pick mode: the capture layer, keyboard aiming, drag-to-pick by area, the picked element's typography and code trace, the note card, markers, tray and the markdown copied for agents |
| `packages/retouche/src/client/corners` | Nested corner fit: the painted pairs measured near the viewport, their dots, rows, inspector block and prompts |
| `packages/retouche/src/client/renders` | Render highlights: the commit walk, the counts and what changed in `record/`, the flashes in `flashes/`, the switch and the list of components that rendered at the panel's foot in `footer/`, and the facts the panel and notes show |
| `packages/retouche/src/client/voice` | Voice sessions: the recorder, speech, pointing and screenshots in `record/`, the session kept in sync with the dev route and the agent runs in `session/`, the panel view in `view/` with past sessions in `view/history/`, the cards and annotated screenshots in `feedback/`, the outline on the page in `page/`, and in `follow/` the prompt that hands the session to your coding agent and what it reported on each card |
| `packages/retouche/src/client/stylesheets` | Typography properties the page's stylesheets give each class |
| `packages/retouche/src/client/code` | Source excerpt with marked classes, edge expanders that reveal the rest of the file on their side, editor links |
| `packages/retouche/src/client/route` | Dev route client and its availability state |
| `packages/retouche/src/client/shell` | Shadow-DOM portal, icons, hover targets, stored preferences, widget events |
| `packages/retouche/src/client/theme` | The app's light or dark theme read from the page, the choice that overrides it, and its switch |
| `packages/retouche/src/client/styles` | Overlay CSS as strings, injected into the shadow root |
| `packages/retouche/src/server` | Dev route handler, Vite plugin, Next.js route, source reader, and in `voice/` the voice sessions kept in the user's data folder and their history route, the writers behind one backend (the Claude Code, Codex and Mastra Code CLIs, ACP agents and OpenAI-compatible endpoints), the speech-to-text keys, and in `voice/follow/` the feed `retouche next` and `retouche mcp` serve to a following agent |
| `packages/retouche/src/protocol.ts` | The client and server wire contract |
| `packages/retouche/PROMPT.md` | The setup prompt handed to agents |
| `packages/retouche/templates` | Starter config |
| `apps/site` | TanStack Start site: the promotional page and, in dev, the overlay's test bed |
