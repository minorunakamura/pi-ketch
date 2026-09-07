import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { commandLine, detailsFor } from "../runtime/run-ketch";
import type { KetchRunResult } from "../types";

export function sendCommandResult(
  pi: ExtensionAPI,
  customType: string,
  title: string,
  run: KetchRunResult,
): void {
  pi.sendMessage({
    customType,
    content: `${title}\n\n$ ${commandLine(run.args)}\n\n${run.stdout || "(no output)"}`,
    display: true,
    details: detailsFor(run),
  });
}
