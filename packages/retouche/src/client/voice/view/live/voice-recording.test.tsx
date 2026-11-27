import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { fakeVoice } from "../voice-fixture";
import { PAUSE_NAME, VoiceRecording } from "./voice-recording";

afterEach(cleanup);

const SPACE = /space/i;

function recordingView() {
  return screen.getByRole("region", { name: "Recording" });
}

describe("the panel's recording view", () => {
  it("tells how to hide the outline while recording", () => {
    render(<VoiceRecording voice={fakeVoice({ phase: "recording" }).voice} />);

    expect(within(recordingView()).getByText(SPACE)).toBeTruthy();
  });

  it("says the outline is hidden while Space is held", () => {
    render(<VoiceRecording voice={fakeVoice({ phase: "recording" }).voice} />);
    const before = recordingView().textContent;

    fireEvent.keyDown(window, { key: " " });
    const held = recordingView().textContent;
    fireEvent.keyUp(window, { key: " " });

    expect(held).not.toBe(before);
    expect(recordingView().textContent).toBe(before);
  });

  it("leaves the hint out while paused", () => {
    render(<VoiceRecording voice={fakeVoice({ phase: "paused" }).voice} />);

    expect(within(recordingView()).queryByText(SPACE)).toBeNull();
  });

  it("never pauses when Space is held on the focused Pause button", () => {
    const { actions, voice } = fakeVoice({ phase: "recording" });
    render(<VoiceRecording voice={voice} />);
    const pause = screen.getByRole("button", { name: PAUSE_NAME });
    pause.focus();

    const isPressed = fireEvent.keyDown(pause, { key: " " });
    fireEvent.keyUp(pause, { key: " " });

    expect(isPressed).toBeFalsy();
    expect(actions.pause).not.toHaveBeenCalled();
  });
});
