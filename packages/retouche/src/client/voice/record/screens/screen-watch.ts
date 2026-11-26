import { WIDGET_MARKER } from "../../../shell/widget-events";

const MUTATION_COOLDOWN_MS = 300;
const OBSERVED = { characterData: true, childList: true, subtree: true };

function isPageMutation(record: MutationRecord): boolean {
  const { target } = record;
  const element = target instanceof Element ? target : target.parentElement;
  return !element?.closest(`[${WIDGET_MARKER}]`);
}

export class ScreenWatch {
  #epoch = 0;
  #isHeld = false;
  #isCooling = false;
  #hasTrailing = false;
  #cooldown = 0;
  #observer: MutationObserver | null = null;

  key(): string {
    const { href } = location;
    const scroll = `${Math.round(scrollX)},${Math.round(scrollY)}`;
    return `${href}|${scroll}|${innerWidth}x${innerHeight}|${this.#epoch}`;
  }

  bump(): void {
    this.#epoch++;
  }

  hold(isHeld: boolean): void {
    this.#isHeld = isHeld;
  }

  start(): void {
    this.bump();
    this.#observer ??= new MutationObserver(this.#mutated);
    this.#observer.observe(document.documentElement, OBSERVED);
    window.addEventListener("popstate", this.#navigated);
    window.addEventListener("hashchange", this.#navigated);
  }

  stop(): void {
    this.#observer?.disconnect();
    window.removeEventListener("popstate", this.#navigated);
    window.removeEventListener("hashchange", this.#navigated);
    window.clearTimeout(this.#cooldown);
    this.#isCooling = false;
    this.#hasTrailing = false;
  }

  readonly #navigated = (): void => {
    this.bump();
  };

  readonly #mutated = (records: MutationRecord[]): void => {
    if (this.#isHeld || !records.some(isPageMutation)) {
      return;
    }
    if (this.#isCooling) {
      this.#hasTrailing = true;
      return;
    }
    this.bump();
    this.#isCooling = true;
    this.#cooldown = window.setTimeout(() => {
      this.#isCooling = false;
      if (this.#hasTrailing) {
        this.#hasTrailing = false;
        this.bump();
      }
    }, MUTATION_COOLDOWN_MS);
  };
}
