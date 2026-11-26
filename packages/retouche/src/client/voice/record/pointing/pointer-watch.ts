import { pageElementAt } from "../../../picker/aim/element-walk";
import { startsInWidget } from "../../../shell/widget-events";
import { pointTarget } from "./element-facts";

interface Pointer {
  x: number;
  y: number;
}

export interface PointerEvents {
  onClick: (target: Element | null) => void;
  onDwell: (target: Element) => void;
  onTarget: (target: Element | null) => void;
}

const DWELL_MS = 350;
const LISTENING = { capture: true, passive: true } as const;

export class PointerWatch {
  readonly #events: PointerEvents;
  #pointer: Pointer | null = null;
  #target: Element | null = null;
  #frame = 0;
  #dwell = 0;

  constructor(events: PointerEvents) {
    this.#events = events;
  }

  start(): void {
    window.addEventListener("pointermove", this.#move, LISTENING);
    window.addEventListener("click", this.#click, LISTENING);
  }

  stop(): void {
    window.removeEventListener("pointermove", this.#move, LISTENING);
    window.removeEventListener("click", this.#click, LISTENING);
    cancelAnimationFrame(this.#frame);
    window.clearTimeout(this.#dwell);
    this.#frame = 0;
    this.#target = null;
  }

  readonly #move = (event: PointerEvent): void => {
    if (startsInWidget(event)) {
      return;
    }
    this.#pointer = { x: event.clientX, y: event.clientY };
    this.#frame ||= requestAnimationFrame(this.#aim);
  };

  readonly #aim = (): void => {
    this.#frame = 0;
    const pointer = this.#pointer;
    const element =
      pointer && pageElementAt({ clientX: pointer.x, clientY: pointer.y });
    const target = element ? pointTarget(element) : null;
    if (target === this.#target) {
      return;
    }
    this.#target = target;
    window.clearTimeout(this.#dwell);
    this.#events.onTarget(target);
    if (target) {
      this.#dwell = window.setTimeout(() => {
        this.#events.onDwell(target);
      }, DWELL_MS);
    }
  };

  readonly #click = (event: MouseEvent): void => {
    if (startsInWidget(event)) {
      return;
    }
    const { target } = event;
    const isPage =
      target instanceof Element &&
      target !== document.body &&
      target !== document.documentElement;
    this.#events.onClick(isPage ? pointTarget(target) : null);
  };
}
