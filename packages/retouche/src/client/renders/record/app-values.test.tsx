"use no memo";

import "../../../instrument";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ShownValue } from "./app-values";
import { recordRenders, renderReportOf } from "./render-recorder";

let stopRecording = (): void => {};

beforeEach(() => {
  stopRecording = recordRenders();
});

afterEach(() => {
  stopRecording();
  cleanup();
});

function propsChangedOn(element: Element) {
  const last = renderReportOf(element)?.last;
  return last?.kind === "update" ? last.props : null;
}

function changedProp(name: string, from: ShownValue, to: ShownValue) {
  return { change: { from, kind: "changed", to }, name };
}

const UNREADABLE: ShownValue = { kind: "object" };

function saveDraft(draft: string): string {
  return draft.trim();
}

const nameless = Object.defineProperty(() => {}, "name", {
  get() {
    throw new Error("unreadable name");
  },
});

function Badge() {
  return <b>badge</b>;
}

interface InspectorProps {
  first: unknown;
  second: unknown;
  third: unknown;
}

function Inspector({ first, second, third }: InspectorProps) {
  return <output>{[first, second, third].length}</output>;
}

function Panel() {
  const [isEdited, setIsEdited] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setIsEdited(true);
        }}
        type="button"
      >
        edit
      </button>
      <Inspector
        first={isEdited ? <Badge /> : saveDraft}
        second={isEdited ? <section /> : [1]}
        third={isEdited ? [1, 2] : new Map()}
      />
    </>
  );
}

function Drafts() {
  const [tick, setTick] = useState(0);
  const { proxy, revoke } = Proxy.revocable({ tick }, {});
  revoke();
  return (
    <>
      <button
        onClick={() => {
          setTick(tick + 1);
        }}
        type="button"
      >
        tick
      </button>
      <Inspector
        first={tick === 0 ? nameless : null}
        second={proxy}
        third={0}
      />
    </>
  );
}

describe("how a changed value is shown", () => {
  it("names the functions and elements and counts the arrays it changed between", () => {
    render(<Panel />);

    fireEvent.click(screen.getByText("edit"));

    expect(propsChangedOn(screen.getByRole("status"))).toStrictEqual([
      changedProp(
        "first",
        { kind: "function", name: "saveDraft" },
        { kind: "element", name: "Badge" }
      ),
      changedProp(
        "second",
        { kind: "array", length: 1 },
        { kind: "element", name: "section" }
      ),
      changedProp("third", UNREADABLE, { kind: "array", length: 2 }),
    ]);
  });

  it("shows a value it cannot read as an object, and the other side as it is", () => {
    render(<Drafts />);

    fireEvent.click(screen.getByText("tick"));

    expect(propsChangedOn(screen.getByRole("status"))).toStrictEqual([
      changedProp("first", UNREADABLE, { kind: "primitive", text: "null" }),
      changedProp("second", UNREADABLE, UNREADABLE),
    ]);
  });
});
