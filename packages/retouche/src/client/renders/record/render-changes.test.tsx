"use no memo";

import "../../../instrument";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  Component,
  createContext,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  use,
  useRef,
  useState,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordRenders, renderReportOf } from "./render-recorder";

let stopRecording = (): void => {};

beforeEach(() => {
  stopRecording = recordRenders();
});

afterEach(() => {
  stopRecording();
  cleanup();
  vi.restoreAllMocks();
});

function lastUpdateOf(element: Element) {
  const last = renderReportOf(element)?.last;
  return last?.kind === "update" ? last : null;
}

function primitiveChange(from: string, to: string) {
  return {
    from: { kind: "primitive", text: from },
    kind: "changed",
    to: { kind: "primitive", text: to },
  };
}

function Counter() {
  const button = useRef<HTMLButtonElement>(null);
  const [count, setCount] = useState(0);
  return (
    <button
      onClick={() => {
        setCount(count + 1);
      }}
      ref={button}
      type="button"
    >
      clicks {count}
    </button>
  );
}

function Leaf() {
  return <span>leaf</span>;
}

function Parent() {
  const [tick, setTick] = useState(0);
  return (
    <section>
      <button
        onClick={() => {
          setTick(tick + 1);
        }}
        type="button"
      >
        tick
      </button>
      <Leaf />
    </section>
  );
}

function Row({
  children,
}: {
  children: ReactNode;
  count: number;
  extra?: number;
  items: number[];
  onSelect: () => void;
  style: CSSProperties;
}) {
  return <li>{children}</li>;
}

function List() {
  const [tick, setTick] = useState(0);
  const added = tick === 1 ? { extra: tick } : {};
  return (
    <ul>
      <button
        onClick={() => {
          setTick(tick + 1);
        }}
        type="button"
      >
        tick
      </button>
      <Row
        count={tick}
        items={[1, 2]}
        onSelect={() => {
          setTick(0);
        }}
        style={{ color: "red" }}
        {...added}
      >
        <b>row</b>
      </Row>
    </ul>
  );
}

const ThemeContext = createContext("light");
ThemeContext.displayName = "ThemeContext";

function ThemeLabel() {
  return <span>{use(ThemeContext)}</span>;
}

function ThemeSwitch({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState("light");
  return (
    <ThemeContext value={theme}>
      <button
        onClick={() => {
          setTheme("dark");
        }}
        type="button"
      >
        switch
      </button>
      {children}
    </ThemeContext>
  );
}

function Fragile() {
  const [isBroken, setIsBroken] = useState(false);
  if (isBroken) {
    throw new Error("broken");
  }
  return (
    <button
      onClick={() => {
        setIsBroken(true);
      }}
      type="button"
    >
      break
    </button>
  );
}

interface BoundaryProps {
  children: ReactElement;
  onError: (error: Error) => void;
}

class Boundary extends Component<BoundaryProps, { hasFailed: boolean }> {
  static getDerivedStateFromError() {
    return { hasFailed: true };
  }

  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasFailed: false };
  }

  override componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  override render() {
    return this.state.hasFailed ? <p>failed</p> : this.props.children;
  }
}

function Reveal() {
  const [isShown, setIsShown] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setIsShown(true);
        }}
        type="button"
      >
        reveal
      </button>
      {isShown && <Leaf />}
    </>
  );
}

describe("why a component rendered: its state", () => {
  it("names the state hook that changed, counted among stateful hooks", () => {
    render(<Counter />);

    fireEvent.click(screen.getByRole("button"));

    expect(renderReportOf(screen.getByRole("button"))).toStrictEqual({
      count: 2,
      last: {
        contexts: [],
        kind: "update",
        owner: null,
        props: [],
        state: [
          {
            change: primitiveChange("0", "1"),
            index: 1,
            kind: "hook",
          },
        ],
      },
    });
  });

  it("names the class component state fields that changed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary onError={() => {}}>
        <Fragile />
      </Boundary>
    );

    fireEvent.click(screen.getByText("break"));

    expect(lastUpdateOf(screen.getByText("failed"))?.state).toStrictEqual([
      {
        change: primitiveChange("false", "true"),
        key: "hasFailed",
        kind: "field",
      },
    ]);
  });
});

describe("why a component rendered: its owner", () => {
  it("reports the owner when a child rendered again with nothing of its own changed", () => {
    render(<Parent />);

    fireEvent.click(screen.getByText("tick"));

    expect(renderReportOf(screen.getByText("leaf"))).toStrictEqual({
      count: 2,
      last: {
        contexts: [],
        kind: "update",
        owner: "Parent",
        props: [],
        state: [],
      },
    });
  });
});

describe("why a component rendered: its props", () => {
  it("tells new inline values with the same contents apart from changed ones", () => {
    render(<List />);

    fireEvent.click(screen.getByText("tick"));

    const props = lastUpdateOf(screen.getByRole("listitem"))?.props;
    expect(props).toHaveLength(6);
    expect(props).toStrictEqual(
      expect.arrayContaining([
        {
          change: { container: "element", kind: "same-contents" },
          name: "children",
        },
        { change: primitiveChange("0", "1"), name: "count" },
        { change: primitiveChange("undefined", "1"), name: "extra" },
        {
          change: { container: "array", kind: "same-contents" },
          name: "items",
        },
        {
          change: { isSameCode: true, kind: "new-function" },
          name: "onSelect",
        },
        {
          change: { container: "object", kind: "same-contents" },
          name: "style",
        },
      ])
    );
  });

  it("reports a removed prop as changed to undefined", () => {
    render(<List />);
    fireEvent.click(screen.getByText("tick"));

    fireEvent.click(screen.getByText("tick"));

    expect(lastUpdateOf(screen.getByRole("listitem"))?.props).toContainEqual({
      change: primitiveChange("1", "undefined"),
      name: "extra",
    });
  });
});

describe("why a component rendered: context and mount", () => {
  it("names the context whose value changed", () => {
    render(
      <ThemeSwitch>
        <ThemeLabel />
      </ThemeSwitch>
    );

    fireEvent.click(screen.getByText("switch"));

    expect(renderReportOf(screen.getByText("dark"))?.last).toStrictEqual({
      contexts: [
        {
          change: {
            from: { kind: "string", text: "light" },
            kind: "changed",
            to: { kind: "string", text: "dark" },
          },
          name: "ThemeContext",
        },
      ],
      kind: "update",
      owner: null,
      props: [],
      state: [],
    });
  });

  it("reports a freshly mounted component as mounted", () => {
    render(<Reveal />);

    fireEvent.click(screen.getByText("reveal"));

    expect(renderReportOf(screen.getByText("leaf"))).toStrictEqual({
      count: 1,
      last: { kind: "mount" },
    });
  });
});
