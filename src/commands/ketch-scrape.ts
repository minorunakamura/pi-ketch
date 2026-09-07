import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  buildKetchArgs,
  DEFAULT_SCRAPE_TIMEOUT_MS,
  DEFAULT_TOOL_SCRAPE_CHARS,
  runKetch,
} from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchScrapeCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-scrape", {
    description: "Scrape a URL with ketch (usage: /ketch-scrape <url>)",
    handler: async (args, ctx) => {
      const url = args.trim();
      if (!url) {
        ctx.ui.notify("Usage: /ketch-scrape <url>", "error");
        return;
      }
      ctx.ui.notify(`ketch scrape: ${url}`, "info");
      try {
        const run = await runKetch(
          pi,
          buildKetchArgs("scrape", [url], {
            "max-chars": DEFAULT_TOOL_SCRAPE_CHARS,
            trim: true,
          }),
          {
            cwd: ctx.cwd,
            signal: ctx.signal,
            timeoutMs: DEFAULT_SCRAPE_TIMEOUT_MS,
          },
        );
        sendCommandResult(
          pi,
          "ketch-scrape-result",
          `Ketch scrape result for: ${url}`,
          run,
        );
      } catch (error) {
        notifyCommandError(ctx, "ketch-scrape failed", error);
      }
    },
  });
}
