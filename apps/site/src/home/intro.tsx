import { Heading } from "../ui/heading";
import { Text } from "../ui/text";
import { CopyPrompt } from "./copy-prompt";

const SETUP_PROMPT = `Set up Retouche in this React app by following ${import.meta.env.SITE_URL}/setup.md`;

export function Intro() {
  return (
    <section
      aria-labelledby="index-title"
      className="flex scroll-mt-28 flex-col gap-3"
      id="index"
    >
      <Heading className="mb-1" id="index-title" level={1} size="page">
        Typography overrides, pinned where they render
      </Heading>
      <Text>
        Retouche is a dev overlay for React. It pins every call site that
        overrides your design system’s typography, and every nested corner that
        doesn’t follow its container’s curve, and shows what changed, so you
        decide whether to fix it or keep it.
      </Text>
      <Text>
        It can also highlight renders. Each component flashes as it renders,
        with a count, and the panel shows what changed: a prop, its state, a
        context, or nothing at all.
      </Text>
      <Text>
        Or open a voice session and talk through the page while you point at it.
        Your own Claude Code, Codex or Mastra Code turns what you say into
        feedback for your agent, each with a screenshot marked where you
        pointed.
      </Text>
      <Text>
        To set it up, give this prompt to Claude Code, Codex or Cursor in your
        React app:
      </Text>
      <div className="my-3">
        <CopyPrompt prompt={SETUP_PROMPT} />
      </div>
      <Text>
        The agent installs the package and finds the components that own your
        typography, whatever styles them. Then open localhost.
      </Text>
      <Text>
        Obs: React 19 with Vite, or Next.js 16 with the App Router and
        Turbopack. Retouche runs only in development; the agent installs it from
        npm, where it is named retouche-dev.
      </Text>
    </section>
  );
}
