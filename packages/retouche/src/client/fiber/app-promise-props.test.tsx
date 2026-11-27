"use no memo";

import "../../instrument";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { compileConfig } from "../../rules/find-overrides";
import { recordRenders } from "../renders/record/render-recorder";
import { scanOverrides } from "./scan-overrides";

const SAFE_KEYS = new Set(["$$typeof", "then"]);

const options = {
  components: ["Button"],
  config: compileConfig({ components: ["Button"] }),
};

type SearchParams = Record<string, string>;

function watchedPromise(probes: string[]): PromiseLike<SearchParams> {
  const note = (key: string | symbol): void => {
    const name = z.string().safeParse(key);
    if (name.success && !SAFE_KEYS.has(name.data)) {
      probes.push(name.data);
    }
  };
  return new Proxy(Promise.resolve<SearchParams>({}), {
    get(target, key) {
      note(key);
      return key === "then" ? target.then.bind(target) : undefined;
    },
    has(target, key) {
      note(key);
      return key in target;
    },
  });
}

function Button({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button className={`mt-2 ${className ?? ""}`} type="button">
      {children}
    </button>
  );
}

function Page({
  searchParams,
}: {
  label: string;
  searchParams: PromiseLike<SearchParams>;
}) {
  return (
    <main data-pending={searchParams instanceof Promise}>
      <Button className="text-lg">Save</Button>
    </main>
  );
}

afterEach(cleanup);

describe("a page handed Next's dev searchParams promise", () => {
  it("scans the page without reading the promise's params", () => {
    const probes: string[] = [];
    render(<Page label="a" searchParams={watchedPromise(probes)} />);

    const found = scanOverrides(options).map(({ component }) => component);

    expect(found).toStrictEqual(["Button"]);
    expect(probes).toStrictEqual([]);
  });

  it("records a new promise without reading its params", () => {
    const probes: string[] = [];
    const stopRecording = recordRenders();
    const { rerender } = render(
      <Page label="a" searchParams={watchedPromise(probes)} />
    );

    rerender(<Page label="b" searchParams={watchedPromise(probes)} />);
    stopRecording();

    expect(screen.getByText("Save")).toBeDefined();
    expect(probes).toStrictEqual([]);
  });
});
