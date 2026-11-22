import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { compileConfig } from "../../rules/find-overrides";
import Layer from "../layer";
import { openButton, overlay } from "../testing/layer-page";
import { type OverrideInstance, scanOverrides } from "./scan-overrides";
import { measureOverride, stripOverride } from "./strip-override";

const components = ["Text"];
const config = compileConfig({ components });

function Text({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p
      className={`text-gray-900 text-sm ${className ?? ""}`.trim()}
      style={{ fontSize: "14px", fontWeight: 400, ...style }}
    >
      {children}
    </p>
  );
}

afterEach(cleanup);

function overriddenText(): OverrideInstance {
  const [instance] = scanOverrides({ components, config });
  if (!instance) {
    throw new Error("Expected one overridden Text");
  }
  return instance;
}

describe("measuring what a call-site override replaces", () => {
  it("reads the element with and without the override", () => {
    render(
      <Text className="mt-4 text-lg" style={{ fontWeight: 700 }}>
        Pricing
      </Text>
    );

    const measurement = measureOverride(overriddenText());

    expect(measurement).toStrictEqual({
      afterClasses: ["text-gray-900", "text-sm", "mt-4", "text-lg"],
      beforeClasses: ["text-gray-900", "text-sm", "mt-4"],
      readings: [
        {
          after: "14px",
          before: "14px",
          group: "font-size",
          property: "font-size",
        },
        {
          after: "700",
          before: "400",
          group: "font-weight",
          property: "font-weight",
        },
      ],
    });
  });

  it("leaves the page exactly as the app rendered it", () => {
    render(<Text className="text-lg">Pricing</Text>);

    measureOverride(overriddenText());

    expect(screen.getByText("Pricing").className).toBe(
      "text-gray-900 text-sm text-lg"
    );
  });

  it("previews the component without the override until released", () => {
    render(<Text className="text-lg font-bold">Pricing</Text>);

    const rendered = screen.getByText("Pricing").className;
    const release = stripOverride(overriddenText());
    const duringPreview = screen.getByText("Pricing").className;
    release();

    expect(duringPreview).toBe("text-gray-900 text-sm");
    expect(screen.getByText("Pricing").className).toBe(rendered);
  });
});

function classesBeforeEachChange(element: Element): string[] {
  const classes: string[] = [];
  const observer = new MutationObserver((records) => {
    classes.push(...records.map(({ oldValue }) => oldValue ?? ""));
  });
  observer.observe(element, {
    attributeFilter: ["class"],
    attributeOldValue: true,
  });
  return classes;
}

function Headline() {
  const [size, setSize] = useState("text-lg");
  return (
    <>
      <button
        onClick={() => {
          setSize("text-xl");
        }}
        type="button"
      >
        Enlarge
      </button>
      <Text className={size}>Pricing</Text>
    </>
  );
}

describe("measuring the overview while the page changes", () => {
  it("leaves a call site alone when only another one changes", async () => {
    render(
      <>
        <Text className="font-bold">Plans</Text>
        <Headline />
        <Layer config={{ components }} />
      </>
    );
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    const row = await within(panel).findByRole("button", { name: /Pricing/ });
    await within(row).findByText("text-sm");
    const plans = classesBeforeEachChange(screen.getByText("Plans"));
    const pricing = classesBeforeEachChange(screen.getByText("Pricing"));

    fireEvent.click(screen.getByRole("button", { name: "Enlarge" }));

    await waitFor(() => {
      expect(pricing).toContain("text-gray-900 text-sm");
    });
    expect(plans).toStrictEqual([]);
  });
});
