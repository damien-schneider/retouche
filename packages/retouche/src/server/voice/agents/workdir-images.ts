import { copyFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { AgentImage } from "./agent-backend";

export async function copyImagesInto(
  workdir: string,
  images: AgentImage[]
): Promise<string[]> {
  return await Promise.all(
    images.map(async (image, index) => {
      const copy = join(workdir, `image-${index + 1}${extname(image.path)}`);
      await copyFile(image.path, copy);
      return copy;
    })
  );
}

export function copiedImagesInstruction(count: number): string | null {
  return count === 0
    ? null
    : `The files image-1 to image-${count} in your working folder are Image 1 to Image ${count} of the material. Open each one with your view tool before answering.`;
}
