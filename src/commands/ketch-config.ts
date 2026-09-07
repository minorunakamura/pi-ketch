import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { buildKetchArgs, runKetch } from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchConfigCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-config", {
    description: "Show effective ketch config as JSON",
    handler: async (_args, ctx) => {
      ctx.ui.notify("ketch config", "info");
      try {
        const run = await runKetch(pi, buildKetchArgs("config"), {
          cwd: ctx.cwd,
          signal: ctx.signal,
          timeoutMs: 15_000,
        });
        sendCommandResult(pi, "ketch-config-result", "Ketch config", run);
      } catch (error) {
        notifyCommandError(ctx, "ketch-config failed", error);
      }
    },
  });
}
