# How it works

## Detecting overrides

The client walks React's fiber tree from the DOM, finds elements rendered by a watched component, and sorts the `className` and `style` props passed at the call site by the typography property they set. Elements a watched component renders itself are the design system's own composition and are not reported, including the ones a library such as Base UI clones from an element the component handed it with the same classes and style.

Tailwind classes are grouped by name, variants included, so `md:text-xl` is a font-size override that does not apply at rest.

A `text-*` or `font-*` class Tailwind does not ship, such as a theme's `text-caption` or `font-book`, and any other class are resolved through the page's stylesheets: a class counts when a rule targeting it sets a watched property. Tailwind's `var(--tw-…, fallback)` declarations, which give way to any utility on the same element, do not count, so `text-caption` is a size like `text-lg`, not a size and a line height.

A custom property counts as whatever the stylesheets read it into. When the design system's rule says `font-size: var(--button-font-size)`, setting `--button-font-size` is a font-size override, whether in a call site's `style`, through an arbitrary-property class such as `[--button-font-size:14px]`, or through a class whose rule sets it.

Not reported:

- classes aimed at the icons inside a component, such as `[&_svg]:text-red-500`, which tint icons rather than text;
- style values React never applies (`undefined`, `null`, booleans, empty strings);
- overrides matching an `allow` entry.

Stylesheets from another origin cannot be read.

## Measuring

To measure, Retouche re-renders the component through React's DevTools renderer interface with the overriding props removed, reads its classes and computed styles, and restores the original props in the same task. The panel measures each row it lists, for the class the override replaced; the inspector measures the override it opens, for the values too.

## The dev route and the code view

The dev route reads source files for the code view. The Vite plugin and the Next.js route handler share one handler, which refuses non-localhost hostnames, cross-origin requests, files outside the repository, and `node_modules`. It also answers only a page that has paired with the machine running the dev server: the overlay fetches a token from a listener bound to `127.0.0.1`, which no other machine on the network reaches, and sends it with every request. A Next.js dev server listens on the whole network by default, so a request forged from another machine is refused without the token. The Vite plugin also refuses non-loopback sockets.

- When a library hook such as Base UI's `useRender` creates the component's element, the code view shows the component's call to it.
- Code written inside an installed package, such as a design system from npm, is named by its package instead.
- A picked element that a library part writes, such as the button of Base UI's `Select.Trigger` or a Radix `Slot`, is named by your component that renders the part, and its code starts at that component's call site in your app. A library component placed in a page as is, such as MUI's `Button`, keeps its own name.

## Dev only

In production builds `<Retouche>` renders nothing and `retouche-dev/instrument` installs nothing; a Vite build ships neither the overlay nor the hook code. The source route answers only in development, on localhost, to requests from the app's own origin.

## Rescanning

The scan reruns about 80 ms after every React commit, so a Fast Refresh update is picked up at once, and every second otherwise. The inspector re-measures when Fast Refresh swaps the component or its call site.

A CSS-only edit, such as a theme token or a CSS Module change, does not trigger a React commit: the next scan, within a second, re-reads the stylesheet classes, and reselecting the override measures its values again.

## Call sites

Overrides are grouped by call site, the JSX element in your source that passed the override, read from the creation stack React records for each element in development.

React records those stacks for 10,000 elements a second. Past that, elements written at the same place in the same component, with the same watched component and override, share a row, so a long list stays one row; the code trace reads their call site from an element React did record there.

When none was recorded, or when Safari left the component out of the stack because it returns the element, the trace locates the component that wrote it, through another element it wrote or the line it stops at when called outside a render, and opens the tag of that name nearest to it in the component's source.

## Large pages

Dots exist only near the viewport and a list rendered from one call site is one row. Dots are rendered only for elements within 600px of the viewport, or of the scroll area that holds them, so the overlay's cost follows what is on screen rather than the size of the page.

| Overridden elements | Dots held | Rescan       | Scrolling           |
| ------------------- | --------- | ------------ | ------------------- |
| 2,001               | 37        | about 1.3 ms | 60 frames a second  |
| 12,201              |           | about 9 ms   | one frame runs long |

Measured in headless Chromium at 1280×800 on a React development build with StrictMode.

## Scrolling and hover

Dots ride the page's own scroll natively. A scroll area inside the page scrolls on the compositor, ahead of what the overlay can measure. So while one scrolls, the dots, note markers and outlines on elements inside it scale down and fade out, and come back 150ms after it stops, even while another area, such as a streaming chat, keeps scrolling; those elsewhere stay on their text. A dot whose element scrolls out of the area stays in place, hidden, so it does not replay its entrance when the element scrolls back.

A dot, note marker or corner dot holds still while the pointer or focus is on it. Moving onto it ends the page's own hover on the element beneath, and an element that shifts or reflows on hover would otherwise carry the dot out from under the pointer; it catches up once the pointer moves on.

## Render highlights

Render highlights subscribe to React's commits through the DevTools hook only while the switch is on.

Each commit, Retouche walks the components React rendered, skipping the subtrees it bailed out of and the overlay's own, including the components that render nothing but the overlay. It counts each one and keeps references to its previous and new props, state and context; what changed is worked out only when the panel or a note asks. The renders Retouche causes itself, to measure a diff or hold to compare, are left out. A component whose props object is the one it had before rendered for its own state or context; one with new props was rendered again by its owner.

Each component that rendered keeps one flash for 1.2 s from its last render: one box around the elements it wrote, measured again every frame while lit, and shared by components with the same box. A box whose element held still while the page scrolled goes in a layer fixed to the screen, the others in a layer that scrolls with the page, so the browser scrolls each box the way it scrolls its element, even between frames.

- Only the boxes started by their component's own state or context are labelled, and only the innermost boxes are tinted.
- The flash fades over its 1.2 s and pulses its ring, and the tint of an innermost box, on each render; with reduced motion it holds steady instead.
- Labels that would overlap fold into the label of the larger box, and a box taller than the screen keeps its label at the top of the screen.
- A component rendered before the overlay loaded starts its count at its next render.

The list at the panel's foot keeps one entry per component type rather than per instance: its renders since the switch went on, how many instances rendered, and the fiber that rendered last, so a row opens that instance's element without holding on to the ones that unmounted. It renders only the rows in view and a few around them, in a grid as tall as every row, so a list of hundreds of components scrolls like a short one.

## Voice sessions

How sessions listen, link speech to what you point at, store their data and run the agent is in [Voice sessions](voice.md#how-a-session-works).

## Supported setups

Verified on React 19 client components with Vite, and on Next.js 16 with Turbopack, client and server components alike. Server components are detected from React's server debug info; their diff cannot be measured in the browser.

Next's webpack dev server (`next dev --webpack`) is not supported: overrides are detected, but client call sites point at the compiled line and server components show no code. Frameworks other than React are out of scope.
