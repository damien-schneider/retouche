# Retouche

A dev overlay for React apps. It puts a dot on every element whose call site overrides your design system's typography, and on every nested corner that doesn't fit the corner it sits in.

<p align="center">
  <img src=".github/assets/retouche-inspector.png" alt="The Retouche site's Properties section, each title overriding one typography property (larger, bold, serif, uppercase, orange) with a numbered orange arrow. The Retouche panel pinned on the right inspects the first Heading override: text-sm 14px replaced by text-[17px]/5 17px, traced from the call site to the component's source" width="100%">
</p>

`<Heading className="text-6xl">` compiles, passes review, and quietly forks the type scale. Retouche reads the rendered React tree, finds every `className` and `style` that changes the typography of a component you listed, and marks it on the page. Click a dot to see the call site, the component it overrides, and a before/after diff measured in the browser. Then fix the call site, or keep the override.

Retouche is on npm as [`retouche-dev`](https://www.npmjs.com/package/retouche-dev), since the `retouche` name belongs to another project.

## Quick start

Requires React 19, with Vite (TanStack Start and React Router included) or with Next.js 16 (App Router on Turbopack, its default dev bundler).

1. Copy the setup prompt from the site:

   ```text
   Set up Retouche in this React app by following https://retouche.dev/setup.md
   ```

2. Paste it into Claude Code, Codex, Cursor or any coding agent working in your app.
3. Open your app on localhost. Dots mark the overrides; click the count on the floating bar to open the panel.

<details>
<summary>What the agent does</summary>

1. Checks the stack and installs `retouche-dev` as a dev dependency.
2. Finds the design system, local or installed, and the components that style their own text or render ones that do, whatever styles them: Tailwind, CSS Modules, plain CSS, CSS-in-JS.
3. Copies the [starter config](packages/retouche/templates/retouche.config.ts) to `retouche.config.ts` and lists those components.
4. Wires the dev route, the instrument import and `<Retouche>`.
5. Checks what stands between the overlay and its route in development (dev hostnames, a Next.js proxy or middleware, security headers) and sets the editor code opens in.
6. Opens the app and reports how many overrides the first page shows.

</details>

<details>
<summary>Test an unreleased build from a clone</summary>

```bash
git clone https://github.com/damien-schneider/retouche.git
cd retouche
bun install
bun run --silent prompt | pbcopy
```

`bun run prompt` builds the package, packs it into `packages/retouche/retouche.tgz`, and prints [PROMPT.md](packages/retouche/PROMPT.md) installing that tarball instead of the npm release. `node packages/retouche/dist/cli.js prompt <tarball-url>` installs a tarball from a URL; without an argument the prompt installs from npm, which is what the site serves at `/setup.md`.

</details>

## What it does

- **Typography overrides.** Font size, line height, weight, family, tracking, case, decoration, figures and text color, set by Tailwind classes, CSS Modules, plain CSS, CSS-in-JS or inline `style`. `mt-4` and `w-full` stay silent.
- **Nested corners.** A button in a card's corner whose radius isn't the card's radius minus the gap between them gets flagged, with the radius that would fit.
- **Measured diffs.** `text-5xl 48px → text-6xl 60px`, read from the browser. Hold to compare previews the page without the override.
- **Code trace.** From the call site to the component's source, with a prompt for your agent at each step: use an existing variant, add one, or allow the override.
- **Picker and notes.** Aim at any element, write a note, and copy every note to your agent as markdown.
- **Render highlights.** Outlines each component as it renders, counts its renders and says what changed.
- **Voice sessions.** Talk while pointing at the page, and an agent turns it into feedback cards with annotated screenshots. Your coding agent can apply each card while you keep talking.
- **Dev only.** Production builds render nothing and install nothing.

Retouche reports and doesn't judge. Every override on a listed component is shown the same way; you decide whether it's wanted.

## Manual setup

```bash
npm install -D retouche-dev
```

### Vite

```ts
// vite.config.ts
import { retouche } from "retouche-dev/vite";

export default defineConfig({
  plugins: [react(), retouche()],
});
```

```tsx
// src/main.tsx
import "retouche-dev/instrument";
import { Retouche } from "retouche-dev";

import config from "../retouche.config";

createRoot(root).render(
  <>
    <App />
    <Retouche config={config} />
  </>
);
```

### Next.js (App Router)

```ts
// app/api/retouche/[...path]/route.ts
export { GET, POST } from "retouche-dev/next";
```

```ts
// instrumentation-client.ts
import "retouche-dev/instrument";
```

Render `<Retouche config={config} />` inside the root layout's `<body>`.

`retouche-dev/instrument` installs React's DevTools hook before React loads, in development only. Without it, dots and code still work; the measured diff, hold to compare and render highlights do not.

## Configuration

```ts
// retouche.config.ts
import { defineConfig } from "retouche-dev/config";

export default defineConfig({
  components: ["Heading", "Text", "Button"],
  allow: [
    { component: "Text", classes: ["text-muted-foreground"] },
    { component: "Button", properties: ["font-weight"] },
  ],
});
```

`components` lists the design-system components to watch. `allow` lists the overrides you want to keep; the inspector writes these entries for you. Every field, and the dev server's options, are in [docs/configuration.md](docs/configuration.md).

## Docs

| Doc | Read it to |
| --- | --- |
| [Using the overlay](docs/overlay.md) | Learn the dots, panel, inspector, picker, render highlights and keyboard shortcuts |
| [Voice sessions](docs/voice.md) | Record feedback by voice, have an agent apply it as you talk, and set up writers and speech-to-text |
| [Configuration](docs/configuration.md) | Look up every config field, dev server option and security header |
| [How it works](docs/how-it-works.md) | See how overrides are detected and measured, and what it costs on large pages |
| [Contributing](CONTRIBUTING.md) | Run the site locally, see the commands and find your way around the repository |

## Next

- Export the same check as a Biome Grit or ESLint plugin, so CI catches the overrides the overlay shows.
