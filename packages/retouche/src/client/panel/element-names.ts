export function componentTag(component: string): string {
  return `<${component} />`;
}

export function elementTag(component: string | null, tag: string): string {
  return component === null ? `<${tag}>` : componentTag(component);
}
