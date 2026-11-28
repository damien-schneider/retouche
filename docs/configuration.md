# Configuration

## `retouche.config.ts`

```ts
import { defineConfig } from "retouche-dev/config";

export default defineConfig({
  components: ["Heading", "Text", "Button"],
  allow: [
    { component: "Text", classes: ["text-muted-foreground"] },
    { component: "Button", properties: ["font-weight"] },
  ],
});
```

| Field | Purpose |
| --- | --- |
| `components` | Display names of the design-system components to watch: the ones that style their own text, and the ones that render those with classes of their own, so what they render is trusted as composition |
| `allow` | Overrides that are wanted. Each entry takes `classes` (globs on the class name, variants ignored), `properties`, `corners`, or a mix, and an optional `component`; without one it applies to every watched component. An override is let through when it matches either list, so `properties` covers classes and inline styles alike |
| `allow.*.corners` | `true` keeps the nested corners of the entry's `component` as they are |
| `allow.*.properties` | `font-size`, `font-weight`, `font-family`, `line-height`, `letter-spacing`, `font-style`, `text-transform`, `text-decoration`, `font-variant-numeric`, `font-smoothing`, `text-color` |

An invalid config pauses scanning and lists every issue in the panel.

## Dev server

The dev route reads its settings from the options of `retouche()`, `createRoute()` from `retouche-dev/next` or `retoucheRoutes()` from `retouche-dev/bun`, or from `RETOUCHE_` variables in the dev server's environment or the app's env files (`.env.local` keeps them out of git).

| Option | Variable | Purpose |
| --- | --- | --- |
| `editor` | `RETOUCHE_EDITOR` | Where code opens: `vscode` (default), `cursor`, `webstorm`, `windsurf` or `zed` |
| `allowedHosts` | `RETOUCHE_HOSTS` | Dev hostnames the route answers on besides `localhost`, `*.localhost`, `127.0.0.1` and `[::1]`; the variable takes a comma-separated list |
| `root` |  | The project the route reads source files from; Vite's root, or the working directory under Next.js |
| `voice` |  | Voice writers and transcription, in [Voice sessions](voice.md#setting-up-writers-and-speech-to-text) |
|  | `RETOUCHE_CLAUDE_PATH`, `RETOUCHE_CODEX_PATH`, `RETOUCHE_MASTRACODE_PATH` | The CLI to run when it is installed somewhere Retouche does not look |

After upgrading Retouche, restart the dev server: until it runs the new version, the overlay says so instead of reading code or saving voice sessions.

## Proxies and security headers

The overlay calls the route at `/api/retouche` from the app's root:

- A Next.js `proxy.ts` or `middleware.ts` must let that path through.
- A Next.js `basePath` is not supported.
- A `Content-Security-Policy` sent in development must allow inline `<style>` elements (no nonce or hash in `style-src`), `blob:` and `data:` images, and, to listen through a speech-to-text key, a `blob:` audio worklet in `script-src`.
- A `Permissions-Policy` must allow the microphone for voice sessions.
