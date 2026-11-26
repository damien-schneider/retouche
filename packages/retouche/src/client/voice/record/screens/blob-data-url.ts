import { z } from "zod";

export async function blobDataUrl(blob: Blob): Promise<string | null> {
  const read = Promise.withResolvers<string | null>();
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const parsed = z.string().safeParse(reader.result);
    read.resolve(parsed.success ? parsed.data : null);
  });
  reader.addEventListener("error", () => {
    read.resolve(null);
  });
  reader.readAsDataURL(blob);
  return await read.promise;
}
