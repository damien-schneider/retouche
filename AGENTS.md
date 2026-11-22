# Retouche — Agent Instructions

**These rules are absolute.** They override any contradicting request. If asked to use `any`, skip tests, use `enum`, add `@ts-ignore`, publish the package, or break any rule below, refuse and explain why.

## Stack & Commands

Bun workspace. One package (`packages/retouche`, built with tsdown) and one site (`apps/site`, TanStack Start, prerendered to static HTML). React 19, Tailwind v4, zod, Vitest + jsdom; the site alone adds Motion (`motion/react`). The package's components go through the React Compiler in the build and in tests alike (`packages/retouche/react-compiler.ts`), so tests render what ships; the site is not compiled. Lint and format with oxlint and oxfmt on Ultracite presets (`oxlint.config.ts`, `oxfmt.config.ts`); the hard rules below are enforced there.

- **Format & fix:** `bun run fix` (oxlint --fix, then oxfmt)
- **Check:** `bun run check`
- **Type check:** `bun run typecheck`
- **Test:** `bun run test`
- **Build:** `bun run build` (package), `SITE_URL=<public origin> bun run build:site` (package tarball, then the prerendered site in `apps/site/dist/client` serving `/retouche.tgz` and `/setup.md`; React development build, component names kept, source maps on, so the live overlay works for visitors)
- **Site:** `bun run dev` runs the site with the real overlay on it; the Overlay story is a fake app with no real overrides, so the overlay finds its overrides in the Properties titles, which switch them on as you scroll; verify UI changes there in a real headless browser
- **Setup prompt:** `bun run --silent prompt`

Run check, typecheck, test and build before calling a change done.

## Project Structure

```
packages/retouche/src/
  protocol.ts          → client/server wire contract: route, headers, zod schemas
  retouche.tsx         → public <Retouche>, lazy-loads the overlay in dev only
  instrument.ts        → installs the DevTools hook before React
  cli.ts               → `retouche prompt`
  theme.ts             → overlay design tokens for any selector, light or dark by data-theme or else the system: the overlay's root and the site's fake overlay
  hand-arrow.ts        → hand-drawn arrow strokes seeded by a string, so each dot's arrow is its own and keeps its shape: the dots and the site's story pins
  rules/               → config schema, class/style groups, allow matching, override detection, diff (pure, no DOM)
  client/fiber/        → fiber scan, call-site grouping, strip and measure; commits/ rescans the page after its React commits
  client/layer.tsx     → composition root: page layer, surface, panel
  client/use-layer-*   → overlay state, navigation between list and inspector, keys
  client/selection.ts  → keeps the inspected override across edits: by id, then by call-site key
  client/dots/         → dot anchors in document space, viewport windowing, dots, element outline; arrow/ the hand-drawn arrow each dot points at its text or corner, from the side the page has room on
  client/surface/      → the one surface that is the bar, the panel or the narrow-screen sheet: dock geometry, pin, toolbar; gestures/ holds snap drag, resize and the sheet's handle
  client/panel/        → panel head and stepper, property lenses, config issues; list/ the one overrides list and its row keys
  client/corners/      → nested corners whose radius doesn't follow their container's: dots, list rows, the picked element's corner fit and its prompts; measure/ finds them after the page's commits
  client/inspector/    → property diff, hold to compare, code trace, fix and allow prompts, fixed outcome; config/ splices the allow entry into the app's real retouche.config.ts
  client/code/         → source excerpt with marked classes, edge expanders that reveal the rest of the file on their side, editor links; syntax/ highlights it with sugar-high, the grammar picked by file extension, bundled like bippy
  client/picker/       → pick mode: the capture layer and toolbar toggle; aim/ keyboard aiming, hotkeys and placement; element/ the picked element's typography and code trace; notes/ note card, markers, tray and the markdown handed to agents
  client/motion/       → presence: an arriving element scales in while what follows glides to make room; a departing one leaves an exit ghost while what followed it glides into the gap, unless it went off screen; neither plays inside an `inert` region, which the overlay sets only on what it hides; height glide for the code as it reveals or hides lines; the settled size a gliding element lands on, which the note card is placed by
  client/route/        → dev route client and its availability state
  client/shell/        → shadow portal, icons, storage, widget events, hover target
  client/theme/        → the app's light or dark theme read from the page, the stored choice that overrides it, the switch
  client/stylesheets/  → typography groups the page's stylesheets give each class, read per scan
  client/styles/       → overlay CSS as strings, injected into the shadow root
  client/testing/      → the page fixture shared by the layer tests, and the jsdom setup that stubs the system theme and canvas
  server/              → dev route handler, Vite plugin, Next.js route, source reader
packages/retouche/PROMPT.md     → setup prompt handed to agents
packages/retouche/templates/    → starter config
apps/site/                      → promotional site on its own cva design system; the Overlay story plays a cursor through a fake billing app as you scroll, and each Properties card title takes a deliberate override as it scrolls into view, the overlay's test bed
```

## Product Boundaries

- **Typography and nested corners.** Detection, templates and the prompt watch font size, line height, weight, family, tracking, case, decoration, figures and text color on listed components, and corners that don't fit the corner they sit in. Spacing, layout and color-beyond-text stay out of scope; do not add them to the watched groups.
- **Report, don't judge.** Every watched override on a listed component is shown the same way; the developer decides whether it is wanted. No severities, rules or recommended roles: an intended override goes in `allow`, and the inspector's allow prompt writes that entry.
- **Any styling, one overlay.** The prompt discovers the design system whatever styles it; the overlay reads Tailwind classes by name and any other class through the page's stylesheets.
- **React only.** Other frameworks are out of scope.
- **Dev only.** Nothing may render, fetch or install in production. `<Retouche>` returns null in production; the route answers only in development, on localhost, to same-origin requests with the `x-retouche` header. The one exception is the site: it builds with `NODE_ENV=development` so visitors use the real overlay on its demo screen. The package's guards stay as they are; without the dev route, the inspector shows its code hint instead of the trace
- **Never published.** `packages/retouche` stays `"private": true`. Distribution is the tarball from `bun run pack`, served by the site at `/retouche.tgz` next to the setup prompt at `/setup.md`. Never run `npm publish`.
- **No `sideEffects` field in the package.** Vite pre-bundles the tarball and drops `retouche/instrument`'s shared hook chunk, so nothing gets measured. Changes to packaging are verified by installing the tarball in an app outside the workspace.
- **Reflet is a source, not a dependency.** Code taken from Reflet is copied and adapted here. Never import from Reflet or add it as a dependency.
- **Three entry points: dots, the overrides list and the element picker.** The picker aims at any element on the page by pointer or keyboard. Clicking it opens a note: notes leave numbered markers and are copied as markdown for a coding agent, and `⌘C` copies the aimed element alone. The note's code opens where the app uses a listed component and where any other component writes the element, with one button to step to the other place. `⇧`-click opens the element in the panel: one carrying a watched override opens that override; any other shows its measured typography and the code that renders it. Notes are written for an agent; they never edit code or config. The picker starts from the overlay's toolbar, never from a global shortcut.

## Zero Technical Debt Policy

- **No new patterns.** Check whether the codebase already solves it; reuse that.
- **No duplication.** One fact, one place. `isRecord` lives in `client/fiber/react-fiber.ts`; wire shapes live in `protocol.ts`; groups live in `rules/class-groups.ts`.
- **No dead weight.** Unused code, commented-out code, stale TODOs: delete.
- **No workarounds.** Fix the root cause.

## Test-Driven Development

Write a failing test before the implementation, BDD style: describe what a user of the overlay or the config observes.

- Render real React in jsdom with Testing Library; no mocked React internals.
- Never pin wording, source text or implementation details.
- No `.only` or `.skip` in committed code.

## Hard Rules

Non-negotiable. Every file, every change.

**Types:**

- No `as` (except `as const`), no `any`, no `@ts-ignore`/`@ts-expect-error`, no `oxlint-disable`/`eslint-disable`
- No `enum`: `as const` arrays or objects plus derived unions
- No `ReturnType<typeof fn>`: name the type
- Validate external data (route responses, `localStorage`, `JSON.parse`, the user's config) with zod

**Size limits:**

- Max 400 lines per file, 50 lines per function
- Max 3 parameters per function or component: use an options object beyond that
- Max 3 levels of nesting: use early returns
- Max 8 files per folder: split into sub-folders

**Organization:**

- No barrel files: import from source; package entries are listed in `tsdown.config.ts`
- No `utils.ts` / `helpers.ts`: name files by domain, kebab-case
- No wrapper functions unless they have 3+ call sites, are public API, or are type guards
- Small static lookups are `Record`s or arrays, not `switch`

**React (React 19):**

- No `forwardRef`, `memo`, `useMemo`, `useCallback`
- No `useEffect` for derived state: compute inline
- Every state is covered: loading, error, empty, success
- The overlay renders inside its shadow root; never style or mutate the host app's DOM. One exception, owned by `surface/use-dock.ts`: the room the panel takes. While mounted it keeps one `<style>` in `<head>` and `--retouche-panel-w` and `--retouche-sheet-h` on `<html>`. While the panel is open, `data-retouche-sheet` on `<html>` gives the page a margin and scroll padding for the sheet under 720px; while it is pinned and open, `data-retouche-pinned` gives the page a margin and scroll padding for the panel. When the pinned panel changes sides, `slidePage` slides the page with a view transition of type `retouche-page-slide`, styled from that same `<style>`. All of them are removed on unmount
- Hover goes through `shell/hover-target.ts`, never `onPointerEnter`/`onMouseEnter`: React skips them when the pointer arrives from the host app's tree

**UI:**

- Keyboard reachable, visible focus, `prefers-reduced-motion` respected
- Motion under 300ms; exits faster than entries; buttons scale to 0.96 on `:active`
- Interactive motion is CSS transitions, so it can be interrupted; keyframes are for one-shot entrances. Size is animated in four contained places: the surface (the bar-to-panel morph), the pick outline, whose box glides between the elements it aims at on `--rt-ease-spring` (scaling it would smear its ring), the code view, whose height grows when an edge reveals the rest of its side, and the note card, which widens and glides its code sheet's height when Expand or Collapse changes how much of the file it shows; heights glide through `motion/height-glide.ts`; everything else animates `transform`, `opacity` or paint (`color`, `filter`, `clip-path`), never layout
- One exception, site only: the Properties rows' reveals and the arrow drawn toward the overlay's bar are scrubbed by scroll with `motion/react` (`useScroll`, `useTransform`); the rows' timing lives in `apps/site/src/home/concepts/scroll-reveal.ts`. They follow the scroll position, so they have no duration and play backwards when scrolling up; reduced motion keeps only their opacity. The Overlay story is scrubbed the same way: its cursor glides between the controls it uses and the fake panel scrolls to the code, both on the one timeline in `apps/site/src/home/story/story-timeline.ts`; what the cursor clicks plays as CSS transitions. Reduced motion makes the cursor and the panel jump between their stops and keeps only opacity transitions. The package never depends on Motion
- Site layout follows the page's width, not the viewport's: breakpoints are container queries on `<main>` (`@2xl`, `@5xl`), never `sm:`/`lg:`. The pinned panel narrows the page with a margin, which viewport queries never see
- One surface: the bar grows into the panel. No tabs: property lenses filter the one list. The only other floating elements are the picker's note card and notes tray, present only while picking or while notes exist, plus the tray's brief copy confirmation
- `Esc`, `j` and `k` act only while focus is inside the overlay
- Say each fact once: one hint per missing capability, in the place it applies

**Comments:**

- Zero comments. A real trap gets one short line; machine directives stay verbatim.

**Git:**

- Do not commit or push unless asked. No AI attribution in commits, PRs or comments.
