import { describe, expect, it } from "vitest";

import {
  type Corner,
  type CornerBox,
  cornerMisfit,
  type Side,
} from "../corner-fit";

interface BoxOptions {
  at?: [number, number];
  border?: number;
  borders?: Partial<Record<Side, number>>;
  clips?: boolean;
  profile?: string;
  profiles?: Partial<Record<Corner, string>>;
  radius?: number;
  size: [number, number];
}

function box({
  at = [0, 0],
  border = 0,
  borders,
  clips = false,
  radius = 0,
  profile = "round",
  profiles,
  size,
}: BoxOptions): CornerBox {
  const corner = { x: radius, y: radius };
  return {
    border: {
      bottom: border,
      left: border,
      right: border,
      top: border,
      ...borders,
    },
    clips,
    radii: {
      "bottom-left": corner,
      "bottom-right": corner,
      "top-left": corner,
      "top-right": corner,
    },
    rect: { height: size[1], left: at[0], top: at[1], width: size[0] },
    profiles: {
      "bottom-left": profile,
      "bottom-right": profile,
      "top-left": profile,
      "top-right": profile,
      ...profiles,
    },
  };
}

const card = box({ radius: 14, size: [300, 200] });

describe("a rounded element in the corner of a rounded container", () => {
  it("fits when its radius is the container's minus the inset", () => {
    const inner = box({ at: [4, 4], radius: 10, size: [80, 32] });
    expect(cornerMisfit({ inner, outer: card })).toBeNull();
  });

  it("is reported when it is rounder than the curve it sits in", () => {
    const inner = box({ at: [12, 12], radius: 10, size: [80, 32] });
    expect(cornerMisfit({ inner, outer: card })).toStrictEqual({
      corner: "top-left",
      curve: 14,
      inset: { x: 12, y: 12 },
      radius: 10,
      profile: null,
      wanted: { x: 2, y: 2 },
    });
  });

  it("is reported when it is squarer than the curve it sits in", () => {
    const inner = box({ at: [2, 2], radius: 2, size: [80, 32] });
    expect(cornerMisfit({ inner, outer: card })?.wanted).toStrictEqual({
      x: 12,
      y: 12,
    });
  });

  it("names the corner that breaks", () => {
    const inner = box({ at: [208, 156], radius: 10, size: [80, 32] });
    expect(cornerMisfit({ inner, outer: card })?.corner).toBe("bottom-right");
  });

  it("reports a corner profile that differs from the container's", () => {
    const outer = box({
      radius: 14,
      profile: "superellipse(2)",
      size: [300, 200],
    });
    const inner = box({ at: [4, 4], radius: 10, size: [80, 32] });
    expect(cornerMisfit({ inner, outer })?.profile).toStrictEqual({
      inner: "round",
      outer: "superellipse(2)",
    });
  });

  it("compares each corner's shape with the shape of the corner it sits in", () => {
    const outer = box({
      profiles: { "top-left": "superellipse(2)" },
      radius: 14,
      size: [300, 200],
    });
    const inner = box({ at: [216, 164], radius: 10, size: [80, 32] });
    expect(cornerMisfit({ inner, outer })).toBeNull();
  });
});

describe("a rounded container with borders", () => {
  it("measures the curve inside the container's border", () => {
    const outer = box({ border: 1, radius: 14, size: [300, 200] });
    const inner = box({ at: [5, 5], radius: 9, size: [80, 32] });
    expect(cornerMisfit({ inner, outer })).toBeNull();
  });

  it("measures each corner inside the borders that meet there", () => {
    const outer = box({ borders: { left: 4 }, radius: 14, size: [300, 200] });
    const inner = box({ at: [5, 1], radius: 2, size: [80, 32] });
    expect(cornerMisfit({ inner, outer })).toMatchObject({
      curve: 10,
      inset: { x: 1, y: 1 },
      wanted: { x: 9, y: 13 },
    });
  });
});

describe("what is not a misfit", () => {
  it("ignores an element outside the container's corner box", () => {
    const inner = box({ at: [20, 20], radius: 0, size: [80, 32] });
    expect(cornerMisfit({ inner, outer: card })).toBeNull();
  });

  it("ignores any element in a square container", () => {
    const inner = box({ at: [4, 4], radius: 10, size: [80, 32] });
    const outer = box({ size: [300, 200] });
    expect(cornerMisfit({ inner, outer })).toBeNull();
  });

  it("leaves circles alone, they cannot follow a curve", () => {
    const inner = box({ at: [4, 4], radius: 999, size: [24, 24] });
    expect(cornerMisfit({ inner, outer: card })).toBeNull();
  });

  it("lets a pill be rounder than the curve, never squarer", () => {
    const pill = box({ at: [4, 4], radius: 999, size: [80, 24] });
    expect(cornerMisfit({ inner: pill, outer: card })).toBeNull();
  });

  it("ignores content flush with a container that clips it", () => {
    const outer = box({ clips: true, radius: 14, size: [300, 200] });
    const inner = box({ size: [300, 80] });
    expect(cornerMisfit({ inner, outer })).toBeNull();
  });

  it("shrinks radii that overflow the box, as CSS does", () => {
    const inner = box({ at: [4, 4], radius: 40, size: [20, 20] });
    expect(cornerMisfit({ inner, outer: card })).toBeNull();
  });
});
