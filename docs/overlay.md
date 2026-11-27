# Using the overlay

Retouche reports every typography override on the components you list and doesn't grade them. Fix one with a copied prompt, or keep it with the `allow` entry the inspector shows and copies for you.

Tailwind utilities are read by name; any other class, from CSS Modules, plain CSS or CSS-in-JS, by the typography properties the page's stylesheets give it; inline `style` by property. Custom theme tokens need no config: `text-caption` reads as a size because the CSS Tailwind generates for it sets `font-size`.

## Dots

Every overridden element in view gets a pin where its visible text ends: at the ellipsis of a truncated title, and none while a scroll area hides the element. The first pin of each call site matches the plain number beside its row in the panel; the call site's other elements get a small plain dot.

Hover a dot to see its number, the component and the overriding classes. The tip opens away from a pinned panel, and every element from the same call site pings and lights up.

## The bar

The floating bar counts the call sites behind the dots, or shows a check in the corner of its panel button when there are none. It also holds the dots switch, the picker and Session. Click the count and the bar grows into the panel.

The bar starts in the middle of the top edge. Drag its grip to park it in any corner or in the middle of the top or bottom edge; the panel opens on the side it last took.

## The panel

The panel lists every overriding call site on the page once, however many elements it renders, grouped by component. Each row shows the properties it changes, the number of elements it renders, and the class or style it replaced next to what replaces it.

The chip row counts them: All, then one chip per property that narrows the list and the dots to it.

- **Head.** The pin and the dots switch on the left, close on the right, and Pick and Session in an island between them. The title sits below, and turns into the way back from the inspector.
- **Chips.** They stay above the inspector, so the head keeps its height. They show what the stepper walks through, and a chip there goes back to the list it narrows.
- **Foot.** The render switch, the theme switch on its right and, unfolded above it, the list of components that rendered since the switch went on, which never takes more than about half the panel.

### Pin

Pin, on the left of the panel head, docks the panel beside the page instead of over it. The page stays flush with the window and sits above the panel like a card: its two corners on the panel's side are rounded into the panel, and its edge is lit by a hairline on the inside and casts a soft shadow onto the panel, so the seam shows against any page.

- Drag the seam to resize, and drag the panel's header to move it to the other side.
- Pinning adds a margin and a scroll padding of the panel's width to `<html>` on the panel's side, so the picker's note card stays beside it. Only the two rounded corners and the hairline along the seam are drawn over the page.
- Elements positioned against the viewport ignore the margin, so they sit under the panel.
- Pinning needs a viewport of 720px or more.

### Theme

The overlay takes the app's light or dark theme and follows it when it switches. It reads, in order:

1. a `dark` or `light` class, or a `data-theme`, `data-mode`, `data-color-mode`, `data-color-scheme` or `data-bs-theme` attribute, on `<html>` or `<body>`;
2. the `color-scheme` set on `<html>`;
3. how dark the background painted on `<body>` or `<html>` is;
4. the system setting.

The switch next to the pin overrides it, and the choice is kept for the site; switching back to the app's theme follows the app again. A theme set only through an inline `style` is picked up when the overlay next mounts.

### Small screens

On a screen under 720px the panel opens as a sheet across the edge the bar sits on: the top, where the bar starts, or the bottom when the bar is parked there. Tap or drag its handle to switch between half and nine tenths of the screen, and drag it away to close. The sheet adds a margin and a scroll padding to `<html>`, so the end of the page and the inspected element scroll clear of it.

## The inspector

Open a row or a dot and the inspector shows, from top to bottom:

1. A head with the override's number, the component written as `<Heading />`, and hold to compare on its right.
2. The property diff. It re-renders the element without the override and reads both computed values: `text-5xl 48px → text-6xl 60px`. Hold to compare previews the page without it.
3. The renders of the component behind the element, while render highlights are on.
4. The code, traced from the call site to the component's own source and then the config, each step with the prompt that resolves the override there.

In the code, the replaced class shows dashed, set aside rather than deleted, and the class that replaces it is tinted. While you hold to compare, the override is struck and the component's classes come back. Hover or focus either edge of an excerpt to reveal every line on that side in one click: the lines you were reading stay in view while the excerpt grows to show them.

### Prompts for your agent

Each step of the code trace ends with a prompt, placed where its change lands: what it asks for, and Copy prompt beside it. They show while the pointer is over that step or focus is inside it, and always on a touch screen.

| Prompt | Where | What it asks your agent |
| --- | --- | --- |
| Use an existing variant | Under the call site | Remove the override and reach the design through a variant or prop the component already has; when none fits, stop and say which comes closest |
| Add a variant for this style | Under the component | Add a variant carrying the override and use it at the call site |
| Allow on every _component_ | Under the config | Add the `allow` entry shown above it to `retouche.config.ts`, so that override stops being reported on every instance of the component |

With the dev route, the `allow` entry is shown inside your `retouche.config.ts`, at the line it would take, with the file's own line numbers around it and the rest of the file a click away. When the file can't be read, or its `allow` list doesn't open on a line of its own, the entry is shown alone. The prompts and the entry need no dev route.

## Nested corners

A button in a card's corner, an item in a popover's corner, a toolbar in a bubble menu: when its radius isn't the container's radius minus the gap between them, ±1px, a nested-corner icon points to the corner that breaks, and the finding appears under the Corners lens.

The inspector shows both radii, the gap and the radius that would fit, the container's code, and a prompt that fixes the corner where the container decides it rather than in the two numbers.

A corner counts, for the element and for its container alike, only where it is drawn: a background, a border on its sides or a shadow, at rest or in a state the page's stylesheets paint (hover, focus, pressed, selected, current, expanded, open). An icon or a button that paints in none of them is never measured. Rules in a cross-origin stylesheet can't be read, so only what they paint at rest counts. Circles, pills at least as round as the curve, scrolled content and fixed elements are left alone.

## Picker and notes

The picker, on the bar and in the panel's head, aims at any element on the page:

- with the pointer, `Tab` or the arrow keys;
- by dragging a box around it: while you drag, the element whose box or text best fills yours is aimed, the innermost one on a near tie, and releasing picks it.

The wheel still scrolls the page and the scroll area under the pointer, and the aim follows what comes under it.

### Note card

Click, `Enter` or the end of a drag opens a note card on the element. It holds the note field with its copy and add buttons and, tucked under it:

- the element's name and where it is written;
- its lines of code, the whole element when it fits, as tall as the space above or below the element allows;
- the button that opens it in the panel.

Hovering the code shows how many lines lie above and below, and Expand widens the card to the whole file, scrolled to the element. The card scrolls with the page while it sits by the element, and holds still on the screen once the element has scrolled out from under it.

Each note leaves a numbered marker; click one to edit or remove its note. The notes tray has Copy all and Clear. Copy all hands every note to your coding agent as markdown, with the component, its call site and component lines, its classes and its measured typography. Notes last until you clear them or reload the page.

`⌘C` copies the aimed element alone.

### Open in the panel

`⇧`-click, `⇧Enter` or a drag ended with `⇧` opens the element in the panel directly. One inside an override opens its inspector. Any other shows its computed typography, the classes behind each property, and the code from where its component is rendered to the line that renders it.

## Render highlights

The render switch, at the foot of the panel, outlines each component as it renders.

- The component whose own state or context started the render is labelled with its name and, from its second render, how many times it rendered since the switch went on. The components its render re-rendered are outlined without a label, and only the innermost outlines are tinted.
- The outline stays on its element for about a second, even as the page scrolls past sticky or fixed elements. It starts bright and fades as the render ages, so the latest renders stand out, and brightens again each time the component renders.
- While on, the switch shows how many renders the app made since then, starting from 0, so a page that isn't rendering says so.

Beside it, the number of components that rendered unfolds the list of them, most renders first, each with its count and how many places it rendered in, the counts of the latest renders tinted. When the count climbs with no outline in view, the list still names who rendered, down to a component that draws nothing. Clicking one opens the element it wrote in the panel.

An element opened from that list or with `⇧`-click, or an override's inspector, then shows the renders of the component that wrote it and what changed on its last render: which props, state or context, whether a new function, object or element holds the same contents as before, or nothing but its owner rendering it again. Notes taken meanwhile carry the same facts.

Retouche reads React's commits itself and subscribes to none while the switch is off.

## Keyboard

Keys act while focus is inside Retouche.

| Key | Action |
| --- | --- |
| `j` / `k` | Next / previous override |
| `↑` / `↓` | Move through the list |
| `Esc` | Close the note card, leave the picker, back to the list, then close |
| `Tab` / `⇧Tab` | In the picker: aim at the next / previous element on the page, wrapping around |
| `↑` / `↓` | In the picker: aim at the parent / back at the child you climbed from, else the first child on screen |
| `←` / `→` | In the picker: aim at the previous / next sibling, wrapping around |
| `Enter` / `⇧Enter` | In the picker: note the aimed element / open it in the panel |
| `⌘C` | In the picker: copy the aimed element for your agent; in an empty note card, copy its element |
| `⌘Enter` | In the picker or a note card: save the note and copy all notes |
| `←` / `→` | On the bar's grip: step from one corner to the middle of the edge to the other corner. On the panel's grip: move it to the other side. On the panel edge: resize |
| `↑` / `↓` | On the bar's grip: move it to the top / bottom edge. On the sheet's handle: move its edge up / down, between half and nine tenths of the screen |

## Following your edits

Save a component or a call site and the dots, the diff and the code update in place, without reopening anything. When a save removes the override you are inspecting, the inspector says so, outlines the element in green and offers the next override on the page. When the inspected element leaves the page, the panel goes back to the list.

The open panel, the bar's place, the panel's width, the sheet's height and the pin survive a full reload.
