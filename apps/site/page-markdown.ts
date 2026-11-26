import { JSDOM } from "jsdom";
import TurndownService from "turndown";

const LEFT_OUT = '[aria-hidden="true"], nav, button';

const TURNDOWN = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

export function pageMarkdown(html: string, url: string): string {
  const { document } = new JSDOM(html, { url }).window;
  const main = document.querySelector("main");
  const description = document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content");
  if (main === null || description === null || description === undefined) {
    throw new Error(
      `${url} has no <main> or no description to write it as markdown`
    );
  }
  for (const node of main.querySelectorAll(LEFT_OUT)) {
    node.remove();
  }
  for (const link of main.querySelectorAll("a")) {
    const label = link.getAttribute("aria-label");
    if (label !== null) {
      link.textContent = label;
    }
    link.setAttribute("href", link.href);
  }
  const fields = Object.entries({ description, title: document.title, url });
  return [
    "---",
    ...fields.map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
    "---",
    "",
    TURNDOWN.turndown(main),
    "",
  ].join("\n");
}
