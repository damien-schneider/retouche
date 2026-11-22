Set up Retouche in this React app. Retouche is a dev-only overlay: it puts a dot on every element where a call site overrides the typography of a design-system component (`<Text className="text-lg font-bold">`, `<Badge className={styles.loud}>`, `<Heading style={{ fontSize: 40 }}>`). It also dots every nested corner that doesn't follow the curve of the container it sits in. Clicking a dot shows which properties the override changes, what it replaced, and the code behind it. Retouche does not judge: the developer decides, override by override, whether to fix the call site or allow it.

Work through these steps in order. Stop and tell me if a precondition fails instead of working around it.

## 1. Check the stack

- React 19 or later is required. React 18 or another UI framework: stop and tell me.
- Supported dev servers: Vite, or Next.js 16 with the App Router on Turbopack, its default. Anything else, a Next dev script with `--webpack` included: stop and tell me.
- In a monorepo, work in the app that runs the dev server. If several apps could be meant, ask which.
- Any styling approach works: Tailwind, CSS Modules, plain CSS or Sass classes, CSS-in-JS that emits class names, inline `style`. Note which ones this app uses.
- Retouche reads the `className` and `style` a call site passes. If call sites change typography mostly through other props (`sx`, the `css` prop, style props such as `fontSize="lg"`), stop and tell me: those are not read.

## 2. Install

Add Retouche as a dev dependency from this tarball, with the project's own package manager:

```
{{RETOUCHE_TARBALL}}
```

For example `bun add -d <tarball>`, `pnpm add -D <tarball>` or `npm install -D <tarball>`.

## 3. Find the design system

The design system is the set of components the app builds its screens from. It can be a local folder (`components/ui`), a workspace package, a package installed from npm, or several of these; local components that wrap library ones belong to it.

Find where it decides typography, whatever the styling approach:

- Tailwind: utilities in the component definitions (cva variants, a `cn(...)` base string) and the theme (`@theme` in CSS or `tailwind.config`).
- CSS Modules, plain CSS, Sass: the stylesheets the components import, and the rules in them that set typography, whether they target classes or the components' data attributes (`[data-slot="title"]`).
- CSS-in-JS (styled-components, Emotion, Panda, vanilla-extract…): the styled definitions and the theme tokens they read.
- Tokens: CSS custom properties or a theme object that names sizes, weights and families.

Then list the components to watch. A design-system component belongs on the list when either holds:

- It styles its own text: its definition sets any of these properties, by class, variant, stylesheet or CSS that targets it: {{PROPERTIES}}. Typically `Text`, `Heading`, `Button`, `Badge`, `Label`, `Link`.
- It renders a component on the list and passes it classes or styles: a `MarkdownH2` that renders `<Heading className="text-2xl">`, a `SidebarTrigger` that renders `<Button>`. Retouche trusts what a listed component renders, so a component like this left off the list shows its own JSX as an override wherever it appears. Unexported helpers inside the design system count too.

Leave out the ones that do neither, such as providers and layout primitives (`Stack`, `Box`, `Grid`): Retouche checks typography, not spacing. For a design system installed as a package, start from the components the app imports from it and read the package's files in `node_modules` to sort them.

Write each name as React sees it: the component's `displayName` when it sets one, otherwise its function name. That is `CardTitle` rather than `Card.Title`, and never the file name. A component without a name of its own (an anonymous function inside `forwardRef` or `memo`, or a minified package) cannot be watched: leave it out and name it in your report. Names are matched across the whole page, so a component from another library with the same name is watched too: name any you notice in your report.

Nothing else needs describing. At a call site, Retouche reads Tailwind utilities by name and any other class through the page's own stylesheets, the theme's custom tokens included: `text-caption` counts as a size because the CSS Tailwind generates for it sets `font-size`. Inline `style` is read by property. Stylesheets served from another origin cannot be read.

## 4. Write `retouche.config.ts`

Copy `node_modules/retouche/templates/retouche.config.ts` to the project root, next to `package.json`, and tailor it:

- `components`: the list from step 3.
- `allow`: leave it out. The developer reviews each override in the overlay, and when one is intended the overlay copies the exact entry to add. Only add an entry now when the design system's own code or docs say a component is meant to take that override, and name the source in your report.

An `allow` entry is `{ component?: "Text", classes?: ["text-muted-*"], properties?: ["text-color"], corners?: true }`: `classes` are globs on the class name (variants such as `md:` or `hover:` are ignored), `properties` lets any override of those properties through, class or inline style, `corners: true` keeps the component's nested corners as they are, and without `component` the entry applies to every watched component. An override is let through when it matches either list.

## 5. Wire it up

**Vite**

- `vite.config.ts`: add `retouche()` from `retouche/vite` to `plugins`.
- The client entry (`src/main.tsx`): make `import "retouche/instrument";` the very first import, before React. A framework that generates its client entry, such as TanStack Start, takes a custom one (`src/client.tsx`) written as its docs show.
- Render `<Retouche config={config} />` from `retouche` next to the app root, with `config` imported from `retouche.config.ts`. A framework that renders the whole document, such as TanStack Start, takes it inside the root route's `<body>`.
- An app with several entries, one per HTML page or window, needs both in every entry whose screens should be checked.

**Next.js (App Router)**

- Create `app/api/retouche/[...path]/route.ts`, under `src/app/` when the app uses `src/`, containing `export { GET } from "retouche/next";`.
- Create or extend `instrumentation-client.ts` at the project root, or in `src/` when the app uses one, with `import "retouche/instrument";` as its first line.
- Render `<Retouche config={config} />` from `retouche` inside the root layout's `<body>`, with `config` imported from `retouche.config.ts`.

`<Retouche>` renders nothing in production builds, `retouche/instrument` installs nothing there, and the route answers nothing outside development, so no environment guards are needed.

## 6. Verify

- Run the project's typecheck, or `tsc --noEmit` when it has none.
- Start the dev server and open the app. Dots should appear on overridden elements, and the Retouche bar should show a count rather than "Config error".
- Open a few overrides in the panel. Each call site should be a line written where the app uses the design system. When it sits inside the design system itself, the component whose code it is belongs on the list from step 3: add it and look again rather than allowing the override.
- Report back: where the design system lives and the styling approaches found, the components watched, the ones left out and why, any `allow` entries and where they come from, and how many overrides the first page shows.
