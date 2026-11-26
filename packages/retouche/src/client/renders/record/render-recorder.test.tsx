"use no memo";

import "../../../instrument";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { Fiber } from "bippy";
import { memo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { isOwnPortal } from "../../fiber/react-fiber";
import { OPEN_NAME, overlay, Page } from "../../testing/layer-page";
import {
  onRenderFrame,
  onRenderReports,
  type RenderedComponent,
  recordRenders,
  renderReportOf,
} from "./render-recorder";

const stops: (() => void)[] = [];

afterEach(() => {
  for (const stop of stops.splice(0)) {
    stop();
  }
  cleanup();
});

function startRecording(): () => void {
  const stop = recordRenders();
  stops.push(stop);
  return stop;
}

function watchFrames(): (readonly RenderedComponent[])[] {
  const frames: (readonly RenderedComponent[])[] = [];
  stops.push(
    onRenderFrame((rendered) => {
      frames.push(rendered);
    })
  );
  return frames;
}

async function nextFrame(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<number>();
  window.requestAnimationFrame(resolve);
  await act(async () => {
    await promise;
  });
}

function names(frame: readonly RenderedComponent[] | undefined) {
  return frame?.map(({ count, name }) => ({ count, name }));
}

function Quiet({ label }: { label: string }) {
  return <i>{label}</i>;
}

const QuietMemo = memo(Quiet);

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button
        onClick={() => {
          setCount(count + 1);
        }}
        type="button"
      >
        count {count}
      </button>
      <QuietMemo label="quiet" />
    </div>
  );
}

function App() {
  return (
    <main>
      <Quiet label="header" />
      <Counter />
      <Quiet label="footer" />
    </main>
  );
}

function isInsideOverlay(fiber: Fiber): boolean {
  for (let item: Fiber | null = fiber; item; item = item.return) {
    if (isOwnPortal(item)) {
      return true;
    }
  }
  return false;
}

describe("recording renders: frames", () => {
  it("shows a component rendered by its own state in the next frame, with a growing count", async () => {
    startRecording();
    const frames = watchFrames();
    render(<Counter />);
    await nextFrame();
    frames.length = 0;

    fireEvent.click(screen.getByRole("button"));
    await nextFrame();
    fireEvent.click(screen.getByRole("button"));
    await nextFrame();

    expect(frames.map(names)).toStrictEqual([
      [{ count: 2, name: "Counter" }],
      [{ count: 3, name: "Counter" }],
    ]);
  });

  it("tells report listeners once per frame, after the frame listeners", async () => {
    startRecording();
    const heard: string[] = [];
    stops.push(
      onRenderFrame(() => {
        heard.push("frame");
      }),
      onRenderReports(() => {
        heard.push("reports");
      })
    );
    render(<Counter />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    await nextFrame();

    expect(heard).toStrictEqual(["frame", "reports"]);
  });
});

describe("recording renders: what is reported", () => {
  it("does not report the existing tree as mounted when recording starts mid-session", async () => {
    render(<App />);
    startRecording();
    const frames = watchFrames();

    fireEvent.click(screen.getByRole("button"));
    await nextFrame();

    expect(frames.map(names)).toStrictEqual([[{ count: 1, name: "Counter" }]]);
    expect(renderReportOf(screen.getByText("header"))).toStrictEqual({
      count: 0,
      last: null,
    });
  });

  it("never reports retouche's own overlay", async () => {
    startRecording();
    const frames = watchFrames();
    render(<Page />);
    fireEvent.click(
      await within(overlay()).findByRole("button", { name: OPEN_NAME })
    );
    const toggle = within(overlay()).getByRole("button", { name: /renders/i });

    fireEvent.click(toggle);
    await nextFrame();

    const reported = frames.flat();
    expect(reported.map(({ name }) => name)).toContain("Text");
    expect(
      reported.filter(({ fiber }) => isInsideOverlay(fiber))
    ).toStrictEqual([]);
  });
});

describe("recording renders: lifecycle", () => {
  it("stays silent while not recording, and counts afresh when restarted", async () => {
    const frames = watchFrames();
    let heardReports = 0;
    stops.push(
      onRenderReports(() => {
        heardReports++;
      })
    );
    render(<Counter />);

    fireEvent.click(screen.getByRole("button"));
    await nextFrame();
    const silentReport = renderReportOf(screen.getByRole("button"));
    const stop = startRecording();
    fireEvent.click(screen.getByRole("button"));
    await nextFrame();
    stop();
    fireEvent.click(screen.getByRole("button"));
    await nextFrame();
    startRecording();
    fireEvent.click(screen.getByRole("button"));
    await nextFrame();

    expect(silentReport).toBeNull();
    expect(heardReports).toBe(2);
    expect(frames.map(names)).toStrictEqual([
      [{ count: 1, name: "Counter" }],
      [{ count: 1, name: "Counter" }],
    ]);
  });

  it("keeps the same report until its component renders again", () => {
    startRecording();
    render(<App />);
    const button = screen.getByRole("button");

    const first = renderReportOf(button);
    const unchanged = renderReportOf(button);
    fireEvent.click(button);
    const afterRender = renderReportOf(button);

    expect(unchanged).toBe(first);
    expect(afterRender).not.toBe(first);
    expect(afterRender?.count).toBe(2);
    expect(renderReportOf(button)).toBe(afterRender);
  });
});
