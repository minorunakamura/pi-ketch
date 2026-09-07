import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerKetchCodeTool } from "./code";
import { registerKetchDocsTool } from "./docs";
import { registerKetchScrapeTool } from "./scrape";
import { registerKetchSearchTool } from "./search";

export function registerTools(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  registerKetchSearchTool(pi);
  registerKetchScrapeTool(pi);
  registerKetchCodeTool(pi);
  registerKetchDocsTool(pi);
}
