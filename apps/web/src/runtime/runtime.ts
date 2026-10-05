import { Atom } from "effect/reactivity";
import { MainLayer } from "./MainLayer.ts";

export const runtime = Atom.runtime(MainLayer);
