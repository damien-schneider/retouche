import { isServerFrame } from "../../protocol";
import type { PropertyChange } from "../../rules/class-diff";
import { parseClassToken } from "../../rules/class-token";
import type { OverrideInstance } from "../fiber/scan-overrides";
import type { ComputedReading } from "../fiber/strip-override";
import type { SourceRequest } from "../route/dev-route";

export interface OverrideFacts {
  callSite: SourceRequest | null;
  changes: PropertyChange[];
  instance: OverrideInstance;
  readings: ComputedReading[];
}

function locationOf(callSite: SourceRequest | null): string {
  if (!callSite || isServerFrame(callSite.fileName)) {
    return "";
  }
  const line = callSite.line === null ? "" : `:${callSite.line}`;
  return ` in ${callSite.fileName}${line}`;
}

function codeList(tokens: string[]): string {
  return tokens.map((token) => `\`${token}\``).join(" ");
}

function changeLine(
  change: PropertyChange,
  reading: ComputedReading | undefined
): string {
  const replaced =
    change.removed.length > 0
      ? `replaces ${codeList(change.removed)}`
      : "overrides the value the component inherits";
  const measured = change.appliesAtRest ? reading : undefined;
  const isMeasured =
    measured !== undefined &&
    measured.before !== null &&
    measured.before !== "";
  const values = isMeasured ? ` (${measured.before} → ${measured.after})` : "";
  return `- ${change.group}: ${codeList(change.added)} ${replaced}${values}.`;
}

function factLines(facts: OverrideFacts): string[] {
  return [
    `Retouche found a call-site typography override on <${facts.instance.component}>${locationOf(facts.callSite)}.`,
    "",
    "Overridden properties:",
    ...facts.changes.map((change) =>
      changeLine(
        change,
        facts.readings.find(({ group }) => group === change.group)
      )
    ),
  ];
}

function stringList(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function styleProperties(instance: OverrideInstance): string[] {
  return [
    ...new Set(
      instance.overrides.flatMap(({ groups, target }) =>
        target.kind === "style" ? groups : []
      )
    ),
  ];
}

export function allowEntryOf(instance: OverrideInstance): string {
  const classes = instance.overrides.flatMap(({ target }) =>
    target.kind === "class" ? [parseClassToken(target.token).utility] : []
  );
  const properties = styleProperties(instance);
  const fields = [
    `component: ${JSON.stringify(instance.component)}`,
    classes.length > 0 ? `classes: ${stringList([...new Set(classes)])}` : "",
    properties.length > 0 ? `properties: ${stringList(properties)}` : "",
  ];
  return [
    "{",
    ...fields.filter(Boolean).map((field) => `  ${field},`),
    "}",
  ].join("\n");
}

function allowScope(instance: OverrideInstance): string {
  const properties = styleProperties(instance);
  const scope = `The entry applies to every <${instance.component}>, not only this call site.`;
  return properties.length > 0
    ? `${scope} Its \`properties\` let through every ${properties.join(", ")} override on <${instance.component}>, by class or inline style.`
    : scope;
}

export function existingVariantPrompt(facts: OverrideFacts): string {
  const { component } = facts.instance;
  return [
    ...factLines(facts),
    "",
    `This override is not wanted. Remove the overriding className/style tokens from the call site and reach the design through a variant or prop <${component}> already has. If none fits, stop and say which comes closest. Leave <${component}> and retouche.config.ts unchanged.`,
  ].join("\n");
}

export function newVariantPrompt(facts: OverrideFacts): string {
  const { component } = facts.instance;
  return [
    ...factLines(facts),
    "",
    `<${component}> has no variant for this design yet. Add one to <${component}> that carries the overriding styles, named for its role rather than its values. Then use it at the call site in place of the overriding className/style tokens. Leave retouche.config.ts unchanged.`,
  ].join("\n");
}

export function allowPrompt(facts: OverrideFacts): string {
  return [
    ...factLines(facts),
    "",
    "This override is intended. Add this entry to the `allow` array in retouche.config.ts so Retouche stops reporting it:",
    "",
    allowEntryOf(facts.instance),
    "",
    `${allowScope(facts.instance)} Leave the call site unchanged.`,
  ].join("\n");
}
