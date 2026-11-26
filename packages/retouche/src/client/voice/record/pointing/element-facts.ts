import type { VoiceElement, VoiceSite } from "../../../../protocol";
import {
  componentOf,
  locatedSites,
  type SiteLocation,
} from "../../../picker/notes/element-context";

const INTERACTIVE = [
  "a",
  "button",
  "input",
  "label",
  "select",
  "summary",
  "textarea",
  ...["button", "checkbox", "link", "menuitem", "switch", "tab"].map(
    (role) => `[role="${role}"]`
  ),
].join(", ");

const TEXT_LENGTH = 80;
const WHITESPACE = /\s+/g;

const IMPLICIT_ROLES = new Map(
  Object.entries({
    article: "article",
    aside: "complementary",
    button: "button",
    dialog: "dialog",
    footer: "contentinfo",
    form: "form",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
    header: "banner",
    hr: "separator",
    img: "img",
    li: "listitem",
    main: "main",
    nav: "navigation",
    ol: "list",
    option: "option",
    progress: "progressbar",
    section: "region",
    select: "combobox",
    table: "table",
    textarea: "textbox",
    ul: "list",
  })
);

const INPUT_ROLES = new Map(
  Object.entries({
    button: "button",
    checkbox: "checkbox",
    hidden: null,
    image: "button",
    number: "spinbutton",
    radio: "radio",
    range: "slider",
    reset: "button",
    search: "searchbox",
    submit: "button",
  })
);

export function pointTarget(element: Element): Element {
  const control = element.closest(INTERACTIVE);
  if (control) {
    return control;
  }
  return element instanceof SVGElement
    ? (element.closest("svg") ?? element)
    : element;
}

function roleOf(element: Element): string | null {
  const explicit = element.getAttribute("role");
  if (explicit !== null && explicit !== "") {
    return explicit;
  }
  if (element instanceof HTMLInputElement) {
    const role = INPUT_ROLES.get(element.type);
    return role === undefined ? "textbox" : role;
  }
  if (element instanceof HTMLAnchorElement) {
    return element.hasAttribute("href") ? "link" : null;
  }
  return IMPLICIT_ROLES.get(element.localName) ?? null;
}

function textOf(element: Element): string {
  const named =
    element.getAttribute("aria-label") ??
    element.getAttribute("placeholder") ??
    element.textContent ??
    "";
  const text = named.replaceAll(WHITESPACE, " ").trim();
  return text.length > TEXT_LENGTH
    ? `${text.slice(0, TEXT_LENGTH - 1).trimEnd()}…`
    : text;
}

function siteOf(location: SiteLocation | null | undefined): VoiceSite | null {
  return location
    ? {
        absolutePath: location.file?.absolutePath ?? null,
        line: location.line,
        path: location.path,
      }
    : null;
}

export function elementFacts(element: Element): VoiceElement {
  const sites = locatedSites(element);
  return {
    callSite: siteOf(sites?.callSite),
    component: componentOf(element),
    componentSite: siteOf(sites?.component),
    role: roleOf(element),
    tag: element.localName,
    text: textOf(element),
  };
}
