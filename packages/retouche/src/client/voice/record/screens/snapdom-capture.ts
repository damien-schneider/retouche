import type { SnapdomOptions } from "@zumer/snapdom";

import { WIDGET_MARKER } from "../../../shell/widget-events";
import { blobDataUrl } from "./blob-data-url";

export interface CapturedScreen {
  blob: Blob;
  dataUrl: string;
}

const TIMEOUT_MS = 10_000;
const MAX_WIDTH = 2400;
const JPEG_QUALITY = 0.85;
const MAX_PIXEL_RATIO = 2;

function pageBackground(): string {
  for (const element of [document.documentElement, document.body]) {
    const color = getComputedStyle(element).backgroundColor;
    if (color !== "transparent" && color !== "rgba(0, 0, 0, 0)") {
      return color;
    }
  }
  return "#ffffff";
}

function snapOptions(): SnapdomOptions {
  return {
    backgroundColor: pageBackground(),
    clip: "viewport",
    dpr: Math.min(Math.max(devicePixelRatio || 1, 1), MAX_PIXEL_RATIO),
    embedFonts: true,
    exclude: [`[${WIDGET_MARKER}]`],
    fast: true,
    invalidate: true,
    reconcile: true,
  };
}

async function rendered(): Promise<HTMLCanvasElement | null> {
  const loaded = await import("@zumer/snapdom").catch(() => null);
  return loaded
    ? await loaded.snapdom
        .toCanvas(document.documentElement, snapOptions())
        .catch(() => null)
    : null;
}

async function renderViewport(): Promise<HTMLCanvasElement | null> {
  const timeout = Promise.withResolvers<null>();
  const timer = window.setTimeout(() => {
    timeout.resolve(null);
  }, TIMEOUT_MS);
  try {
    return await Promise.race([rendered(), timeout.promise]);
  } finally {
    window.clearTimeout(timer);
  }
}

function fitted(canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (canvas.width <= MAX_WIDTH) {
    return canvas;
  }
  const resized = document.createElement("canvas");
  resized.width = MAX_WIDTH;
  resized.height = Math.max(
    1,
    Math.round((canvas.height * MAX_WIDTH) / canvas.width)
  );
  const context = resized.getContext("2d");
  if (!context) {
    return canvas;
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
}

async function jpegOf(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const encoded = Promise.withResolvers<Blob | null>();
  canvas.toBlob(encoded.resolve, "image/jpeg", JPEG_QUALITY);
  return await encoded.promise;
}

export async function captureViewport(): Promise<CapturedScreen | null> {
  try {
    const canvas = await renderViewport();
    const blob = canvas ? await jpegOf(fitted(canvas)) : null;
    const dataUrl = blob ? await blobDataUrl(blob) : null;
    return blob && dataUrl !== null ? { blob, dataUrl } : null;
  } catch {
    return null;
  }
}
