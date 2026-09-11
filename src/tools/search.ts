import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  clampInteger,
  DEFAULT_SEARCH_TIMEOUT_MS,
  DEFAULT_TOOL_SCRAPE_CHARS,
  MAX_TOOL_CHARS,
  nonEmpty,
  detailsFor,
  runKetch,
} from "../runtime/run-ketch";
import { buildSearchArgs } from "../runtime/search";

export function registerKetchSearchTool(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  pi.registerTool({
    name: "ketch_search",
    label: "Ketch Search",
    description:
      "Search the live web using the ketch CLI. Returns JSON. When scrape is true, each fetched page is bounded to maxChars (default 6000, max 50000).",
    promptSnippet: "Search the live web via ketch search",
    promptGuidelines: [
      "Use ketch_search when the user asks for live web research, current pages, opinions, news, or comparisons.",
      "Use ketch_search with scrape=true when you need to find and read pages in one call; fetched pages are capped with maxChars and trim defaults to true.",
      "Use ketch_scrape when you already have a URL; do not re-search a known URL.",
      "Use ketch_docs for library/framework documentation and ketch_code for real OSS implementation examples.",
      "If ketch_search fails with [precondition], tell the user which ketch backend configuration is missing instead of retrying unchanged.",
    ],
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default: 5, max: 20)",
          minimum: 1,
          maximum: 20,
        }),
      ),
      backend: Type.Optional(
        Type.String({
          description:
            "Search backend: brave, ddg, searxng, exa, firecrawl, or keenable",
        }),
      ),
      multi: Type.Optional(
        Type.String({
          description:
            "Federated search backends, e.g. 'all' or 'brave,ddg,exa'. Mutually exclusive with backend.",
        }),
      ),
      scrape: Type.Optional(
        Type.Boolean({ description: "Fetch full content for each result" }),
      ),
      trim: Type.Optional(
        Type.Boolean({
          description:
            "When scrape is true, strip markdown formatting and keep text (default: true)",
        }),
      ),
      maxChars: Type.Optional(
        Type.Number({
          description:
            "Per-result content cap when scrape is true (default: 6000, max: 50000)",
          minimum: 1000,
          maximum: MAX_TOOL_CHARS,
        }),
      ),
      searxngUrl: Type.Optional(
        Type.String({
          description: "Override SearXNG instance URL for this search",
        }),
      ),
      cookieFile: Type.Optional(
        Type.String({
          description: "Netscape cookies.txt file for scraped results",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (params.backend && params.multi)
        throw new Error(
          "[validation] backend and multi are mutually exclusive",
        );
      if (!params.query.trim())
        throw new Error("[validation] query must not be blank");

      onUpdate?.({
        content: [{ type: "text", text: `ketch search: ${params.query}` }],
        details: {},
      });

      const args = buildSearchArgs({
        query: params.query,
        limit:
          params.limit !== undefined
            ? clampInteger(params.limit, 1, 20)
            : undefined,
        backend: nonEmpty(params.backend),
        multi: nonEmpty(params.multi),
        scrape: params.scrape === true,
        trim:
          params.scrape === true ? params.trim !== false : params.trim === true,
        maxChars:
          params.scrape === true
            ? clampInteger(
                params.maxChars ?? DEFAULT_TOOL_SCRAPE_CHARS,
                1_000,
                MAX_TOOL_CHARS,
              )
            : undefined,
        searxngUrl: nonEmpty(params.searxngUrl),
        cookieFile: nonEmpty(params.cookieFile),
      });
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
