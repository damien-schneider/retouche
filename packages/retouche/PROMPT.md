Set up Retouche in this React app. Retouche is a dev-only overlay: it puts a dot on every element where a call site overrides the typography of a design-system component (`<Text className="text-lg font-bold">`, `<Badge className={styles.loud}>`, `<Heading style={{ fontSize: 40 }}>`). It also dots every nested corner that doesn't follow the curve of the container it sits in. Clicking a dot shows which properties the override changes, what it replaced, and the code behind it. Retouche does not judge: the developer decides, override by override, whether to fix the call site or allow it. Its panel can also highlight renders: each component flashes as it renders, with a running count, the panel lists every component that rendered, and it shows what changed on a component's last render. That needs no setup beyond the steps below.

Work through these steps in order. Stop and tell me if a precondition fails instead of working around it.

## 1. Check the stack

- React 19 or later is required. React 18 or another UI framework: stop and tell me.
- Supported dev servers: Vite, frameworks built on it included, Next.js 16 with the App Router on Turbopack, its default, or Bun 1.2.3 or later serving the app's HTML through `Bun.serve` `routes`. Anything else, a Next app on the Pages Router alone and a Next dev script with `--webpack` included: stop and tell me.
- In a monorepo, work in the app that runs the dev server. If several apps could be meant, ask which.
- Any styling approach works: Tailwind, CSS Modules, plain CSS or Sass classes, CSS-in-JS that emits class names, inline `style`. Note which ones this app uses.
- Retouche reads the `className` and `style` a call site passes, including the CSS custom properties the design system's stylesheets read into typography (`style={{ "--button-font-size": "14px" }}`, `[--button-font-size:14px]`). If call sites change typography mostly through other props (`sx`, the `css` prop, style props such as `fontSize="lg"`), stop and tell me: those are not read.

## 2. Install

Add Retouche as a dev dependency with the project's own package manager:

```
{{RETOUCHE_PACKAGE}}
```

For example `bun add -d {{RETOUCHE_PACKAGE}}`, `pnpm add -D {{RETOUCHE_PACKAGE}}` or `npm install -D {{RETOUCHE_PACKAGE}}`.

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

Copy `node_modules/retouche-dev/templates/retouche.config.ts` to the project root, next to `package.json`, and tailor it:

- `components`: the list from step 3.
- `allow`: leave it out. The developer reviews each override in the overlay, and when one is intended the overlay copies the exact entry to add. Only add an entry now when the design system's own code or docs say a component is meant to take that override, and name the source in your report.

An `allow` entry is `{ component?: "Text", classes?: ["text-muted-*"], properties?: ["text-color"], corners?: true }`: `classes` are globs on the class name (variants such as `md:` or `hover:` are ignored), `properties` lets any override of those properties through, class or inline style, `corners: true` keeps the component's nested corners as they are, and without `component` the entry applies to every watched component. An override is let through when it matches either list.

## 5. Wire it up

**Vite**

- `vite.config.ts`: add `retouche()` from `retouche-dev/vite` to `plugins`.
- The client entry (`src/main.tsx`): make `import "retouche-dev/instrument";` the very first import, before React. A framework that generates its client entry takes a custom one written as its docs show: TanStack Start's `src/client.tsx`, React Router's `app/entry.client.tsx` (`npx react-router reveal entry.client`).
- Render `<Retouche config={config} />` from `retouche-dev` next to the app root, with `config` imported from `retouche.config.ts`. A framework that renders the whole document takes it inside the root route's `<body>`: TanStack Start's `__root.tsx`, the `Layout` in React Router's `app/root.tsx`.
- An app with several entries, one per HTML page or window, needs both in every entry whose screens should be checked.

**Next.js (App Router)**

- Create `app/api/retouche/[...path]/route.ts`, under `src/app/` when the app uses `src/`, containing `export { GET, POST } from "retouche-dev/next";`.
- Create or extend `instrumentation-client.ts` at the project root, or in `src/` when the app uses one, with `import "retouche-dev/instrument";` as its first line.
- Render `<Retouche config={config} />` from `retouche-dev` inside the root layout's `<body>`, with `config` imported from `retouche.config.ts`.

**Bun (`Bun.serve`)**

- Spread `retoucheRoutes()` from `retouche-dev/bun` into the `routes` of `Bun.serve`, next to the route that serves the app's HTML: `routes: { ...retoucheRoutes(), "/": index }`.
- The client entry the HTML loads (`<script type="module" src="./main.tsx">`): make `import "retouche-dev/instrument";` the very first import, before React.
- Render `<Retouche config={config} />` from `retouche-dev` next to the app root, with `config` imported from `retouche.config.ts`.
- The route answers only while `Bun.serve` runs in development, which Bun turns on unless `NODE_ENV` is `production` or `development: false` is set.

`<Retouche>` renders nothing in production builds, `retouche-dev/instrument` installs nothing there, and the route answers nothing outside development, so no environment guards are needed.

## 6. Check the dev setup

The overlay talks to its dev route at `/api/retouche` on the app's own origin: the code behind each override, the config entries it writes and voice sessions all go through it. Read the app's config for anything that stands between the two, and change it for development only:

- **Hostname.** The route answers on `localhost`, `*.localhost`, `127.0.0.1` and `[::1]`, and only to a browser on the machine running the dev server. If the developer opens the dev server under another name (a domain mapped in `/etc/hosts`, a LAN address, a container or tunnel host: look at `server.host` and `server.allowedHosts` in the Vite config, `allowedDevOrigins` in the Next config, the dev script and the README), add each name, comma-separated, to `RETOUCHE_HOSTS` in the app's `.env.local`, or to the `allowedHosts` option when the whole team uses it: `retouche({ allowedHosts: [...] })`, for Next.js a route file reading `export const { GET, POST } = createRoute({ allowedHosts: [...] });` with `createRoute` from `retouche-dev/next`, or for Bun `retoucheRoutes({ allowedHosts: [...] })`.
- **Next.js `basePath`.** The overlay calls `/api/retouche` from the site's root, so with a `basePath` set: stop and tell me.
- **Requests in front of the route.** A Next.js `proxy.ts` or `middleware.ts` whose matcher covers `/api/retouche` and that can redirect, rewrite or reject it (auth, locale prefixes, rate limits): exclude `/api/retouche` from its matcher. Vite runs Retouche's middleware before its own `server.proxy`, so a proxied `/api` is fine; when the app's own server sits in front of Vite (Vite in middleware mode under Express, Hono, Fastify…), it must hand `/api/retouche` to `vite.middlewares` before its own routes.
- **Security headers in development.** A `Content-Security-Policy` or `Permissions-Policy` sent in development (headers in the Next config, `proxy.ts` or `middleware.ts`, a `<meta http-equiv>` tag, Vite's `server.headers`, the app's own server) must let the overlay run. Its styles are `<style>` elements: `style-src 'unsafe-inline'`, and since browsers ignore `'unsafe-inline'` next to a nonce or hash, leave those out of `style-src` in development. The overlay pairs with the dev server through `http://127.0.0.1` on a port the server picks (`connect-src http://127.0.0.1:*`). Screenshots are `blob:` and `data:` images (`img-src`). Listening through a speech-to-text key loads an audio worklet from a `blob:` URL (`script-src`). Voice sessions need the microphone (`microphone=(self)`). Leave production headers as they are.
- **Editor.** Code opens in VS Code unless `RETOUCHE_EDITOR` names another: `cursor`, `webstorm`, `windsurf` or `zed`. When you know the developer works in one of those, set it in the app's `.env.local`.
- Before writing to `.env.local`, check that git ignores it, and add it to `.gitignore` when it doesn't.
- **Voice sessions** (Session on the bar) turn what the developer says while pointing at the page into feedback through their own Claude Code, Codex or Mastra Code CLI, whichever is installed and signed in; Retouche runs it in the background. Sessions are saved in the user's data folder, outside the repo. A Groq, Mistral or OpenAI speech-to-text key is added from the voice start screen, or picked up from `GROQ_API_KEY`, `MISTRAL_API_KEY` or `OPENAI_API_KEY` in the environment or the app's `.env` files, and kept outside the repo. Other writers, ACP agents or OpenAI-compatible endpoints, and any other transcriber go in the `voice` option of `retouche()`, `createRoute()` or `retoucheRoutes()`, typed in the package; add them only when the developer asks, and never write a key into a file. None is required for the rest of Retouche.

## 7. Verify

- Run the project's typecheck, or `tsc --noEmit` when it has none.
- Start the dev server and open the app. Dots should appear on overridden elements, and the Retouche bar should show a count rather than "Config error".
- Open a few overrides in the panel. Their code should show under Call site and Component; when the panel asks to add the route instead, the browser does not reach `/api/retouche`: go back to step 6. Each call site should be a line written where the app uses the design system. When it sits inside the design system itself, the component whose code it is belongs on the list from step 3: add it and look again rather than allowing the override.
- Open the browser console: nothing should report a blocked Retouche request, style, image or worklet.
- Report back: where the design system lives and the styling approaches found, the components watched, the ones left out and why, any `allow` entries and where they come from, how many overrides the first page shows, what you changed in the dev setup and why (hostnames, matchers, development headers, editor), and which of Claude Code, Codex and Mastra Code voice sessions can use.
