import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

import { conciseErrorText } from "../runtime/run-ketch";

export function notifyCommandError(
  ctx: ExtensionCommandContext,
  prefix: string,
  error: unknown,
): void {
  ctx.ui.notify(`${prefix}: ${conciseErrorText(error)}`, "error");
}
