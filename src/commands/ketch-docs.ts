import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  buildKetchArgs,
  DEFAULT_SEARCH_TIMEOUT_MS,
  runKetch,
} from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchDocsCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-docs", {
    description: "Search docs with ketch (usage: /ketch-docs <query>)",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /ketch-docs <query>", "error");
        return;
      }
      ctx.ui.notify(`ketch docs: ${query}`, "info");
      try {
        const run = await runKetch(
          pi,
          buildKetchArgs("docs", [query], { limit: 5, tokens: 4_000 }),
          {
            cwd: ctx.cwd,
            signal: ctx.signal,
            timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
          },
        );
        sendCommandResult(
          pi,
          "ketch-docs-result",
          `Ketch docs results for: ${query}`,
          run,
        );
      } catch (error) {
        notifyCommandError(ctx, "ketch-docs failed", error);
      }
    },
  });
}
