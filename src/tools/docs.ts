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

export function registerKetchDocsTool(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  pi.registerTool({
    name: "ketch_docs",
    label: "Ketch Docs",
    description:
      "Search or resolve curated library/framework documentation using ketch docs and Context7. Returns JSON.",
    promptSnippet: "Search curated library/framework docs via ketch docs",
    promptGuidelines: [
      "Use ketch_docs for library/framework API questions instead of ketch_search.",
      "For unfamiliar libraries, first call ketch_docs with resolve=true, vet the returned library IDs by name, then call ketch_docs again with the chosen library ID.",
      "Do not blindly trust the first resolve result; Context7 resolve can return confident fuzzy matches for the wrong library.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Documentation query, or library name when resolve=true",
      }),
      library: Type.Optional(
        Type.String({ description: "Context7 library ID, e.g. /org/repo" }),
      ),
      resolve: Type.Optional(
        Type.Boolean({
          description: "Resolve a library name instead of searching docs",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default: 5, max: 20)",
          minimum: 1,
          maximum: 20,
        }),
      ),
      tokens: Type.Optional(
        Type.Number({
          description: "Context7 token budget (default: 4000, max: 20000)",
          minimum: 500,
          maximum: 20_000,
        }),
      ),
      backend: Type.Optional(
        Type.String({
          description:
            "Docs backend: context7 (local is planned but not implemented)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!params.query.trim())
        throw new Error("[validation] query must not be blank");
      if (params.resolve && params.library)
        throw new Error(
          "[validation] resolve and library are mutually exclusive",
        );

      onUpdate?.({
        content: [{ type: "text", text: `ketch docs: ${params.query}` }],
        details: {},
      });

      const flags: Flags = {
        library: nonEmpty(params.library),
        resolve: params.resolve === true,
        limit:
          params.limit !== undefined
            ? clampInteger(params.limit, 1, 20)
            : undefined,
        tokens:
          params.tokens !== undefined
            ? clampInteger(params.tokens, 500, 20_000)
            : undefined,
        backend: nonEmpty(params.backend),
      };

      const args = buildKetchArgs("docs", [params.query], flags);
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
