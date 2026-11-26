import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BUILT_IN_AGENTS, type ListedAgent } from "../../../../protocol";
import { VoiceView } from "../../voice-view";
import { COPY_ALL_NAME } from "../session-actions";
import { fakeVoice, voicePassage, voiceSession } from "../voice-fixture";
import { AGENT_NAME } from "./agent-choice";
import {
  BROWSER_NAME,
  DEVICE_NAME,
  LISTENING_GROUP_NAME,
} from "./hearing-choice";
import { START_NAME } from "./voice-settings";

afterEach(cleanup);

const MANY_AGENTS: ListedAgent[] = [
  { id: "claude", name: "Claude Code", state: "ready" },
  { id: "codex", name: "Codex", state: "ready" },
  { id: "mastracode", name: "Mastra Code", state: "unchecked" },
  {
    id: "gemini",
    name: "Gemini CLI through the Agent Client Protocol",
    state: "unchecked",
  },
  {
    id: "openrouter",
    name: "OpenRouter · anthropic/claude-sonnet-4.5",
    state: "unchecked",
  },
  {
    id: "ollama",
    name: "Ollama on this machine · qwen3-coder:30b",
    state: "unchecked",
  },
];

function namesEachBuiltInAgentOnce(): void {
  for (const { name } of BUILT_IN_AGENTS) {
    expect(screen.getAllByText(new RegExp(name))).toHaveLength(1);
  }
}

const EVERY_STATE: ListedAgent[] = [
  { id: "claude", name: "Claude Code", state: "ready" },
  { id: "codex", name: "Codex", state: "signed-out" },
  { id: "mastracode", name: "Mastra Code", state: "unchecked" },
];

function descriptionOf(name: string): string {
  let description = "";
  within(screen.getByRole("group", { name: AGENT_NAME })).getByRole("button", {
    description: (text) => {
      description = text;
      return true;
    },
    name,
  });
  return description;
}

describe("the agent that writes feedback", () => {
  it("lists every configured agent, whatever its name", () => {
    const { voice } = fakeVoice({ agents: MANY_AGENTS });
    render(<VoiceView editor={null} voice={voice} />);

    const agents = screen.getByRole("group", { name: AGENT_NAME });
    expect(within(agents).getAllByRole("button")).toHaveLength(
      MANY_AGENTS.length
    );
    for (const { name } of MANY_AGENTS) {
      expect(within(agents).getByRole("button", { name })).toBeTruthy();
    }
  });

  it("saves the agent picked far down the list", () => {
    const { actions, voice } = fakeVoice({ agents: MANY_AGENTS });
    render(<VoiceView editor={null} voice={voice} />);

    const agents = screen.getByRole("group", { name: AGENT_NAME });
    fireEvent.click(
      within(agents).getByRole("button", {
        name: "Ollama on this machine · qwen3-coder:30b",
      })
    );

    expect(actions.setPreferences).toHaveBeenCalledWith({ agent: "ollama" });
  });
});

describe("whether an agent can write feedback", () => {
  it("shows each agent signed in, signed out or unchecked without opening anything", () => {
    const { voice } = fakeVoice({ agents: EVERY_STATE });
    render(<VoiceView editor={null} voice={voice} />);

    const told = EVERY_STATE.map(({ name }) => descriptionOf(name));

    expect(told).not.toContain("");
    expect(new Set(told).size).toBe(EVERY_STATE.length);
  });

  it("names the command that signs the chosen agent in when it is signed out", () => {
    const { voice } = fakeVoice({
      agents: EVERY_STATE,
      preferences: {
        agent: "codex",
        hearing: "browser",
        isLive: false,
        language: "en-US",
      },
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(descriptionOf("Codex")).toContain("codex");
  });
});

describe("with no agent to write feedback", () => {
  it("still records, and says where an agent would come from", () => {
    const { actions, voice } = fakeVoice({ agents: [] });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: START_NAME }));

    expect(actions.start).toHaveBeenCalledOnce();
    expect(screen.getByRole("group", { name: AGENT_NAME })).toBeTruthy();
    namesEachBuiltInAgentOnce();
  });

  it("hands what was said to any agent after the recording, saying once how to have it written here", () => {
    const session = voiceSession({
      passages: [voicePassage("p1", { text: "The header feels heavy" })],
    });
    const { voice } = fakeVoice({ agents: [], session });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.getByRole("button", { name: COPY_ALL_NAME })).toBeTruthy();
    namesEachBuiltInAgentOnce();
  });
});

describe("how Retouche listens", () => {
  it("offers only the ways of listening this browser can use", () => {
    const { voice } = fakeVoice({
      hearings: ["browser", "transcriber"],
      transcriber: "Groq Whisper",
    });
    render(<VoiceView editor={null} voice={voice} />);

    const listening = screen.getByRole("group", { name: LISTENING_GROUP_NAME });
    expect(
      within(listening)
        .getAllByRole("button")
        .map((option) => option.textContent)
    ).toStrictEqual([BROWSER_NAME, "Groq Whisper"]);
  });

  it("saves the way of listening", () => {
    const { actions, voice } = fakeVoice({
      hearings: ["browser", "device"],
    });
    render(<VoiceView editor={null} voice={voice} />);

    const listening = screen.getByRole("group", { name: LISTENING_GROUP_NAME });
    fireEvent.click(
      within(listening).getByRole("button", { name: DEVICE_NAME })
    );

    expect(actions.setPreferences).toHaveBeenCalledWith({ hearing: "device" });
  });

  it("asks how to listen only before the session starts", () => {
    const { voice } = fakeVoice({
      hearings: ["browser", "device"],
      phase: "recording",
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(
      screen.queryByRole("group", { name: LISTENING_GROUP_NAME })
    ).toBeNull();
  });
});
