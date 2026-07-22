import { Layer } from "effect";

// Nothing to compose yet - Iteration 2 (`shared/shell`) replaces this with
// `Layer.mergeAll(ShellUILive, ...)` once there's at least one real layer.
export const MainLayer = Layer.empty;
