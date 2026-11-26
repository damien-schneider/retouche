import { ENDPOINTS } from "../../../../protocol";
import { fetchDevRouteBlob } from "../../../route/dev-route";

export class ShotUrls {
  readonly #onChange: () => void;
  #urls: ReadonlyMap<string, string> = new Map();
  #loading = new Set<string>();
  #missing = new Set<string>();
  #aborter = new AbortController();

  constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  get urls(): ReadonlyMap<string, string> {
    return this.#urls;
  }

  add(shotId: string, image: Blob): void {
    const previous = this.#urls.get(shotId);
    if (previous !== undefined) {
      URL.revokeObjectURL(previous);
    }
    this.#urls = new Map(this.#urls).set(shotId, URL.createObjectURL(image));
    this.#onChange();
  }

  async load(session: string, shot: string): Promise<void> {
    if (
      this.#urls.has(shot) ||
      this.#loading.has(shot) ||
      this.#missing.has(shot)
    ) {
      return;
    }
    const { signal } = this.#aborter;
    this.#loading.add(shot);
    try {
      const image = await fetchDevRouteBlob({
        endpoint: ENDPOINTS.voiceShot,
        search: new URLSearchParams({ session, shot }),
        signal,
      });
      if (!signal.aborted) {
        this.add(shot, image);
      }
    } catch {
      if (!signal.aborted) {
        this.#missing.add(shot);
      }
    } finally {
      this.#loading.delete(shot);
    }
  }

  clear(): void {
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#loading = new Set();
    this.#missing = new Set();
    for (const url of this.#urls.values()) {
      URL.revokeObjectURL(url);
    }
    if (this.#urls.size > 0) {
      this.#urls = new Map();
      this.#onChange();
    }
  }
}
