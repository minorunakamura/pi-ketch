import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import {
  buildKetchArgs,
  clampInteger,
  DEFAULT_SCRAPE_TIMEOUT_MS,
  DEFAULT_TOOL_SCRAPE_CHARS,
  MAX_TOOL_CHARS,
  nonEmpty,
  detailsFor,
  runKetch,
} from "../runtime/run-ketch";
import type { Flags } from "../types";

export function registerKetchScrapeTool(
  pi: Pick<ExtensionAPI, "registerTool" | "exec">,
): void {
  pi.registerTool({
    name: "ketch_scrape",
    label: "Ketch Scrape",
    description:
      "Fetch one or more URLs and extract clean markdown/text with ketch scrape. Output is bounded by maxChars (default 6000, max 50000) and returned as JSON.",
    promptSnippet:
      "Fetch URLs and extract clean markdown/text via ketch scrape",
    promptGuidelines: [
      "Use ketch_scrape when you already have a URL; use ketch_search with scrape=true when you need to find and read pages.",
      "Keep ketch_scrape bounded: maxChars should usually be 4000-8000 for unknown pages; this tool defaults to 6000.",
      "Check batch ketch_scrape JSON results entry by entry because individual URLs can fail inside an otherwise successful batch.",
      "Set noCache=true only when the user explicitly asks for fresh data or cached results may be stale.",
    ],
    parameters: Type.Object({
      url: Type.Optional(
        Type.String({ description: "Single HTTP/HTTPS URL to scrape" }),
      ),
      urls: Type.Optional(
        Type.Array(Type.String({ description: "HTTP/HTTPS URL" }), {
          description: "Multiple URLs to scrape as one batch",
        }),
      ),
      maxChars: Type.Optional(
        Type.Number({
          description: "Per-page content cap (default: 6000, max: 50000)",
          minimum: 1000,
          maximum: MAX_TOOL_CHARS,
        }),
      ),
      trim: Type.Optional(
        Type.Boolean({
          description:
            "Strip markdown formatting and keep text (default: true)",
        }),
      ),
      selector: Type.Optional(
        Type.String({
          description: "CSS selector to extract; skips readability",
        }),
      ),
      raw: Type.Optional(
        Type.Boolean({
          description:
            "Return raw HTML instead of markdown; incompatible with selector/trim",
        }),
      ),
      noLlmsTxt: Type.Optional(
        Type.Boolean({
          description: "Disable /llms.txt detection for bare domains",
        }),
      ),
      forceBrowser: Type.Optional(
        Type.Boolean({ description: "Always render via configured browser" }),
      ),
      noCache: Type.Optional(
        Type.Boolean({ description: "Bypass ketch page cache" }),
      ),
      concurrency: Type.Optional(
        Type.Number({
          description: "Max concurrent requests for multi-URL scrape",
          minimum: 1,
          maximum: 16,
        }),
      ),
      cookieFile: Type.Optional(
        Type.String({ description: "Netscape cookies.txt file" }),
      ),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const urls = [params.url, ...(params.urls ?? [])]
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean);
      if (urls.length === 0)
        throw new Error("[validation] provide url or urls");
      if (params.raw && (params.selector || params.trim === true)) {
        throw new Error(
          "[validation] raw is incompatible with selector and trim",
        );
      }

      onUpdate?.({
        content: [
          { type: "text", text: `ketch scrape: ${urls.length} URL(s)` },
        ],
        details: {},
      });

      const flags: Flags = {
        "max-chars": clampInteger(
          params.maxChars ?? DEFAULT_TOOL_SCRAPE_CHARS,
          1_000,
          MAX_TOOL_CHARS,
        ),
        trim: params.raw ? false : params.trim !== false,
        select: nonEmpty(params.selector),
        raw: params.raw === true,
        "no-llms-txt": params.noLlmsTxt === true,
        "force-browser": params.forceBrowser === true,
        "no-cache": params.noCache === true,
        concurrency:
          params.concurrency !== undefined
            ? clampInteger(params.concurrency, 1, 16)
            : undefined,
        "cookie-file": nonEmpty(params.cookieFile),
      };

      const args = buildKetchArgs("scrape", urls, flags);
      const run = await runKetch(pi, args, {
        cwd: ctx.cwd,
        signal,
        timeoutMs: DEFAULT_SCRAPE_TIMEOUT_MS,
      });
      return {
        content: [{ type: "text", text: run.stdout || "[]" }],
        details: detailsFor(run),
      };
    },
  });
}
