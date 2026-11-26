import type { RenderReport } from "../../renders/record/render-changes";
import { factText, renderFacts } from "../../renders/render-facts";
import type { TypeReading } from "../element/element-typography";
import type {
  ElementContext,
  ElementSites,
  SiteLocation,
} from "./element-context";

export interface NoteFacts {
  context: ElementContext;
  note: string;
  sites: ElementSites | null;
}

function code(tokens: string[]): string {
  return tokens.map((token) => `\`${token}\``).join(" ");
}

export function locationText(site: SiteLocation | null): string | null {
  if (!site) {
    return null;
  }
  return site.line === null ? site.path : `${site.path}:${site.line}`;
}

export function headingOf({
  component,
  tag,
  text,
}: Pick<ElementContext, "component" | "tag" | "text">): string {
  const element = component === null ? `<${tag}>` : `<${component}> (${tag})`;
  return text ? `${element} "${text}"` : element;
}

function typographyLines(readings: TypeReading[]): string[] {
  const classed = readings.filter(({ classes }) => classes.length > 0);
  if (classed.length > 0) {
    return classed.map(({ classes, group, value }) =>
      value
        ? `${group}: ${code(classes)} (${value})`
        : `${group}: ${code(classes)}`
    );
  }
  const measured = readings
    .filter(({ value }) => value)
    .map(({ group, value }) => `${group} ${value}`);
  return measured.length > 0 ? [`Measured: ${measured.join(", ")}`] : [];
}

function renderLines(report: RenderReport | null): string[] {
  if (report === null) {
    return [];
  }
  const { count, last } = renderFacts(report);
  return last.length > 0
    ? [`Renders: ${count}`, `Last render: ${last.map(factText).join("; ")}`]
    : [`Renders: ${count}`];
}

function factLines({ context, note, sites }: NoteFacts): string[] {
  const callSite = locationText(sites?.callSite ?? null);
  const component = locationText(sites?.component ?? null);
  const { classes, override } = context;
  return [
    `Page: ${context.page}`,
    callSite !== null && `Call site: ${callSite}`,
    component !== null && `Component: ${component}`,
    classes.length > 0 && `Classes: ${code(classes)}`,
    ...typographyLines(context.typography),
    override && `Override on <${override.component}>: ${code(override.labels)}`,
    ...renderLines(context.renders),
    note && `Note: ${note}`,
  ].filter((line): line is string => Boolean(line));
}

export function formatNote(facts: NoteFacts, number?: number): string {
  const marker = number === undefined ? "" : `${number}. `;
  const indent = " ".repeat(marker.length);
  const bullets = factLines(facts).map((line) =>
    `${indent}- ${line}`.replaceAll("\n", `\n${indent}  `)
  );
  return [`${marker}${headingOf(facts.context)}`, ...bullets].join("\n");
}

export function formatNotes(notes: NoteFacts[]): string {
  return notes.map((facts, index) => formatNote(facts, index + 1)).join("\n\n");
}
