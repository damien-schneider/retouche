import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { fakeVoice } from "../view/voice-fixture";
import { VoicePageLayer } from "./voice-page-layer";

afterEach(cleanup);

function pointedButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "Save";
  document.body.append(button);
  return button;
}

describe("the page while recording", () => {
  it("outlines and names the element being pointed at", () => {
    const { live, voice } = fakeVoice({ phase: "recording" });
    const { container } = render(<VoicePageLayer voice={voice} />);

    act(() => {
      live({ pointed: pointedButton() });
    });

    expect(container.textContent).toContain("<button>");
  });

  it("drops the outline while paused", () => {
    const { live, voice } = fakeVoice({ phase: "paused" });
    const { container } = render(<VoicePageLayer voice={voice} />);

    act(() => {
      live({ pointed: pointedButton() });
    });

    expect(container.textContent).not.toContain("<button>");
  });
});

function outlineFor(phase: "paused" | "recording") {
  const { live, voice } = fakeVoice({ phase });
  const { container } = render(<VoicePageLayer voice={voice} />);
  act(() => {
    live({ pointed: pointedButton() });
  });
  return container;
}

describe("holding Space while recording", () => {
  it("hides the outline until Space is released", () => {
    const container = outlineFor("recording");

    const isPageKept = fireEvent.keyDown(window, { key: " " });
    const hidden = container.textContent;
    fireEvent.keyUp(window, { key: " " });

    expect(isPageKept).toBeFalsy();
    expect(hidden).not.toContain("<button>");
    expect(container.textContent).toContain("<button>");
  });

  it("brings the outline back when the window loses focus", () => {
    const container = outlineFor("recording");

    fireEvent.keyDown(window, { key: " " });
    const hidden = container.textContent;
    fireEvent.blur(window);

    expect(hidden).not.toContain("<button>");
    expect(container.textContent).toContain("<button>");
  });

  it("leaves a space typed in the page's fields alone", () => {
    const container = outlineFor("recording");
    const field = document.createElement("input");
    document.body.append(field);

    const isTyped = fireEvent.keyDown(field, { key: " " });

    expect(isTyped).toBeTruthy();
    expect(container.textContent).toContain("<button>");
    field.remove();
  });

  it("lets Space through while paused", () => {
    outlineFor("paused");

    expect(fireEvent.keyDown(window, { key: " " })).toBeTruthy();
  });

  it("lets Space through when no session runs", () => {
    render(<VoicePageLayer voice={fakeVoice().voice} />);

    expect(fireEvent.keyDown(window, { key: " " })).toBeTruthy();
  });
});
