import type { Props } from "bippy";
import { z } from "zod";

import {
  type ComponentType,
  isComponentType,
  isRecord,
  typeName,
} from "../../fiber/react-fiber";

export type ShownValue =
  | { kind: "array"; length: number }
  | { kind: "element"; name: string | null }
  | { kind: "function"; name: string | null }
  | { kind: "object" }
  | { kind: "primitive"; text: string }
  | { kind: "string"; text: string };

interface ElementFields {
  key: unknown;
  props: unknown;
  type: unknown;
}

type AppFunction = (...parameters: never[]) => void;

const ELEMENT_TYPES: ReadonlySet<unknown> = new Set([
  Symbol.for("react.transitional.element"),
  Symbol.for("react.element"),
]);
const UNREADABLE: ShownValue = { kind: "object" };

export function isArrayValue(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

export function isElement(value: unknown): value is ElementFields {
  return (
    isRecord(value) &&
    "$$typeof" in value &&
    ELEMENT_TYPES.has(value.$$typeof) &&
    "type" in value &&
    "key" in value &&
    "props" in value
  );
}

export function isPlainObject(value: unknown): value is Props {
  if (!isRecord(value) || isElement(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function isAppFunction(value: unknown): value is AppFunction {
  return typeof value === "function";
}

const elementNameSchema = z.union([
  z.string(),
  z.custom<ComponentType>(isComponentType).transform((type) => typeName(type)),
  z.unknown().transform(() => null),
]);

const readableValueSchema = z.union([
  z.string().transform((text): ShownValue => ({ kind: "string", text })),
  z
    .union([
      z.number(),
      z.bigint(),
      z.boolean(),
      z.null(),
      z.undefined(),
      z.symbol(),
    ])
    .transform((value): ShownValue => ({
      kind: "primitive",
      text: String(value),
    })),
  z.custom<AppFunction>(isAppFunction).transform(({ name }): ShownValue => ({
    kind: "function",
    name: name === "" ? null : name,
  })),
  z
    .custom<readonly unknown[]>(isArrayValue)
    .transform(({ length }): ShownValue => ({ kind: "array", length })),
  z.custom<ElementFields>(isElement).transform(({ type }): ShownValue => ({
    kind: "element",
    name: elementNameSchema.parse(type),
  })),
  z.unknown().transform((): ShownValue => UNREADABLE),
]);

export const shownValueSchema = z.unknown().transform((value) => {
  try {
    return readableValueSchema.parse(value);
  } catch {
    // Revoked proxies and throwing getters throw on any read.
    return UNREADABLE;
  }
});
