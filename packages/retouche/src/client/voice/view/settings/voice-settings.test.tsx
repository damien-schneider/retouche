import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  BUILT_IN_AGENTS,
  type ListedAgent,
  type ListedTranscriber,
} from "../../../../protocol";
import type { VoicePreferences } from "../../voice";
import { VoiceView } from "../../voice-view";
import { COPY_ALL_NAME } from "../session-actions";
import { fakeVoice, voicePassage, voiceSession } from "../voice-fixture";
import { AGENT_NAME } from "./agent-choice";
import {
  BROWSER_NAME,
  DEVICE_NAME,
  LISTENING_GROUP_NAME,
} from "./hearing-choice";
import {
  ADD_KEY_NAME,
  FORGET_KEY_NAME,
  KEY_NAME,
  PROVIDER_NAME,
  SAVE_KEY_NAME,
} from "./transcriber-key";
import { START_NAME } from "./voice-settings";

afterEach(cleanup);

const MANY_AGENTS: ListedAgent[] = [
  { id: "claude", kind: "command", name: "Claude Code", state: "ready" },
  { id: "codex", kind: "command", name: "Codex", state: "ready" },
  {
    id: "mastracode",
    kind: "command",
    name: "Mastra Code",
    state: "unchecked",
  },
  {
    id: "gemini",
    kind: "command",
    name: "Gemini CLI through the Agent Client Protocol",
    state: "unchecked",
  },
  {
    id: "openrouter",
    kind: "endpoint",
    name: "OpenRouter · anthropic/claude-sonnet-4.5",
    state: "unchecked",
  },
  {
    id: "ollama",
    kind: "endpoint",
    name: "Ollama on this machine · qwen3-coder:30b",
    state: "unchecked",
  },
];

const EVERY_STATE: ListedAgent[] = [
  { id: "claude", kind: "command", name: "Claude Code", state: "ready" },
  { id: "codex", kind: "command", name: "Codex", state: "signed-out" },
  {
    id: "mastracode",
    kind: "command",
    name: "Mastra Code",
    state: "unchecked",
  },
];

const CONFIGURED: ListedTranscriber = {
  id: "configured",
  name: "Groq Whisper",
  source: "config",
};
const SAVED: ListedTranscriber = { id: "groq", name: "Groq", source: "saved" };
const FROM_ENV: ListedTranscriber = {
  id: "openai",
  keyEnv: "OPENAI_API_KEY",
  name: "OpenAI",
  source: "env",
};

function chosen(next: Partial<VoicePreferences>): VoicePreferences {
  return {
    agent: "claude",
    hearing: "browser",
    isLive: false,
    language: "en-US",
    transcriber: null,
    ...next,
  };
}

function namesEachBuiltInAgentOnce(): void {
  for (const { name } of BUILT_IN_AGENTS) {
    expect(screen.getAllByText(new RegExp(name))).toHaveLength(1);
  }
}

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

function listeningOptions(): (string | null)[] {
  const listening = screen.getByRole("group", { name: LISTENING_GROUP_NAME });
  return within(listening)
    .getAllByRole("button")
    .map((option) => option.textContent);
}

function enterKey(provider: string, key: string): void {
  fireEvent.click(screen.getByRole("button", { name: ADD_KEY_NAME }));
  fireEvent.click(
    within(screen.getByRole("group", { name: PROVIDER_NAME })).getByRole(
      "button",
      { name: provider }
    )
  );
  fireEvent.change(screen.getByLabelText(KEY_NAME), {
    target: { value: key },
  });
  fireEvent.click(screen.getByRole("button", { name: SAVE_KEY_NAME }));
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

  it("says what the chosen agent does with the session, depending on where it runs", () => {
    const { voice } = fakeVoice({ agents: MANY_AGENTS });
    render(<VoiceView editor={null} voice={voice} />);
    const onThisComputer = descriptionOf("Claude Code");
    cleanup();
    const { voice: throughEndpoint } = fakeVoice({
      agents: MANY_AGENTS,
      preferences: chosen({ agent: "ollama" }),
    });
    render(<VoiceView editor={null} voice={throughEndpoint} />);

    expect(onThisComputer).not.toBe("");
    expect(descriptionOf("Ollama on this machine · qwen3-coder:30b")).not.toBe(
      ""
    );
    expect(descriptionOf("Ollama on this machine · qwen3-coder:30b")).not.toBe(
      onThisComputer
    );
  });
});

describe("whether an agent can write feedback", () => {
  it("flags only the agents that are signed out", () => {
    const { voice } = fakeVoice({ agents: EVERY_STATE });
    render(<VoiceView editor={null} voice={voice} />);

    expect(descriptionOf("Codex")).not.toBe("");
    expect(descriptionOf("Mastra Code")).toBe("");
  });

  it("names the command that signs the chosen agent in when it is signed out", () => {
    const { voice } = fakeVoice({
      agents: EVERY_STATE,
      preferences: chosen({ agent: "codex" }),
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
  it("offers the ways of listening this browser can use, then each speech-to-text key", () => {
    const { voice } = fakeVoice({
      hearings: ["browser"],
      transcribers: [CONFIGURED, FROM_ENV],
    });
    render(<VoiceView editor={null} voice={voice} />);

    expect(listeningOptions()).toStrictEqual([
      BROWSER_NAME,
      "Groq Whisper",
      "OpenAI",
    ]);
  });

  it("saves the way of listening", () => {
    const { actions, voice } = fakeVoice({ hearings: ["browser", "device"] });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(
      within(
        screen.getByRole("group", { name: LISTENING_GROUP_NAME })
      ).getByRole("button", { name: DEVICE_NAME })
    );

    expect(actions.setPreferences).toHaveBeenCalledWith({ hearing: "device" });
  });

  it("listens through a key found on the dev server only once it is picked", () => {
    const { actions, voice } = fakeVoice({
      hearings: ["browser"],
      transcribers: [FROM_ENV],
    });
    render(<VoiceView editor={null} voice={voice} />);
    const listening = screen.getByRole("group", { name: LISTENING_GROUP_NAME });
    const openai = within(listening).getByRole("button", { name: "OpenAI" });
    const wasPicked = openai.getAttribute("aria-pressed");

    fireEvent.click(openai);

    expect(wasPicked).toBe("false");
    expect(actions.setPreferences).toHaveBeenCalledWith({
      hearing: "transcriber",
      transcriber: "openai",
    });
  });
});

describe("when Retouche asks how to listen", () => {
  it("names the one way it can listen instead of asking", () => {
    const { voice } = fakeVoice({ hearings: ["browser"] });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.queryByRole("button", { name: BROWSER_NAME })).toBeNull();
    expect(screen.getByText(BROWSER_NAME)).toBeTruthy();
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

describe("a speech-to-text key added from the start screen", () => {
  it("is handed to the dev server with its provider, and the form closes", async () => {
    const { actions, voice } = fakeVoice({ canAddKey: true });
    render(<VoiceView editor={null} voice={voice} />);

    enterKey("Groq", "gsk-1");

    await waitFor(() => {
      expect(screen.queryByLabelText(KEY_NAME)).toBeNull();
    });
    expect(actions.saveKey).toHaveBeenCalledWith("groq", "gsk-1");
  });

  it("stays typed in, with the provider's reason, when it is refused", async () => {
    const { actions, voice } = fakeVoice({ canAddKey: true });
    actions.saveKey.mockResolvedValue("Groq turned the key down.");
    render(<VoiceView editor={null} voice={voice} />);

    enterKey("Groq", "gsk-typo");

    await expect(
      screen.findByText("Groq turned the key down.")
    ).resolves.toBeTruthy();
    expect(screen.getByDisplayValue("gsk-typo")).toBeTruthy();
  });

  it("is not offered where this browser cannot send audio", () => {
    const { voice } = fakeVoice({ canAddKey: false });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.queryByRole("button", { name: ADD_KEY_NAME })).toBeNull();
  });

  it("can be forgotten while listening through it, unlike a key the dev server holds", () => {
    const { actions, voice } = fakeVoice({
      canAddKey: true,
      preferences: chosen({ hearing: "transcriber", transcriber: "groq" }),
      transcribers: [SAVED, FROM_ENV],
    });
    render(<VoiceView editor={null} voice={voice} />);

    fireEvent.click(screen.getByRole("button", { name: FORGET_KEY_NAME }));
    cleanup();
    const { voice: throughEnv } = fakeVoice({
      canAddKey: true,
      preferences: chosen({ hearing: "transcriber", transcriber: "openai" }),
      transcribers: [SAVED, FROM_ENV],
    });
    render(<VoiceView editor={null} voice={throughEnv} />);

    expect(actions.forgetKey).toHaveBeenCalledWith("groq");
    expect(screen.queryByRole("button", { name: FORGET_KEY_NAME })).toBeNull();
  });
});

describe("once a key is ready to listen through", () => {
  it("offers no other key to add", () => {
    const { voice } = fakeVoice({ canAddKey: true, transcribers: [FROM_ENV] });
    render(<VoiceView editor={null} voice={voice} />);

    expect(screen.queryByRole("button", { name: ADD_KEY_NAME })).toBeNull();
  });

  it("lands on the way of listening the saved key gives", async () => {
    const { actions, voice } = fakeVoice({ canAddKey: true });
    const { voice: withKey } = fakeVoice({
      canAddKey: true,
      preferences: chosen({ hearing: "transcriber", transcriber: "groq" }),
      transcribers: [SAVED],
    });
    const { rerender } = render(<VoiceView editor={null} voice={voice} />);
    actions.saveKey.mockImplementation(async () => {
      await Promise.resolve();
      rerender(<VoiceView editor={null} voice={withKey} />);
      return null;
    });

    enterKey("Groq", "gsk-1");

    await waitFor(() => {
      const listening = screen.getByRole("group", {
        name: LISTENING_GROUP_NAME,
      });
      expect(document.activeElement).toBe(
        within(listening).getByRole("button", { name: "Groq" })
      );
    });
  });
});
