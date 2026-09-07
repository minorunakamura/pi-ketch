import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  buildKetchArgs,
  clampInteger,
  DEFAULT_SEARCH_TIMEOUT_MS,
  nonEmpty,
  detailsFor,
  runKetch,
} from "../runtime/run-ketch";
import type { Flags } from "../types";

export function registerKetchCodeTool(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  pi.registerTool({
    name: "ketch_code",
    label: "Ketch Code Search",
    description:
      "Search public open-source code using ketch code. Returns JSON with repository/file/line context.",
    promptSnippet: "Search public OSS code via ketch code",
    promptGuidelines: [
      "Use ketch_code when the user asks how real projects call an API or wants implementation examples from public OSS.",
      "Use ketch_code instead of ketch_search for code usage examples; blogs talk about code, ketch_code greps code.",
      "If regex=true fails on the github backend, retry only with grepapp or sourcegraph; github does not support regex in ketch.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Code search query" }),
      lang: Type.Optional(
        Type.String({
          description: "Language filter, e.g. go, typescript, python, rust",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default: 5, max: 20)",
          minimum: 1,
          maximum: 20,
        }),
      ),
      backend: Type.Optional(
        Type.String({
          description: "Code backend: grepapp, sourcegraph, or github",
        }),
      ),
      regex: Type.Optional(
        Type.Boolean({
          description: "Interpret query as regex (grepapp/sourcegraph only)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!params.query.trim())
        throw new Error("[validation] query must not be blank");
      onUpdate?.({
        content: [{ type: "text", text: `ketch code: ${params.query}` }],
        details: {},
      });

      const flags: Flags = {
        lang: nonEmpty(params.lang),
        limit:
          params.limit !== undefined
            ? clampInteger(params.limit, 1, 20)
            : undefined,
        backend: nonEmpty(params.backend),
        regex: params.regex === true,
      };

      const args = buildKetchArgs("code", [params.query], flags);
      const run = await runKetch(pi, args, {
        cwd: ctx.cwd,
        signal,
        timeoutMs: DEFAULT_SEARCH_TIMEOUT_MS,
      });
      return {
        content: [{ type: "text", text: run.stdout || "[]" }],
        details: detailsFor(run),
      };
    },
  });
}
