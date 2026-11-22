import { getRDTHook } from "bippy";

if (process.env.NODE_ENV !== "production") {
  getRDTHook();
}
