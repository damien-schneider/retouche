import { act, cleanup, render } from "@testing-library/react";
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
