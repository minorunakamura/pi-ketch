import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerKetchCodeCommand } from "./ketch-code";
import { registerKetchConfigCommand } from "./ketch-config";
import { registerKetchDoctorCommand } from "./ketch-doctor";
import { registerKetchDocsCommand } from "./ketch-docs";
import { registerKetchScrapeCommand } from "./ketch-scrape";
import { registerKetchSearchCommand } from "./ketch-search";

export function registerCommands(pi: ExtensionAPI): void {
  registerKetchSearchCommand(pi);
  registerKetchScrapeCommand(pi);
  registerKetchCodeCommand(pi);
  registerKetchDocsCommand(pi);
  registerKetchConfigCommand(pi);
  registerKetchDoctorCommand(pi);
}
