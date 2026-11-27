import { PHRASE_MAX_LENGTH } from "../../../../protocol";
import type { PhraseBook } from "./speech-source";

const LABELLED = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "button",
  "label",
  "legend",
  "summary",
  ...["button", "link", "menuitem", "tab"].map((role) => `[role="${role}"]`),
].join(", ");

const MAX_WORDS = 4;
const MAX_PHRASES = 60;
const WHITESPACE = /\s+/g;

function labelOf(element: Element): string {
  const named = element.getAttribute("aria-label") ?? element.textContent;
  return (named ?? "").replaceAll(WHITESPACE, " ").trim();
}

function pagePhrases(components: readonly string[]): string[] {
  const labels = [...document.querySelectorAll(LABELLED)]
    .filter((element) => element.checkVisibility())
    .map(labelOf);
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const phrase of [...components, ...labels]) {
    const key = phrase.toLowerCase();
    const isShort =
      phrase.length <= PHRASE_MAX_LENGTH &&
      phrase.split(" ").length <= MAX_WORDS;
    if (phrase !== "" && isShort && !seen.has(key)) {
      seen.add(key);
      phrases.push(phrase);
    }
  }
  return phrases.slice(0, MAX_PHRASES);
}

export function pagePhraseBook(
  components: () => readonly string[]
): PhraseBook {
  let isRefused = false;
  return {
    read: () => (isRefused ? [] : pagePhrases(components())),
    refuse: () => {
      isRefused = true;
    },
  };
}
