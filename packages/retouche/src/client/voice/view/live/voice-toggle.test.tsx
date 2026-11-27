import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_NAME, VoiceToggle } from "../../voice-toggle";
import { fakeVoice, voicePassage, voiceSession } from "../voice-fixture";
import { RESUME_NAME, STOP_NAME } from "./voice-recording";

afterEach(cleanup);

const SPACE = /space/i;
const OPEN_PILL = new RegExp(`^${SESSION_NAME}`);

describe("the idle voice toggle", () => {
  it.each(["bar", "panel"] as const)(
    "opens the session from the %s without turning the microphone on",
    (place) => {
      const { actions, voice } = fakeVoice();
      const onOpen = vi.fn<() => void>();
      render(<VoiceToggle onOpen={onOpen} place={place} voice={voice} />);

      fireEvent.click(screen.getByRole("button", { name: SESSION_NAME }));

      expect(onOpen).toHaveBeenCalledOnce();
      expect(actions.start).not.toHaveBeenCalled();
    }
  );

  it("counts what was said and opens it instead of recording over it", () => {
    const session = voiceSession({
      passages: [voicePassage("p1"), voicePassage("p2")],
    });
    const { actions, voice } = fakeVoice({ session });
    const onOpen = vi.fn<() => void>();
    render(<VoiceToggle onOpen={onOpen} place="panel" voice={voice} />);

    const button = screen.getByRole("button", { name: OPEN_PILL });
    fireEvent.click(button);

    expect(button.textContent).toContain("2");
    expect(onOpen).toHaveBeenCalledOnce();
    expect(actions.start).not.toHaveBeenCalled();
  });
});

describe("the recording voice toggle", () => {
  it("follows the clock and the words", () => {
    const { live, voice } = fakeVoice({ phase: "recording" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="bar" voice={voice} />
    );
    const pill = screen.getByRole("button", { name: OPEN_PILL });

    act(() => {
      live({ elapsedMs: 65_400, interim: "make the header lighter" });
    });

    expect(pill.textContent).toContain("1:05");
    expect(pill.textContent).toContain("make the header lighter");
  });

  it("keeps the words out of the narrow panel pill", () => {
    const { live, voice } = fakeVoice({ phase: "recording" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="panel" voice={voice} />
    );

    act(() => {
      live({ interim: "make the header lighter" });
    });

    const pill = screen.getByRole("button", { name: OPEN_PILL });
    expect(pill.textContent).not.toContain("make the header lighter");
  });

  it("stops and opens the feedback in one press", () => {
    const { actions, voice } = fakeVoice({ phase: "recording" });
    const onOpen = vi.fn<() => void>();
    render(<VoiceToggle onOpen={onOpen} place="bar" voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: STOP_NAME }));

    expect(actions.stop).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

describe("leaving the recording", () => {
  it("hands focus back to the toggle when the stop button goes away", () => {
    const { voice } = fakeVoice({ phase: "recording" });
    const onOpen = vi.fn<() => void>();
    const { rerender } = render(
      <VoiceToggle onOpen={onOpen} place="bar" voice={voice} />
    );
    screen.getByRole("button", { name: STOP_NAME }).focus();

    rerender(
      <VoiceToggle
        onOpen={onOpen}
        place="bar"
        voice={{ ...voice, phase: "idle" }}
      />
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: SESSION_NAME })
    );
  });
});

describe("the paused voice toggle", () => {
  it("resumes", () => {
    const { actions, voice } = fakeVoice({ phase: "paused" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="bar" voice={voice} />
    );

    fireEvent.click(screen.getByRole("button", { name: RESUME_NAME }));

    expect(actions.resume).toHaveBeenCalledOnce();
  });
});

describe("the bar while recording with nothing said", () => {
  it("tells how to hide the outline, until words come", () => {
    const { live, voice } = fakeVoice({ phase: "recording" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="bar" voice={voice} />
    );
    const pill = screen.getByRole("button", { name: OPEN_PILL });
    const quiet = pill.textContent;

    act(() => {
      live({ interim: "make the header lighter" });
    });

    expect(quiet).toMatch(SPACE);
    expect(pill.textContent).not.toMatch(SPACE);
  });

  it("says the outline is hidden while Space is held", () => {
    const { voice } = fakeVoice({ phase: "recording" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="bar" voice={voice} />
    );
    const pill = screen.getByRole("button", { name: OPEN_PILL });
    const before = pill.textContent;

    fireEvent.keyDown(window, { key: " " });

    expect(pill.textContent).not.toBe(before);
  });

  it("keeps the hint out of the paused bar", () => {
    const { voice } = fakeVoice({ phase: "paused" });
    render(
      <VoiceToggle onOpen={vi.fn<() => void>()} place="bar" voice={voice} />
    );

    expect(
      screen.getByRole("button", { name: OPEN_PILL }).textContent
    ).not.toMatch(SPACE);
  });
});
