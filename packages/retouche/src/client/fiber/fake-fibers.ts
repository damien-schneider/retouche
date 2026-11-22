import { type Fiber, isFiber } from "bippy";
import type { JSXElementConstructor } from "react";

import { isComponentType, type ReactOwner } from "./react-fiber";

const HOST_COMPONENT_TAG = 5;
const FUNCTION_COMPONENT_TAG = 0;

interface SourceSite {
  column: number;
  fileName: string;
  line: number;
}

export function site(fileName: string, line: number, column = 4): SourceSite {
  return { column, fileName, line };
}

export function elementStack(...frames: string[]): Error {
  const stack = new Error("react-stack-top-frame");
  stack.stack = [
    "Error: react-stack-top-frame",
    ...frames.map((frame) => `    at ${frame}`),
  ].join("\n");
  return stack;
}

export function serverStack(chunk: string, line: number, column: number) {
  return elementStack(
    `Page (about://React/Server/file:///repo/.next/server/chunks/ssr/${chunk}:${line}:${column})`
  );
}

export function fakeFiber(spec: {
  createdAt?: SourceSite;
  createdWith?: Error;
  node?: Element;
  owner?: ReactOwner;
  parent?: Fiber;
  type: JSXElementConstructor<never> | string;
}): Fiber {
  const fiber = {
    _debugOwner: spec.owner ?? null,
    _debugSource: spec.createdAt && {
      columnNumber: spec.createdAt.column,
      fileName: spec.createdAt.fileName,
      lineNumber: spec.createdAt.line,
    },
    _debugStack: spec.createdWith,
    alternate: null,
    child: null,
    elementType: spec.type,
    flags: 0,
    index: 0,
    key: null,
    memoizedProps: {},
    return: spec.parent ?? null,
    sibling: null,
    stateNode: spec.node ?? null,
    tag: isComponentType(spec.type)
      ? FUNCTION_COMPONENT_TAG
      : HOST_COMPONENT_TAG,
    type: spec.type,
  };
  if (!isFiber(fiber)) {
    throw new Error("A fake fiber must look like a fiber");
  }
  if (spec.node) {
    Object.defineProperty(spec.node, "__reactFiber$test", { value: fiber });
  }
  return fiber;
}
