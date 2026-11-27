import type { Fiber } from "bippy";
import type { JSXElementConstructor } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { elementStack, fakeFiber, site } from "../../fiber/fake-fibers";
import { type CodeSite, componentSite, creationSite } from "../element-source";

const DEV_SERVER = "http://localhost:5173";
const VLQ_DIGITS = "ACEGIKMOQSUWYace";
const SAFARI_JSX_FRAME = `@${DEV_SERVER}/node_modules/.vite/deps/react_jsx-dev-runtime.js:197:30`;
const SAFARI_REACT_FRAME = `react_stack_bottom_frame@${DEV_SERVER}/node_modules/.vite/deps/react-dom_client.js:14140:21`;

function lineOf(codeSite: CodeSite) {
  return codeSite.kind === "found"
    ? `${codeSite.request.fileName}:${codeSite.request.line}`
    : codeSite.kind;
}

function serveModule(options: { code: string; from: number; path: string }) {
  const { code, from, path } = options;
  const fileName = path.split("/").at(-1) ?? path;
  const sourceMap = JSON.stringify({
    mappings: `AA${VLQ_DIGITS.charAt(from - 1)}A`,
    names: [],
    sources: [fileName],
    sourcesContent: [code],
    version: 3,
  });
  const devServer = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (url) =>
      url === `${DEV_SERVER}${path}`
        ? new Response(
            `render();\n//# sourceMappingURL=data:application/json;base64,${btoa(sourceMap)}`
          )
        : new Response(null, { status: 404 })
    );
  onTestFinished(() => {
    devServer.mockRestore();
  });
}

function safariStack(...frames: string[]): Error {
  const stack = new Error("react-stack-top-frame");
  stack.stack = frames.join("\n");
  return stack;
}

function thrownAt(stack: string): Error {
  const error = new TypeError(
    "Right side of assignment cannot be destructured"
  );
  error.stack = stack;
  return error;
}

function TitleCard(): never {
  throw thrownAt(`TitleCard@${DEV_SERVER}/src/cards.tsx:1:1\n@\n`);
}

function FooterCard(): never {
  console.error("Invalid hook call.");
  throw thrownAt(`FooterCard@${DEV_SERVER}/src/footer-card.tsx:1:1`);
}

function PlanList(): never {
  throw thrownAt(
    `TypeError: Cannot destructure property 'plans'\n    at PlanList (${DEV_SERVER}/src/plans.tsx:1:1)`
  );
}

function Heading(): never {
  throw thrownAt(`Heading@${DEV_SERVER}/src/ui/heading.tsx:1:1`);
}

function Intro() {
  return null;
}

function Page() {
  return null;
}

function Card() {
  return null;
}

function Button() {
  return null;
}

const CARDS = [
  "export function TitleCard({ title }: { title: string }) {",
  "  return (",
  '    <Card className="title">',
  "      {title}",
  "    </Card>",
  "  );",
  "}",
  "",
  "export function FooterCard() {",
  "  return <Card>Footer</Card>;",
  "}",
].join("\n");

const PLANS = [
  'import { Button } from "./ui/button";',
  "",
  "export function PlanList({ plans }: { plans: string[] }) {",
  "  return (",
  "    <ul>",
  "      {plans.map((plan) => (",
  "        <Button key={plan}>{plan}</Button>",
  "      ))}",
  "    </ul>",
  "  );",
  "}",
].join("\n");

const INTRO = [
  "export function Intro() {",
  "  return (",
  '    <section className="intro">',
  "      <Heading level={1}>Retouche</Heading>",
  "    </section>",
  "  );",
  "}",
].join("\n");

const HEADING = [
  "export function Heading({ level, ...props }: HeadingProps) {",
  "  const Tag = TAGS[level];",
  "  return <Tag {...props} />;",
  "}",
  "",
  'export function Subtitle(props: ComponentProps<"h3">) {',
  "  return <h3 {...props} />;",
  "}",
].join("\n");

function unrecordedChild(
  writer: Fiber,
  type: JSXElementConstructor<never> | string
): Fiber {
  return fakeFiber({
    createdWith: safariStack(SAFARI_JSX_FRAME, SAFARI_REACT_FRAME),
    owner: writer,
    parent: writer,
    type,
  });
}

describe("where an element Safari kept no frame for is used", () => {
  it("finds the line in the component returning it", async () => {
    serveModule({ code: CARDS, from: 1, path: "/src/cards.tsx" });
    const titleCard = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/page.tsx`, 4),
      type: TitleCard,
    });
    const card = unrecordedChild(titleCard, Card);

    expect(lineOf(await creationSite(card))).toBe("/src/cards.tsx:3");
  });

  it("finds it in a component that calls a hook first, with nothing logged in the app's console", async () => {
    serveModule({ code: CARDS, from: 10, path: "/src/footer-card.tsx" });
    const appConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => {
      appConsole.mockRestore();
    });
    const footerCard = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/page.tsx`, 6),
      type: FooterCard,
    });
    const card = unrecordedChild(footerCard, Card);

    expect(lineOf(await creationSite(card))).toBe("/src/footer-card.tsx:10");
    expect(appConsole).not.toHaveBeenCalled();
  });

  it("finds the line through another element the same component writes", async () => {
    serveModule({ code: INTRO, from: 4, path: "/src/intro.tsx" });
    const intro = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/page.tsx`, 4),
      type: Intro,
    });
    const section = unrecordedChild(intro, "section");
    const heading = fakeFiber({
      createdWith: safariStack(
        SAFARI_JSX_FRAME,
        `Intro@${DEV_SERVER}/src/intro.tsx:1:1`,
        SAFARI_REACT_FRAME
      ),
      owner: intro,
      parent: section,
      type: Card,
    });
    intro.child = section;
    section.child = heading;

    expect(lineOf(await creationSite(section))).toBe("/src/intro.tsx:3");
  });
});

describe("where an element is used while React records no stacks", () => {
  it("finds the line in the component that writes it", async () => {
    serveModule({ code: PLANS, from: 3, path: "/src/plans.tsx" });
    const planList = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/page.tsx`, 4),
      type: PlanList,
    });
    const button = fakeFiber({
      createdWith: elementStack(
        `UnknownOwner (${DEV_SERVER}/node_modules/.vite/deps/react.js:121:14)`,
        `Object.react_stack_bottom_frame (${DEV_SERVER}/node_modules/.vite/deps/react-dom_client.js:9:9)`
      ),
      owner: planList,
      parent: planList,
      type: Button,
    });

    expect(lineOf(await creationSite(button))).toBe("/src/plans.tsx:7");
  });

  it("still says no record was kept when nothing points at the component that writes it", async () => {
    const page = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/main.tsx`, 4),
      type: Page,
    });

    expect(lineOf(await creationSite(unrecordedChild(page, "main")))).toBe(
      "missing"
    );
  });
});

describe("a component's own code without a recorded stack", () => {
  it("opens where the component draws its element under another name", async () => {
    serveModule({ code: HEADING, from: 1, path: "/src/ui/heading.tsx" });
    const h3 = document.createElement("h3");
    const heading = fakeFiber({
      createdAt: site(`${DEV_SERVER}/src/page.tsx`, 4),
      type: Heading,
    });
    fakeFiber({
      createdWith: safariStack(SAFARI_JSX_FRAME, SAFARI_REACT_FRAME),
      node: h3,
      owner: heading,
      parent: heading,
      type: "h3",
    });

    expect(lineOf(await componentSite({ component: heading, node: h3 }))).toBe(
      "/src/ui/heading.tsx:3"
    );
  });
});
