import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { buildKetchArgs, runKetch } from "../runtime/run-ketch";
import { notifyCommandError, sendCommandResult } from "../ui";

export function registerKetchDoctorCommand(pi: ExtensionAPI): void {
  pi.registerCommand("ketch-doctor", {
    description: "Run ketch doctor health checks as JSON",
    handler: async (_args, ctx) => {
      ctx.ui.notify("ketch doctor", "info");
      try {
        const run = await runKetch(pi, buildKetchArgs("doctor"), {
          cwd: ctx.cwd,
          signal: ctx.signal,
          timeoutMs: 45_000,
          allowExitCodes: [5],
        });
        sendCommandResult(pi, "ketch-doctor-result", "Ketch doctor", run);
      } catch (error) {
        notifyCommandError(ctx, "ketch-doctor failed", error);
      }
    },
  });
}
