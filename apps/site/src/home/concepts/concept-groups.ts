import type { ComponentType } from "react";

import { OVERLAY_STORY } from "../story/overlay-story";
import { PROPERTY_CONCEPTS } from "./property-concepts";

export interface NavGroup {
  concepts: readonly { id: string; title: string }[];
  Icon: ComponentType;
  id: string;
  title: string;
}

export const CONCEPT_GROUPS: readonly NavGroup[] = [
  PROPERTY_CONCEPTS,
  OVERLAY_STORY,
];
