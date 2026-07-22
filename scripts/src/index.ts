import { helloFromOtherApp } from "@repo/app-other"; // ALLOWED: "scripts" is the top layer, may import anything below it

export function helloFromScripts(): string {
  return `hello from scripts (${helloFromOtherApp()})`;
}
