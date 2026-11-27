# Voice sessions

Talk while pointing at the page, and an agent turns what you said into feedback cards for your coding agent. A session keeps what you say and when, the element under the pointer and what you click, and a screenshot as each sentence starts or a click changes the screen.

Each card says what to change, quotes you, names the component and its call site, and shows the screenshot with the element outlined and an arrow on it. Copy all hands the session to any coding agent as markdown, with what to do with it and each screenshot saved as a file it can open. Every session is saved on your computer, outside the project.

The writer is your own Claude Code, Codex or Mastra Code, or any ACP agent or OpenAI-compatible model you add. Retouche runs it in the background, so there is nothing to launch or keep open.

Voice sessions are experimental and off by default. Turn them on with the `voice` prop: `<Retouche config={config} voice />`.

## Start screen

Session, on the bar or in the panel's head, opens the voice place without recording. The microphone stays off until Start recording. Before the first recording the place shows the start screen:

- **What a session keeps**, with where it is kept behind its `i`.
- **Language.**
- **Listening.** Browser, On this device where Chrome offers it, then each speech-to-text key the dev server holds. A lone way is named rather than offered, and where the audio goes sits behind its `i`. While there is no key, Add a speech-to-text key opens a form for a Groq, Mistral or OpenAI key right there.
- **Feedback.** While I talk or When I stop.
- **Written by.** A dropdown of every agent found or added, which flags only the ones not signed in. Where the chosen one runs and what it gets sit behind its `i`; when it is signed out, the command that signs it in sits right under it.
- **Start recording**, centered, with what keeps it from starting right under it.

Each `i` opens its tip on hover, focus or tap, and `Esc` closes it.

## While recording

An outline names the element you point at. Hold `Space` to hide it while you keep pointing, and let go to bring it back. A space typed in a field still types, and a held `Space` neither scrolls the page nor presses the focused button.

The voice place, ringed in red, shows Recording, the time, Pause and Stop, what you are saying, the element you point at and the `Space` hint, then the same choices as the start screen, which you can change as you talk.

On the bar, Session turns red, its dot pulsing, and becomes the time, your voice level and the last words heard, or, while you say nothing, how to hide the outline, with Stop.

## Feedback cards

Each card has its quote, the time you said it, the component and the annotated screenshot, which a click zooms out to the whole screen. Copy a card, open its call site in your editor or dismiss it.

Above the cards:

- one line says when the session was recorded and for how long, and opens History;
- under it, the agent that wrote the cards and when, with Re-run and, behind its arrow, the other agents;
- then Copy all, Record more and New session, which opens the start screen and keeps this session in History.

What you say and the screenshots are saved as they come, whatever the agent does. After a failed run, While I talk asks the agent again only when you re-run it or stop. The full transcript folds away under the cards.

## History

History, at the top of the voice place once a session is saved, lists this project's sessions newest first, each with what was said first, its date, length, item count and page. Open one to get its cards, Copy all and Record more. Delete asks before it discards one.

## Apply as you talk

While you record, your own coding agent can make each change as you say it.

1. Copy the prompt from the voice place into Claude Code, Codex, Cursor or any agent that runs commands. Agents that prefer MCP get the same feed from `retouche mcp`. Preview, under the copy buttons, shows exactly what each one copies.
2. The agent loops on `retouche next`, which hands it each card once you have moved on from it or gone quiet, and takes back its report.
3. Each card then shows what the agent did with it (working, applied, skipped or undone) with its note. Ask the agent to undo sends an applied card back, and Copy all hands over only what is left.

Retouche still edits nothing: your agent does, on its own permissions, and the feed goes through files in your data folder, never the dev route.

## Setting up writers and speech-to-text

Voice sessions find Claude Code, Codex and Mastra Code on their own, and a Groq, Mistral or OpenAI key in the dev server's environment or the app's `.env.local`. Any other writer, and any other transcriber, go in the dev server's options, never in `retouche.config.ts`: they name commands to run and keys to read, which the browser never sees.

| To | Set up |
| --- | --- |
| Record, then copy what you said and the screenshots for any agent | Nothing beyond the dev route |
| Have Claude Code, Codex or Mastra Code write the feedback | Install it and sign in once from a terminal; Retouche finds it, and checks the sign-in of Claude Code and Codex each time you come back to the page |
| Have another agent write it | An `acp` entry in `voice.agents` |
| Have a model write it through its API, or a local one | An `endpoint` entry in `voice.agents` |
| Listen on this device | Nothing: Chrome offers it per language and downloads it once |
| Listen through a speech-to-text API, in any browser | Add a Groq, Mistral or OpenAI key from the start screen, or set `GROQ_API_KEY`, `MISTRAL_API_KEY` or `OPENAI_API_KEY` in the dev server's environment or the app's `.env.local`; `voice.transcriber` for any other OpenAI-compatible API |

### Speech-to-text keys

A key found in the environment is offered but only used once you pick it. A saved key wins over the same provider's environment variable.

A key added from the start screen goes once to the dev route, which checks it with the provider before keeping it and never sends it back. It is kept for every project in `~/.config/retouche/keys.json` (under `$XDG_CONFIG_HOME` or `%APPDATA%` when set), readable only by you, never in the repo. Forget key, next to it in Listening, deletes it.

While you type it, the key is in the page, where any script running there, the app's or an extension's, could read it. A key in the environment or `.env.local` never enters the browser:

- Next.js loads `.env.local` into the environment; the route drops every variable Next loaded from the app's env files except `RETOUCHE_` variables and the keys Retouche reads.
- The Vite plugin reads the app's env files, `.env`, `.env.local` and their mode variants, and takes from them only `RETOUCHE_` variables and the keys Retouche reads.
- Either way, the app's other secrets stay out of the route and its agents.
- Keep `.env.local` out of git, and never prefix a key with `VITE_` or `NEXT_PUBLIC_`, which bundles it into the page.

| Provider | Model | How |
| --- | --- | --- |
| Groq | `whisper-large-v3-turbo` | One clip per sentence |
| OpenAI | `gpt-transcribe` | One clip per sentence |
| Mistral | `voxtral-mini-transcribe-realtime-3` | As you speak: the dev route streams each sentence over a WebSocket, which needs Node 22 or later, and the words show about half a second behind. Mistral bills the audio streamed, each sentence and its 1.5 s tail |

### Other writers and transcribers

```ts
// vite.config.ts
retouche({
  voice: {
    agents: [
      { kind: "acp", name: "Copilot", command: "copilot", args: ["--acp"] },
      {
        kind: "endpoint",
        name: "Mastra Gateway",
        baseUrl: "https://gateway-api.mastra.ai/v1",
        model: "anthropic/claude-sonnet-4-5",
        apiKeyEnv: "MASTRA_GATEWAY_API_KEY",
      },
      {
        kind: "endpoint",
        name: "Ollama",
        baseUrl: "http://localhost:11434/v1",
        model: "qwen2.5vl",
      },
    ],
    transcriber: {
      name: "Mastra Gateway",
      baseUrl: "https://gateway-api.mastra.ai/v1",
      model: "deepgram/nova-3",
      apiKeyEnv: "MASTRA_GATEWAY_API_KEY",
    },
  },
});
```

On Next.js, pass the same options to the route: `export const { GET, POST } = createRoute({ voice: { … } })`, with `createRoute` from `retouche-dev/next`.

| Field | Purpose |
| --- | --- |
| `voice.agents` | Writers offered next to the built-in ones, in this order. Each `name` is shown in the panel and must differ from the others and from the built-in agents |
| `kind: "acp"` | Any agent that speaks the [Agent Client Protocol](https://agentclientprotocol.com) on stdio, started with `command` and `args`: `copilot --acp`, `gemini --acp`, `opencode acp` and others. It is listed when `command` is found. It runs in a temporary folder, gets no file system or terminal from Retouche, and of the permissions it asks for, only reading and searching files are granted; what it does without asking is up to the agent |
| `mode` | Optional, ACP only: the id of one of the agent's session modes to switch to before the run, such as a read-only or faster mode. A mode the agent does not offer fails the run with the ones it does |
| `kind: "endpoint"` | Any OpenAI-compatible Chat Completions API: Mastra Gateway, OpenRouter, OpenAI, Ollama or LM Studio. `baseUrl` is the part before `/chat/completions`; the model needs image input and structured output |
| `apiKeyEnv` | The environment variable holding the key, sent as a Bearer token. An agent or transcriber whose variable is empty is not offered. Leave it out for a local server |
| `voice.transcriber` | An OpenAI-compatible `/audio/transcriptions` API. Each sentence is sent as one short clip; the audio is never written to disk |

Invalid voice options stop the dev server at startup with every issue listed.

## How a session works

### Listening

Voice sessions listen in one of three ways:

- **Browser** uses the browser's speech recognition, in Chrome, Edge or Safari. Chrome sends the audio to Google's speech service.
- **On this device** uses Chrome's on-device recognition, offered when Chrome can run it for the language, after downloading the language once. The audio stays on the computer.
- **A speech-to-text key**, from the start screen, the environment or the `voice` options, gets one clip per sentence, cut after 1.5 s of silence or at 60 s, through the dev route, which never stores it. A Mistral key gets the same sentences as they are said, streamed through the dev route, so the words show while you talk.

Recognition is primed with the page's own words, up to 60 short headings, buttons, links and labels plus the components you point at, where the browser supports it; they go nowhere else. Outside a speech-to-text key, the microphone itself only drives the level meter.

### Pointing and screenshots

While you talk, Retouche notes each element the pointer rests on for 350 ms and each click, with its component, call site, text and box. It captures the viewport with snapdom, without the overlay, when you start a sentence or click on a screen that changed since the last capture.

Each sentence is linked to what you pointed at from 2 s before it to 1 s after it, and each of its words to what you pointed at or clicked while you said it, so "this should be removed" in the middle of a long sentence goes to the element under the pointer then. Browser and on-device recognition time each word as it is heard, a Mistral stream as it arrives and a Groq key from its word timestamps. An OpenAI or configured key, and sessions recorded before word timing, spread the words over the sentence. The agent reads each sentence with the elements marked at the words said while pointing at them.

### Where sessions are kept

The dev route keeps the session, its transcript and screenshots in your user data folder, never in the project:

| System  | Folder                                                   |
| ------- | -------------------------------------------------------- |
| macOS   | `~/Library/Application Support/retouche/`                |
| Linux   | `$XDG_DATA_HOME/retouche/` or `~/.local/share/retouche/` |
| Windows | `%LOCALAPPDATA%\retouche\`                               |

There is one folder per project (its folder name and a short hash of its path) and one per session inside it, readable by you only. `XDG_DATA_HOME`, when set, wins on every system. Sessions are kept until you delete them from History; sessions saved by earlier versions in `node_modules/.cache/retouche/voice/` are not moved.

### The agent run

The dev route runs the agent itself, in the background, on your existing login and subscription. None can edit a file:

- `claude -p` on Sonnet with no tools;
- `codex exec` in a read-only sandbox;
- `mastracode` headless in fast mode, with every tool that writes denied and its MCP servers off.

It looks for each CLI on `PATH`, in `~/.local/bin` and the usual install folders; `RETOUCHE_CLAUDE_PATH`, `RETOUCHE_CODEX_PATH` and `RETOUCHE_MASTRACODE_PATH` point it at one elsewhere. An ACP agent is started for each run in a temporary folder and stopped after it; an endpoint gets the session and its screenshots in one Chat Completions request. Page text and speech reach the agent marked as untrusted.

Each run rewrites the whole list, keeps the ids of the cards it keeps, and leaves out the ones you dismissed. While I talk runs the agent 1.5 s after each new sentence, one run at a time.

Copying a card saves the annotated screenshot it shows in the session's folder, one file per card and moment, so a path you copied keeps showing that moment after a run points the card elsewhere. When the figure can't be drawn or saved, the copy names the plain screenshot, and a card that points at nothing names none.

A reload in the same tab picks the recording up where it was; after more than 20 s away, the panel offers to continue it.
