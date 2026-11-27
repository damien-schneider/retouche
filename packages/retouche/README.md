# Retouche

A dev overlay for React apps. It puts a dot on every element whose call site overrides your design system's typography, and on every nested corner that doesn't fit the corner it sits in. Click a dot to see the call site, the component it overrides, and a before/after diff measured in the browser.

It also highlights renders, takes notes for your coding agent, and turns what you say while pointing at the page into feedback cards. Production builds render nothing and install nothing.

## Setup

Give this prompt to Claude Code, Codex, Cursor or any coding agent working in your app:

```text
Set up Retouche in this React app by following https://retouche.dev/setup.md
```

Or install it yourself:

```bash
npm install -D retouche-dev
```

Requires React 19, with Vite (TanStack Start and React Router included) or Next.js 16 (App Router on Turbopack). Manual setup, configuration and docs are on [GitHub](https://github.com/damien-schneider/retouche#manual-setup).

The package is named `retouche-dev` because `retouche` belongs to another project. Its CLI is `retouche`.

## License

MIT. Bundled third-party code is listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
