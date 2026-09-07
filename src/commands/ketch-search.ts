import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  buildKetchArgs,
  DEFAULT_SEARCH_TIMEOUT_MS,
  runKetch,
} from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchSearchCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-search", {
    description: "Search the web with ketch (usage: /ketch-search <query>)",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /ketch-search <query>", "error");
        return;
      }
      ctx.ui.notify(`ketch search: ${query}`, "info");
      try {
        const run = await runKetch(
          pi,
          buildKetchArgs("search", [query], { limit: 5 }),
          {
            cwd: ctx.cwd,
            signal: ctx.signal,
            timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
          },
        );
        sendCommandResult(
          pi,
          "ketch-search-result",
          `Ketch search results for: ${query}`,
          run,
        );
      } catch (error) {
        notifyCommandError(ctx, "ketch-search failed", error);
      }
    },
  });
}
