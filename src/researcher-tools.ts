import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerTools } from "./tools";

export default function researcherTools(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  registerTools(pi);
}
