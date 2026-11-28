import {
  getSourceContentFromSourceMap,
  getSourceMap,
  type StackFrame,
} from "bippy/source";

import type { SourceFile } from "../../../protocol";
import { elementPlace } from "../../../source/jsx-range";
import { fetchSourceFile, type SourceRequest } from "../../route/dev-route";

const LEADING_SLASHES = /^\/+/;

export async function mappedCode(
  source: StackFrame,
  moduleUrl: string | undefined
): Promise<string | null> {
  if (moduleUrl === undefined || source.fileName === undefined) {
    return null;
  }
  const sourceMap = await getSourceMap(moduleUrl).catch(() => null);
  return sourceMap && getSourceContentFromSourceMap(sourceMap, source.fileName);
}

export async function readSourceFile(
  request: SourceRequest
): Promise<SourceFile> {
  try {
    return await fetchSourceFile(request);
  } catch (error) {
    const code = request.mappedCode;
    if (code === null) {
      throw error;
    }
    return {
      absolutePath: request.fileName,
      code,
      ...elementPlace(code, request),
      line: request.line,
      path: request.fileName.replace(LEADING_SLASHES, ""),
    };
  }
}
