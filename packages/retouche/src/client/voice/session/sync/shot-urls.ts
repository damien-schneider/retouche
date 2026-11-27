import { ENDPOINTS } from "../../../../protocol";
import { fetchDevRouteBlob } from "../../../route/dev-route";

export class ShotUrls {
  readonly #onChange: () => void;
  #urls: ReadonlyMap<string, string> = new Map();
  #loading = new Map<string, Promise<string | null>>();
  #missing = new Set<string>();
  #aborter = new AbortController();

  constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  get urls(): ReadonlyMap<string, string> {
    return this.#urls;
  }

  add(shotId: string, image: Blob): string {
    const previous = this.#urls.get(shotId);
    if (previous !== undefined) {
      URL.revokeObjectURL(previous);
    }
    const url = URL.createObjectURL(image);
    this.#urls = new Map(this.#urls).set(shotId, url);
    this.#onChange();
    return url;
  }

  async load(session: string, shot: string): Promise<string | null> {
    const known = this.#urls.get(shot);
    if (known !== undefined || this.#missing.has(shot)) {
      return known ?? null;
    }
    const loading = this.#loading.get(shot) ?? this.#fetch(session, shot);
    this.#loading.set(shot, loading);
    const url = await loading;
    this.#loading.delete(shot);
    return url;
  }

  async #fetch(session: string, shot: string): Promise<string | null> {
    const { signal } = this.#aborter;
    try {
      const image = await fetchDevRouteBlob({
        endpoint: ENDPOINTS.voiceShot,
        search: new URLSearchParams({ session, shot }),
        signal,
      });
      return signal.aborted ? null : this.add(shot, image);
    } catch {
      if (!signal.aborted) {
        this.#missing.add(shot);
      }
      return null;
    }
  }

  clear(): void {
    this.#aborter.abort();
    this.#aborter = new AbortController();
    this.#loading = new Map();
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
