import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  buildKetchArgs,
  DEFAULT_SEARCH_TIMEOUT_MS,
  runKetch,
} from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchCodeCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-code", {
    description:
      "Search public OSS code with ketch (usage: /ketch-code <query>)",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Usage: /ketch-code <query>", "error");
        return;
      }
      ctx.ui.notify(`ketch code: ${query}`, "info");
      try {
        const run = await runKetch(
          pi,
          buildKetchArgs("code", [query], { limit: 5 }),
          {
            cwd: ctx.cwd,
            signal: ctx.signal,
            timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
          },
        );
        sendCommandResult(
          pi,
          "ketch-code-result",
          `Ketch code results for: ${query}`,
          run,
        );
      } catch (error) {
        notifyCommandError(ctx, "ketch-code failed", error);
      }
    },
  });
}
