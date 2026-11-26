import { isFiber } from "bippy";

import type { ReactOwner } from "./react-fiber";

export function entryOfInstance<Entry>(
  entries: WeakMap<ReactOwner, Entry>,
  identity: ReactOwner,
  create: () => Entry
): Entry {
  const alternate = isFiber(identity) ? identity.alternate : null;
  const entry =
    entries.get(identity) ??
    (alternate ? entries.get(alternate) : undefined) ??
    create();
  entries.set(identity, entry);
  if (alternate) {
    entries.set(alternate, entry);
  }
  return entry;
}
