import { describe, expect, it } from "vitest";

import { classGroupsOf, type WatchedGroup } from "../class-groups";
import { parseClassToken } from "../class-token";

function groupsOf(token: string, declared?: WatchedGroup[]) {
  return classGroupsOf(parseClassToken(token).utility, declared);
}

describe("reading a class token", () => {
  it("separates variants, important and the utility", () => {
    expect(parseClassToken("md:hover:!text-lg")).toStrictEqual({
      important: true,
      raw: "md:hover:!text-lg",
      utility: "text-lg",
      variants: ["md", "hover"],
    });
  });

  it("keeps colons inside arbitrary variants and values", () => {
    expect(parseClassToken("[&:hover]:bg-[url(a:b)]")).toMatchObject({
      utility: "bg-[url(a:b)]",
      variants: ["[&:hover]"],
    });
  });

  it("reads Tailwind v4's trailing important", () => {
    expect(parseClassToken("font-bold!")).toMatchObject({
      important: true,
      utility: "font-bold",
    });
  });
});

describe("classifying a utility", () => {
  it("tells a font size from a text color and from text layout", () => {
    expect(groupsOf("text-lg")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-[13px]")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-red-500")).toStrictEqual(["text-color"]);
    expect(groupsOf("text-[var(--brand)]")).toStrictEqual(["text-color"]);
    expect(groupsOf("text-center")).toStrictEqual([]);
    expect(groupsOf("text-balance")).toStrictEqual([]);
  });

  it("counts a size with a line-height modifier as both", () => {
    expect(groupsOf("text-sm/6")).toStrictEqual(["font-size", "line-height"]);
  });

  it("takes a custom size or weight from what its stylesheet sets", () => {
    expect(groupsOf("text-body")).toStrictEqual(["text-color"]);
    expect(groupsOf("text-body", ["font-size"])).toStrictEqual(["font-size"]);
    expect(groupsOf("font-book", ["font-weight"])).toStrictEqual([
      "font-weight",
    ]);
  });

  it("tells a font weight from a font family", () => {
    expect(groupsOf("font-semibold")).toStrictEqual(["font-weight"]);
    expect(groupsOf("font-[650]")).toStrictEqual(["font-weight"]);
    expect(groupsOf("font-mono")).toStrictEqual(["font-family"]);
    expect(groupsOf("font-display")).toStrictEqual(["font-family"]);
  });
});

describe("classifying an arbitrary value or property", () => {
  it("reads an arbitrary font value as Tailwind does: a weight unless it names a family", () => {
    expect(groupsOf("font-(--heading-weight)")).toStrictEqual(["font-weight"]);
    expect(groupsOf("font-[var(--heading-weight)]")).toStrictEqual([
      "font-weight",
    ]);
    expect(groupsOf("font-[calc(var(--w)+100)]")).toStrictEqual([
      "font-weight",
    ]);
    expect(groupsOf("font-[Inter,sans-serif]")).toStrictEqual(["font-family"]);
    expect(groupsOf("font-['Geist_Mono']")).toStrictEqual(["font-family"]);
    expect(groupsOf("font-(family-name:--brand)")).toStrictEqual([
      "font-family",
    ]);
  });

  it("reads a size keyword or a typed value inside text-[…] as a size", () => {
    expect(groupsOf("text-[larger]")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-[x-small]")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-[50%]")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-[size:var(--step)]")).toStrictEqual(["font-size"]);
    expect(groupsOf("text-[inherit]")).toStrictEqual(["text-color"]);
  });

  it("reads a typography property written as an arbitrary property", () => {
    expect(groupsOf("[font-size:13px]")).toStrictEqual(["font-size"]);
    expect(groupsOf("hover:[color:var(--brand)]")).toStrictEqual([
      "text-color",
    ]);
    expect(groupsOf("[letter-spacing:-0.01em]")).toStrictEqual([
      "letter-spacing",
    ]);
    expect(groupsOf("[font:600_14px/20px_Inter]")).toStrictEqual([
      "font-style",
      "font-weight",
      "font-size",
      "line-height",
      "font-family",
    ]);
    expect(groupsOf("[mask-type:luminance]")).toStrictEqual([]);
  });
});

describe("classifying the rest of the type utilities", () => {
  it("counts a placeholder color as a text color", () => {
    expect(groupsOf("placeholder-zinc-400")).toStrictEqual(["text-color"]);
  });

  it("leaves box decoration breaking out of text decoration", () => {
    expect(groupsOf("decoration-clone")).toStrictEqual([]);
    expect(groupsOf("decoration-slice")).toStrictEqual([]);
    expect(groupsOf("decoration-wavy")).toStrictEqual(["text-decoration"]);
  });

  it("knows the rest of the type properties", () => {
    expect(groupsOf("leading-tight")).toStrictEqual(["line-height"]);
    expect(groupsOf("tracking-wide")).toStrictEqual(["letter-spacing"]);
    expect(groupsOf("uppercase")).toStrictEqual(["text-transform"]);
    expect(groupsOf("italic")).toStrictEqual(["font-style"]);
    expect(groupsOf("tabular-nums")).toStrictEqual(["font-variant-numeric"]);
  });
});

describe("classifying a utility outside typography", () => {
  it("splits borders into width and color", () => {
    expect(groupsOf("border")).toStrictEqual(["border"]);
    expect(groupsOf("border-t-2")).toStrictEqual(["border"]);
    expect(groupsOf("border-dashed")).toStrictEqual(["border"]);
    expect(groupsOf("border-x-red-500")).toStrictEqual(["border-color"]);
  });

  it("knows paint and box utilities", () => {
    expect(groupsOf("bg-muted")).toStrictEqual(["background"]);
    expect(groupsOf("rounded-t-lg")).toStrictEqual(["radius"]);
    expect(groupsOf("shadow-sm")).toStrictEqual(["shadow"]);
    expect(groupsOf("ring-2")).toStrictEqual(["ring"]);
    expect(groupsOf("opacity-50")).toStrictEqual(["opacity"]);
    expect(groupsOf("px-3")).toStrictEqual(["padding"]);
    expect(groupsOf("-mt-2")).toStrictEqual(["margin"]);
  });

  it("leaves layout utilities ungrouped", () => {
    expect(groupsOf("flex")).toStrictEqual([]);
    expect(groupsOf("gap-2")).toStrictEqual([]);
    expect(groupsOf("w-full")).toStrictEqual([]);
    expect(groupsOf("border-collapse")).toStrictEqual([]);
  });
});
