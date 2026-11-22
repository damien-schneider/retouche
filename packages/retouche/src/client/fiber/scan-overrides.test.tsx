import { setTimeout as delay } from "node:timers/promises";

import { cleanup, render, screen } from "@testing-library/react";
import type { Fiber } from "bippy";
import {
  cloneElement,
  forwardRef,
  memo,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";

import { compileConfig } from "../../rules/find-overrides";
import { locateSites } from "../inspector/use-instance-sites";
import { WIDGET_MARKER } from "../shell/widget-events";
import { callSitesOf } from "./call-sites";
import { elementStack, fakeFiber } from "./fake-fibers";
import { scanFiberTree, scanOverrides } from "./scan-overrides";

const COMPONENTS = [
  "Button",
  "Text",
  "Card",
  "Badge",
  "Heading",
  "Eyebrow",
  "Menu",
  "PopoverTrigger",
];

const options = {
  components: COMPONENTS,
  config: compileConfig({ components: COMPONENTS }),
};

function Button({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button className={`px-4 text-sm ${className ?? ""}`} type="button">
      {children}
    </button>
  );
}

function Text({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={className}>{children}</p>;
}

function Card({ title }: { title: string }) {
  return (
    <section>
      <Text className="text-xs font-semibold">{title}</Text>
    </section>
  );
}

const Badge = memo(function Badge({ className }: { className?: string }) {
  return <span className={className}>New</span>;
});

const Heading = forwardRef<
  HTMLHeadingElement,
  { children: ReactNode; className?: string }
>(function HeadingRender({ children, className }, ref) {
  return (
    <h2 className={className} ref={ref}>
      {children}
    </h2>
  );
});
Heading.displayName = "Heading";

const Eyebrow = memo(function EyebrowRender({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={className}>{children}</span>;
});
Eyebrow.displayName = "Eyebrow";

function Trigger({
  render: element,
}: {
  render: ReactElement<{ ref?: Ref<HTMLElement> }>;
}) {
  return cloneElement(element, { ref: () => {} });
}

function PopoverTrigger({
  render: element,
}: {
  render: ReactElement<{ ref?: Ref<HTMLElement> }>;
}) {
  return cloneElement(element, { ref: () => {} });
}

function Menu({ label }: { label: string }) {
  return <Trigger render={<Button className="text-xs">{label}</Button>} />;
}

afterEach(cleanup);

function scanned() {
  return scanOverrides(options).map((instance) => ({
    component: instance.component,
    node: instance.node?.textContent,
    overrides: instance.overrides.map(({ label }) => label),
  }));
}

describe("scanning the page for call-site overrides", () => {
  it("finds the watched component whose call site overrides its type", () => {
    render(
      <main>
        <Button className="mt-2 text-lg">Save</Button>
        <Button className="mt-2">Cancel</Button>
      </main>
    );
    expect(scanned()).toStrictEqual([
      { component: "Button", node: "Save", overrides: ["text-lg"] },
    ]);
  });

  it("trusts the design system's own composition", () => {
    render(<Card title="Plan" />);
    expect(scanned()).toStrictEqual([]);
  });

  it("reports a memoized component once", () => {
    render(<Badge className="font-bold" />);
    expect(scanned()).toStrictEqual([
      { component: "Badge", node: "New", overrides: ["font-bold"] },
    ]);
  });

  it("keeps the same identity across scans", () => {
    const { rerender } = render(<Text className="text-lg">Hi</Text>);
    const [first] = scanOverrides(options);
    rerender(<Text className="text-lg">Hi again</Text>);
    const [second] = scanOverrides(options);
    expect(second?.id).toBe(first?.id);
  });

  it("never reports its own interface", () => {
    const host = document.createElement("div");
    host.setAttribute(WIDGET_MARKER, "");
    const shadow = host.attachShadow({ mode: "open" });
    document.body.append(host);
    render(createPortal(<Text className="text-lg">Panel</Text>, shadow));
    expect(scanned()).toStrictEqual([]);
    host.remove();
  });
});

describe("components a library wraps or re-renders", () => {
  it("names a wrapped component by the name its wrapper declares", () => {
    render(<Heading className="text-2xl">Plans</Heading>);
    expect(scanned()).toStrictEqual([
      { component: "Heading", node: "Plans", overrides: ["text-2xl"] },
    ]);
  });

  it("names a memoized component by the name its wrapper declares", () => {
    render(<Eyebrow className="uppercase">Plans</Eyebrow>);
    expect(scanned()).toStrictEqual([
      { component: "Eyebrow", node: "Plans", overrides: ["uppercase"] },
    ]);
  });

  it("trusts composition a library re-renders with a ref of its own", () => {
    render(<Menu label="Plans" />);
    expect(scanned()).toStrictEqual([]);
  });

  it("finds the override the app hands a watched component to re-render", () => {
    render(
      <PopoverTrigger render={<Button className="text-lg">Save</Button>} />
    );
    expect(scanned()).toStrictEqual([
      { component: "Button", node: "Save", overrides: ["text-lg"] },
    ]);
  });
});

describe("components rendered on the server", () => {
  it("reads the props React keeps for a Server Component", () => {
    const heading = document.createElement("h2");
    heading.textContent = "Pricing";
    const page = { name: "Page", owner: null };
    const text = {
      name: "Text",
      owner: page,
      props: { className: "text-2xl" },
    };
    const root = fakeFiber({ type: "main" });
    const hostFiber = fakeFiber({
      node: heading,
      owner: text,
      parent: root,
      type: "h2",
    });
    root.child = hostFiber;

    const found = scanFiberTree(root, options);

    expect(found).toMatchObject([
      {
        component: "Text",
        node: heading,
        origin: { info: text, kind: "server" },
      },
    ]);
  });
});

const recorded = elementStack(
  "exports.jsxDEV (react.js:1:1)",
  "PlanList (plans.tsx:8:9)"
);
const unrecorded = elementStack(
  "UnknownOwner (react.js:1:1)",
  "Object.react_stack_bottom_frame (react.js:2:2)"
);

function PlanList() {
  return null;
}

function childrenOf(parent: Fiber, children: Fiber[]): void {
  for (const [index, child] of children.entries()) {
    child.index = index;
    child.return = parent;
    child.sibling = children[index + 1] ?? null;
  }
  parent.child = children[0] ?? null;
}

function override(spec: {
  createdWith: Error;
  key?: string;
  owner: Fiber;
}): Fiber {
  const fiber = fakeFiber({
    createdWith: spec.createdWith,
    owner: spec.owner,
    type: Text,
  });
  fiber.key = spec.key ?? null;
  fiber.memoizedProps = { className: "text-lg" };
  return fiber;
}

function rowSizes(children: Fiber[]): number[] {
  const root = fakeFiber({ type: "main" });
  childrenOf(root, children);
  return callSitesOf(scanFiberTree(root, options))
    .map(({ instances }) => instances.length)
    .toSorted((first, second) => first - second);
}

describe("a page past React's limit on recorded creation stacks", () => {
  it("keeps the rows of a list at the call site that renders them", () => {
    const owner = fakeFiber({ type: PlanList });

    expect(
      rowSizes([
        override({ createdWith: recorded, key: "starter", owner }),
        override({ createdWith: unrecorded, key: "team", owner }),
        override({ createdWith: unrecorded, key: "scale", owner }),
      ])
    ).toStrictEqual([3]);
  });

  it("finds the list through the keyed element wrapping each row", () => {
    const owner = fakeFiber({ type: PlanList });
    const items = ["starter", "team"].map((key) => {
      const item = fakeFiber({ owner, type: "li" });
      item.key = key;
      childrenOf(item, [override({ createdWith: unrecorded, owner })]);
      return item;
    });

    expect(rowSizes(items)).toStrictEqual([2]);
  });

  it("keeps overrides written on separate lines apart", () => {
    const owner = fakeFiber({ type: PlanList });

    expect(
      rowSizes([
        override({ createdWith: unrecorded, owner }),
        override({ createdWith: unrecorded, owner }),
      ])
    ).toStrictEqual([1, 1]);
  });
});

function Entry() {
  return null;
}

function LongFeed() {
  return Array.from({ length: 10_000 }, (_, index) => <Entry key={index} />);
}

function PlanRow({ name }: { name: string }) {
  return (
    <li>
      <Text className="text-lg">{name}</Text>
    </li>
  );
}

function Plans({ names }: { names: string[] }) {
  return (
    <ul>
      {names.map((name) => (
        <PlanRow key={name} name={name} />
      ))}
    </ul>
  );
}

function Footer() {
  return <Text className="text-sm">Plans renew monthly</Text>;
}

describe("a page rendered after React stops recording creation stacks", () => {
  it("traces what it renders to the twin it recorded, and claims nothing it cannot trace", async () => {
    render(
      <main>
        <Plans names={["Starter"]} />
        <LongFeed />
        <Plans names={["Team", "Scale"]} />
        <Footer />
      </main>
    );
    const sites = callSitesOf(scanOverrides(options));
    const [rows, footer] = sites;
    const [starter, team, scale] = await Promise.all(
      (rows?.instances ?? []).map(
        async (instance) => await locateSites(instance, COMPONENTS)
      )
    );
    const [pickedStarter, pickedScale] = await Promise.all(
      ["Starter", "Scale"].map(
        async (name) => await locateSites(screen.getByText(name), COMPONENTS)
      )
    );
    const lone = footer ? await locateSites(footer.lead, COMPONENTS) : null;

    expect(sites.map(({ instances }) => instances.length)).toStrictEqual([
      3, 1,
    ]);
    expect(starter?.callSite.kind).toBe("found");
    expect([team, scale]).toStrictEqual([starter, starter]);
    expect(pickedStarter?.callSite.kind).toBe("found");
    expect(pickedScale).toStrictEqual(pickedStarter);
    expect(lone?.callSite).toStrictEqual({ kind: "missing" });
  });
});

function BillingMenu() {
  return <Trigger render={<Button className="text-xs">Billing</Button>} />;
}

function TeamMenu() {
  return <Trigger render={<Button className="text-xs">Team</Button>} />;
}

describe("a library re-rendering elements after React stops recording creation stacks", () => {
  it("still trusts the composition", async () => {
    await delay(1001);
    const { rerender } = render(
      <main>
        <Menu key="mounted" label="Plans" />
      </main>
    );
    rerender(
      <main>
        <LongFeed key="feed" />
        <Menu key="mounted" label="Billing" />
        <Menu key="added" label="Team" />
      </main>
    );
    expect(scanned()).toStrictEqual([]);
  });

  it("keeps the overrides two components hand it apart", async () => {
    await delay(1001);
    render(
      <main>
        <BillingMenu />
        <LongFeed />
        <TeamMenu />
      </main>
    );
    const sites = callSitesOf(scanOverrides(options));
    const [billing, team] = await Promise.all(
      ["Billing", "Team"].map(
        async (name) => await locateSites(screen.getByText(name), COMPONENTS)
      )
    );

    expect(sites.map(({ instances }) => instances.length)).toStrictEqual([
      1, 1,
    ]);
    expect(billing?.callSite.kind).toBe("found");
    expect(team?.callSite).toStrictEqual({ kind: "missing" });
  });
});
