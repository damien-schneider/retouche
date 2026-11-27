import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ListedAgent } from "../../../protocol";
import type { VoiceProblem } from "../voice";
import { VoiceView } from "../voice-view";
import { RERUN_NAME, RERUN_WITH_NAME, WRITE_NAME } from "./analysis-line";
import { PAUSE_NAME } from "./live/voice-recording";
import { NEW_SESSION_NAME, RECORD_MORE_NAME } from "./session-actions";
import { AGENT_NAME } from "./settings/agent-choice";
import { LISTENING_GROUP_NAME } from "./settings/hearing-choice";
import {
  FEEDBACK_GROUP_NAME,
  LANGUAGE_NAME,
  LIVE_NAME,
} from "./settings/voice-options";
import { START_NAME } from "./settings/voice-settings";
import { fakeVoice, voicePassage, voiceSession } from "./voice-fixture";
import { RESUME_RECORDING_NAME, RETRY_NAME } from "./voice-problem";
import { TRANSCRIPT_NAME } from "./voice-transcript";

const CLAUDE: ListedAgent = {
  id: "claude",
  kind: "command",
  name: "Claude Code",
  state: "ready",
};
const CODEX: ListedAgent = {
  id: "codex",
  kind: "command",
  name: "Codex",
  state: "ready",
};
const MASTRA: ListedAgent = {
  id: "mastracode",
  kind: "command",
  name: "Mastra Code",
  state: "unchecked",
};

afterEach(cleanup);

const spoken = voiceSession({
  passages: [
    voicePassage("p1", { startMs: 1000, text: "The header feels heavy" }),
    voicePassage("p2", { startMs: 9000, text: "Make the save button blue" }),
  ],
});
const written = voiceSession({
  ...spoken,
  analysis: { agent: CLAUDE, at: Date.now(), error: null, passageCount: 2 },
});

function blockedStartFor(problem: VoiceProblem): string {
  const { actions, voice } = fakeVoice({ agents: null, problem });
  const { container, unmount } = render(
    <VoiceView editor={null} voice={voice} />
  );
  const shown = container.textContent;
  fireEvent.click(
    screen.getByRole("button", { description: /\S/, name: START_NAME })
  );
  expect(actions.start).not.toHaveBeenCalled();
  unmount();
  return shown;
}

describe("before recording", () => {
  it("records from the big button", () => {
    const { actions, voice } = fakeVoice();
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: START_NAME }));

    expect(actions.start).toHaveBeenCalledOnce();
  });

  it("saves the language, the agent and live mode", () => {
    const { actions, voice } = fakeVoice();
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.change(screen.getByRole("combobox", { name: LANGUAGE_NAME }), {
      target: { value: "fr-FR" },
    });
    const agents = screen.getByRole("group", { name: AGENT_NAME });
    fireEvent.click(within(agents).getByRole("button", { name: CODEX.name }));
    const feedback = screen.getByRole("group", { name: FEEDBACK_GROUP_NAME });
    fireEvent.click(within(feedback).getByRole("button", { name: LIVE_NAME }));

    expect(actions.setPreferences.mock.calls).toStrictEqual([
      [{ language: "fr-FR" }],
      [{ agent: "codex" }],
      [{ isLive: true }],
    ]);
  });

  it("offers only the agents installed on this machine", () => {
    const { voice } = fakeVoice({ agents: [] });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      within(screen.getByRole("group", { name: AGENT_NAME })).queryAllByRole(
        "button"
      )
    ).toHaveLength(0);
    expect(
      screen.queryByRole("group", { name: FEEDBACK_GROUP_NAME })
    ).toBeNull();
  });
});

describe("what keeps a session from starting", () => {
  it("blames only the missing dev route when nothing answers", () => {
    const { voice } = fakeVoice({ agents: null, problem: "route-missing" });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.queryByText(new RegExp(CLAUDE.name))).toBeNull();
  });

  it("asks for a restart rather than for the route when the dev server runs another version of Retouche", () => {
    expect(blockedStartFor("route-outdated")).not.toBe(
      blockedStartFor("route-missing")
    );
  });

  it("says at the Start button why a browser without speech recognition cannot start", () => {
    const { actions, voice } = fakeVoice({ problem: "unsupported" });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(
      screen.getByRole("button", { description: /\S/, name: START_NAME })
    );

    expect(actions.start).not.toHaveBeenCalled();
  });
});

describe("when something goes wrong", () => {
  it("starts again from the Start button, which says why the last start failed", () => {
    const { actions, voice } = fakeVoice({ problem: "mic-denied" });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(
      screen.getByRole("button", { description: /\S/, name: START_NAME })
    );

    expect(actions.start).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: RETRY_NAME })).toBeNull();
  });

  it("continues the session when speech recognition dropped", () => {
    const { actions, voice } = fakeVoice({
      problem: "speech-network",
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: RETRY_NAME }));

    expect(actions.resume).toHaveBeenCalledOnce();
    expect(actions.start).not.toHaveBeenCalled();
  });

  it("resumes a recording the page reload interrupted", () => {
    const { actions, voice } = fakeVoice({
      problem: "interrupted",
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(
      screen.getByRole("button", { name: RESUME_RECORDING_NAME })
    );

    expect(actions.resume).toHaveBeenCalledOnce();
  });

  it("lets a failed agent run again or hand over to the other agent", () => {
    const { actions, voice } = fakeVoice({
      analysis: { agent: CLAUDE, error: "Timed out", kind: "failed" },
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: RETRY_NAME }));
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(CODEX.name) })
    );

    expect(actions.analyze).toHaveBeenCalledTimes(2);
    expect(actions.setPreferences).toHaveBeenCalledWith({ agent: "codex" });
    expect(screen.getByText(/Timed out/)).toBeTruthy();
  });
});

describe("when the agent fails", () => {
  it("names the failed agent once", () => {
    const { voice } = fakeVoice({
      analysis: {
        agent: CLAUDE,
        error: "Claude Code is not signed in.",
        kind: "failed",
      },
      session: spoken,
    });
    const { container } = render(<VoiceView editor={null} voice={voice} />);

    expect(container.textContent.split(CLAUDE.name)).toHaveLength(2);
  });
});

describe("with every agent installed", () => {
  it("hands a failed run over to any of the others", () => {
    const { actions, voice } = fakeVoice({
      agents: [CLAUDE, CODEX, MASTRA],
      analysis: { agent: CLAUDE, error: "Timed out", kind: "failed" },
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(MASTRA.name) })
    );

    expect(actions.setPreferences).toHaveBeenCalledWith({
      agent: "mastracode",
    });
    expect(actions.analyze).toHaveBeenCalledOnce();
  });

  it("hands a failed run to no agent that is signed out", () => {
    const { voice } = fakeVoice({
      agents: [CLAUDE, { ...CODEX, state: "signed-out" }, MASTRA],
      analysis: { agent: CLAUDE, error: "Timed out", kind: "failed" },
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.getByRole("button", { name: new RegExp(MASTRA.name) })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: new RegExp(CODEX.name) })
    ).toBeNull();
  });
});

describe("while recording", () => {
  it("shows the last sentence and the words being heard", () => {
    const { live, voice } = fakeVoice({ phase: "recording", session: spoken });
    render(<VoiceView editor={null} voice={voice} />);

    act(() => {
      live({ interim: "and the footer" });
    });

    const recording = screen.getByRole("region", { name: "Recording" });
    expect(recording.textContent).toContain("Make the save button blue");
    expect(recording.textContent).toContain("and the footer");
  });

  it("names the element under the pointer", () => {
    const { live, voice } = fakeVoice({ phase: "recording" });
    const target = document.createElement("button");
    target.textContent = "Save changes";
    document.body.append(target);
    render(<VoiceView editor={null} voice={voice} />);

    act(() => {
      live({ pointed: target });
    });

    const recording = screen.getByRole("region", { name: "Recording" });
    expect(recording.textContent).toContain("<button>");
    expect(recording.textContent).toContain("Save changes");
    target.remove();
  });

  it("pauses", () => {
    const { actions, voice } = fakeVoice({ phase: "recording" });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: PAUSE_NAME }));

    expect(actions.pause).toHaveBeenCalledOnce();
  });
});

describe("changing course while recording", () => {
  it("switches the agent, live mode and the language as you talk", () => {
    const { actions, voice } = fakeVoice({ phase: "recording" });
    render(<VoiceView editor={null} voice={voice} />);

    const agents = screen.getByRole("group", { name: AGENT_NAME });
    fireEvent.click(within(agents).getByRole("button", { name: CODEX.name }));
    const feedback = screen.getByRole("group", { name: FEEDBACK_GROUP_NAME });
    fireEvent.click(within(feedback).getByRole("button", { name: LIVE_NAME }));
    fireEvent.change(screen.getByRole("combobox", { name: LANGUAGE_NAME }), {
      target: { value: "fr-FR" },
    });

    expect(actions.setPreferences.mock.calls).toStrictEqual([
      [{ agent: "codex" }],
      [{ isLive: true }],
      [{ language: "fr-FR" }],
    ]);
  });

  it("offers each agent once, in the choice that applies to what comes next", () => {
    const { voice } = fakeVoice({ phase: "recording", session: written });
    render(<VoiceView editor={null} voice={voice} />);

    const offers = [
      ...screen.getAllByRole("option"),
      ...screen.queryAllByRole("button"),
    ].filter((offer) => offer.textContent.includes(CODEX.name));
    expect(offers).toHaveLength(1);
  });
});

describe("a language speech recognition does not know", () => {
  it("offers one language choice while paused", () => {
    const { voice } = fakeVoice({
      phase: "paused",
      problem: "speech-language",
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.getAllByRole("combobox", { name: LANGUAGE_NAME })
    ).toHaveLength(1);
  });

  it("offers the language choice after stopping", () => {
    const { voice } = fakeVoice({
      problem: "speech-language",
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.getAllByRole("combobox", { name: LANGUAGE_NAME })
    ).toHaveLength(1);
  });
});

describe("a browser that hears speech but returns no words", () => {
  it("offers another way to listen while paused", () => {
    const { voice } = fakeVoice({
      phase: "paused",
      problem: "speech-silent",
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.getAllByRole("group", { name: LISTENING_GROUP_NAME })
    ).toHaveLength(1);
  });
});

describe("after recording", () => {
  it("shows each passage raw until feedback is written", () => {
    const { actions, voice } = fakeVoice({ session: spoken });
    render(<VoiceView editor={null} voice={voice} />);

    const list = screen.getByRole("list", { name: "Feedback" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: WRITE_NAME }));
    expect(actions.analyze).toHaveBeenCalledOnce();
  });

  it("marks the raw passages while the agent reads them", () => {
    const { voice } = fakeVoice({
      analysis: { agent: CLAUDE, kind: "running" },
      session: spoken,
    });
    render(<VoiceView editor={null} voice={voice} />);

    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.dataset.understanding)).toStrictEqual([
      "true",
      "true",
    ]);
  });

  it("re-runs a finished analysis", () => {
    const { actions, voice } = fakeVoice({ session: written });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: RERUN_NAME }));

    expect(actions.analyze).toHaveBeenCalledOnce();
  });

  it("re-runs with another agent picked from the writer line", () => {
    const { actions, voice } = fakeVoice({ session: written });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.queryByRole("button", { name: new RegExp(CODEX.name) })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: RERUN_WITH_NAME }));
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(CODEX.name) })
    );

    expect(actions.setPreferences).toHaveBeenCalledWith({ agent: "codex" });
    expect(actions.analyze).toHaveBeenCalledOnce();
  });
});

describe("the session afterwards", () => {
  it("keeps the full transcript", () => {
    const { voice } = fakeVoice({ session: spoken });
    render(<VoiceView editor={null} voice={voice} />);

    const transcript = screen.getByText(TRANSCRIPT_NAME).closest("details");
    const lines = within(transcript ?? document.body).getAllByRole("listitem");
    expect(lines.map((line) => line.textContent)).toStrictEqual([
      "0:01The header feels heavy",
      "0:09Make the save button blue",
    ]);
  });

  it("records more into the same session", () => {
    const { actions, voice } = fakeVoice({ session: spoken });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: RECORD_MORE_NAME }));

    expect(actions.resume).toHaveBeenCalledOnce();
  });

  it("starts a new session at once, leaving this one in the history", () => {
    const { actions, voice } = fakeVoice({ session: spoken });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: NEW_SESSION_NAME }));

    expect(actions.newSession).toHaveBeenCalledOnce();
  });
});
