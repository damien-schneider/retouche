import { type Fiber, getDisplayName, getType, isFiber } from "bippy";
import {
  formatOwnerStack,
  getRawSource,
  getSource,
  getSourceContentFromSourceMap,
  getSourceFromSourceMap,
  getSourceMap,
  isSourceFile,
  parseStack,
  type StackFrame,
  symbolicateStack,
} from "bippy/source";
import type { ReactNode } from "react";

import { SERVER_FRAME_ORIGIN } from "../../protocol";
import {
  fiberOfNode,
  findDescendant,
  isSameFiber,
  ownerName,
  type ReactOwner,
  rootFiberOf,
  writtenPlace,
} from "../fiber/react-fiber";
import type { SourceRequest } from "../route/dev-route";
import { mappedCode } from "./mapped/mapped-source";
import { nearestWrittenTag } from "./written/written-tag";

const MAX_OWNER_DEPTH = 32;
const DEPENDENCY_FILE = /[\\/]node_modules[\\/]|^node_modules[\\/]/;
const PACKAGE_NAME =
  /(?:^|[\\/])node_modules[\\/](?<name>(?:@[^\\/]+[\\/])?[^.\\/][^\\/]*)(?!.*[\\/]node_modules[\\/])/;
const ROOTED_OR_BUNDLER_NAME = /^(?:\/|\[|[a-z][\w+.-]*:)/i;
const SERVER_CREATION_FRAME = new RegExp(
  String.raw`\((${SERVER_FRAME_ORIGIN}\S+?):(\d+):(\d+)\)`
);
const STACK_HEADER = /^\w*Error\b/;
const UNRECORDED_OWNER = /UnknownOwner|react[-_]stack[-_]bottom[-_]frame/;

export type CodeSite =
  | { kind: "dependency"; packageName: string }
  | { kind: "found"; request: SourceRequest }
  | { kind: "missing" };

export const MISSING_SITE: CodeSite = { kind: "missing" };

const creationFrames = new WeakMap<Error, string | null>();
const thrownFrames = new WeakMap<object, StackFrame | null>();

// Vite source maps list sources relative to the served module.
function resolveAgainstModule(fileName: string, moduleUrl: string | undefined) {
  if (moduleUrl === undefined || ROOTED_OR_BUNDLER_NAME.test(fileName)) {
    return fileName;
  }
  try {
    return new URL(fileName, moduleUrl).pathname;
  } catch {
    return fileName;
  }
}

function serverCreationSite(
  debugStack: Error | null | undefined
): SourceRequest | null {
  const stack = debugStack?.stack;
  const match = stack === undefined ? null : SERVER_CREATION_FRAME.exec(stack);
  if (match?.[1] === undefined) {
    return null;
  }
  return {
    column: Number(match[3]) - 1,
    fileName: match[1],
    line: Number(match[2]),
    mappedCode: null,
  };
}

// React's JSX runtime owns the first frame; the next one is where the element is written.
function writtenAt(stack: string): string | null {
  const serverFrame = SERVER_CREATION_FRAME.exec(stack)?.[0];
  if (serverFrame !== undefined) {
    return serverFrame;
  }
  const lines = stack.split("\n", 3);
  const runtime = STACK_HEADER.test(lines[0] ?? "") ? 1 : 0;
  const frame = lines[runtime + 1]?.trim() ?? "";
  const isRecorded =
    frame !== "" && !UNRECORDED_OWNER.test(`${lines[runtime]}${frame}`);
  return isRecorded ? frame : null;
}

export function creationFrame(creation: ReactOwner): string | null {
  const source = isFiber(creation) ? creation._debugSource : null;
  if (source) {
    return `${source.fileName}:${source.lineNumber}:${source.columnNumber ?? ""}`;
  }
  const debugStack = isFiber(creation)
    ? creation._debugStack
    : creation.debugStack;
  if (!debugStack) {
    return null;
  }
  const known = creationFrames.get(debugStack);
  if (known !== undefined) {
    return known;
  }
  const frame =
    debugStack.stack === undefined ? null : writtenAt(debugStack.stack);
  creationFrames.set(debugStack, frame);
  return frame;
}

function dependencySite(fileName: string): CodeSite {
  const packageName = PACKAGE_NAME.exec(fileName)?.groups?.name;
  return packageName === undefined
    ? MISSING_SITE
    : { kind: "dependency", packageName: packageName.replaceAll("\\", "/") };
}

// React stops recording where elements are written past 10,000 of them a second.
function recordedTwin(fiber: Fiber): Fiber | null {
  const place = writtenPlace(fiber);
  if (!place) {
    return null;
  }
  return findDescendant(rootFiberOf(fiber), (candidate) => {
    if (candidate.type !== fiber.type || creationFrame(candidate) === null) {
      return false;
    }
    const twin = writtenPlace(candidate);
    return (
      twin !== null &&
      twin.writer.type === place.writer.type &&
      twin.path === place.path
    );
  });
}

function recordedCreation(fiber: Fiber): Fiber | null {
  if (fiber._debugSource) {
    return fiber;
  }
  if (!fiber._debugOwner) {
    return null;
  }
  return creationFrame(fiber) === null ? recordedTwin(fiber) : fiber;
}

function siteOf(
  source: StackFrame,
  moduleUrl: string | undefined,
  mappedCode: string | null = null
): CodeSite {
  if (source.fileName === undefined) {
    return MISSING_SITE;
  }
  const fileName = resolveAgainstModule(source.fileName, moduleUrl);
  if (DEPENDENCY_FILE.test(fileName)) {
    return dependencySite(fileName);
  }
  if (!isSourceFile(fileName)) {
    return MISSING_SITE;
  }
  const request = {
    column: source.columnNumber ?? null,
    fileName,
    line: source.lineNumber ?? null,
    mappedCode,
  };
  return { kind: "found", request };
}

function isCallable(value: unknown): value is () => ReactNode {
  return typeof value === "function";
}

function isError(value: unknown): value is Error {
  return value instanceof Error;
}

function namedFrame(stack: string | null | undefined, name: string) {
  if (stack === null || stack === undefined) {
    return null;
  }
  return parseStack(stack).find((frame) => frame.functionName === name) ?? null;
}

function ownedFrame(writer: Fiber, name: string): StackFrame | null {
  const owned = findDescendant(
    writer,
    (candidate) =>
      isSameFiber(candidate._debugOwner, writer) &&
      namedFrame(creationFrame(candidate), name) !== null
  );
  return owned && namedFrame(creationFrame(owned), name);
}

// Outside a render a component throws at its first hook or prop read; logs muted, as in React's own frame probe.
function thrownFrame(component: () => ReactNode): StackFrame | null {
  const known = thrownFrames.get(component);
  if (known !== undefined) {
    return known;
  }
  const appLogs = { error: console.error, warn: console.warn };
  console.error = () => {};
  console.warn = () => {};
  let frame: StackFrame | null = null;
  try {
    void component();
  } catch (error) {
    frame = isError(error) ? namedFrame(error.stack, component.name) : null;
  } finally {
    console.error = appLogs.error;
    console.warn = appLogs.warn;
  }
  thrownFrames.set(component, frame);
  return frame;
}

function writerFrame(fiber: Fiber): StackFrame | null {
  const writer = fiber._debugOwner;
  const component = isFiber(writer) ? getType(writer.type) : null;
  if (!isFiber(writer) || !isCallable(component) || component.name === "") {
    return null;
  }
  return ownedFrame(writer, component.name) ?? thrownFrame(component);
}

async function writerSite(fiber: Fiber): Promise<CodeSite> {
  const { columnNumber = 1, fileName, lineNumber } = writerFrame(fiber) ?? {};
  const sourceMap =
    fileName === undefined
      ? null
      : await getSourceMap(fileName).catch(() => null);
  const original =
    sourceMap && lineNumber !== undefined
      ? getSourceFromSourceMap(sourceMap, lineNumber, columnNumber)
      : null;
  if (!sourceMap || original?.fileName === undefined) {
    return MISSING_SITE;
  }
  const code = getSourceContentFromSourceMap(sourceMap, original.fileName);
  const name = getDisplayName(fiber.type);
  const tag =
    code === null || name === null || original.lineNumber === undefined
      ? null
      : nearestWrittenTag(code, { line: original.lineNumber, name });
  const written = tag && { columnNumber: tag.column, lineNumber: tag.line };
  return siteOf({ ...original, ...written }, fileName, code);
}

async function clientCreationSite(creation: Fiber): Promise<CodeSite> {
  const fiber = recordedCreation(creation);
  if (!fiber) {
    return await writerSite(creation);
  }
  const source = await getSource(fiber).catch(() => null);
  if (source === null) {
    return MISSING_SITE;
  }
  const moduleUrl = getRawSource(fiber)?.fileName;
  return siteOf(source, moduleUrl, await mappedCode(source, moduleUrl));
}

async function callerOfLibrary(creation: ReactOwner): Promise<CodeSite> {
  const stack = isFiber(creation)
    ? recordedCreation(creation)?._debugStack?.stack
    : undefined;
  if (stack === undefined) {
    return MISSING_SITE;
  }
  const frames = parseStack(formatOwnerStack(stack));
  const sources = await symbolicateStack(frames).catch(() => frames);
  const sites = await Promise.all(
    sources.map(async (source, index) => {
      const moduleUrl = frames[index]?.fileName;
      return siteOf(source, moduleUrl, await mappedCode(source, moduleUrl));
    })
  );
  return sites.find((site) => site.kind === "found") ?? MISSING_SITE;
}

export async function creationSite(creation: ReactOwner): Promise<CodeSite> {
  const serverSite = serverCreationSite(
    isFiber(creation) ? creation._debugStack : creation.debugStack
  );
  if (serverSite) {
    return { kind: "found", request: serverSite };
  }
  return isFiber(creation) ? await clientCreationSite(creation) : MISSING_SITE;
}

async function isLibraryWritten(creation: ReactOwner): Promise<boolean> {
  const site = await creationSite(creation);
  if (site.kind !== "dependency") {
    return false;
  }
  const caller = await callerOfLibrary(creation);
  return caller.kind !== "found";
}

function wrapsDirectly(writer: ReactOwner, part: ReactOwner): boolean {
  let fiber = isFiber(part) ? part.return : null;
  while (fiber && !isSameFiber(fiber, writer)) {
    if (fiber.stateNode instanceof Element) {
      return false;
    }
    fiber = fiber.return;
  }
  return fiber !== null;
}

function ownsPart(options: {
  components: readonly string[];
  part: ReactOwner;
  writer: ReactOwner;
}): boolean {
  const { components, part, writer } = options;
  return (
    components.includes(ownerName(writer) ?? "") || wrapsDirectly(writer, part)
  );
}

export async function appOwnerOf(
  node: Element,
  components: readonly string[]
): Promise<ReactOwner | null> {
  const host = fiberOfNode(node);
  const owner = host?._debugOwner ?? null;
  if (!host || !owner || !(await isLibraryWritten(host))) {
    return owner;
  }
  let part: ReactOwner | null = owner;
  for (let depth = 0; part && depth < MAX_OWNER_DEPTH; depth++) {
    const writer: ReactOwner | null =
      (isFiber(part) ? part._debugOwner : part.owner) ?? null;
    if (!(await isLibraryWritten(part))) {
      return writer && ownsPart({ components, part, writer }) ? writer : part;
    }
    part = writer;
  }
  return owner;
}

export async function componentSite(options: {
  component: ReactOwner | null;
  node: Element;
}): Promise<CodeSite> {
  let creation: ReactOwner | null = fiberOfNode(options.node);
  let dependency = MISSING_SITE;
  for (let depth = 0; creation && depth < MAX_OWNER_DEPTH; depth++) {
    if (isSameFiber(creation, options.component)) {
      return dependency;
    }
    const site = await creationSite(creation);
    if (site.kind === "found") {
      return site;
    }
    if (site.kind === "dependency") {
      const caller = await callerOfLibrary(creation);
      if (caller.kind === "found") {
        return caller;
      }
      dependency = site;
    }
    creation =
      (isFiber(creation) ? creation._debugOwner : creation.owner) ?? null;
  }
  return dependency;
}
