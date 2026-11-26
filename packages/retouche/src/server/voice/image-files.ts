import { access } from "node:fs/promises";
import { join } from "node:path";

import { failure, type RouteOutcome } from "../json-response";

export const IMAGE_TYPES = ["jpeg", "png", "webp"] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export interface ImageData {
  bytes: Buffer;
  type: ImageType;
}

export interface StoredImage {
  path: string;
  type: ImageType;
}

const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export const IMAGE_MEDIA_TYPES: Record<ImageType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const DATA_URL =
  /^data:image\/(?<type>jpeg|png|webp);base64,(?<data>[A-Za-z0-9+/]*={0,2})$/;

export function parseImageDataUrl(value: string): RouteOutcome<ImageData> {
  const groups = DATA_URL.exec(value)?.groups;
  const type = IMAGE_TYPES.find((candidate) => candidate === groups?.type);
  const base64 = groups?.data;
  if (type === undefined || base64 === undefined || base64.length % 4 !== 0) {
    return failure("Images must be base64 JPEG, PNG or WebP data URLs.", 400);
  }
  if ((base64.length / 4) * 3 > MAX_IMAGE_BYTES) {
    return failure("Images are limited to 15 MB.", 413);
  }
  return { ok: true, value: { bytes: Buffer.from(base64, "base64"), type } };
}

export function shotPath(
  folder: string,
  shotId: string,
  type: ImageType
): string {
  return join(folder, `shot-${shotId}.${IMAGE_EXTENSIONS[type]}`);
}

export async function findShot(
  folder: string,
  shotId: string
): Promise<StoredImage | null> {
  for (const type of IMAGE_TYPES) {
    const path = shotPath(folder, shotId, type);
    try {
      await access(path);
      return { path, type };
    } catch {
      continue;
    }
  }
  return null;
}
