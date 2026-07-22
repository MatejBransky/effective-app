import { Atom } from "effect/unstable/reactivity";
import { MainLayer } from "./MainLayer.ts";

export const runtime = Atom.runtime(MainLayer);
