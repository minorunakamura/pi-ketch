import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { KetchExecutionFailure, executeKetch } from "../runtime/execute-ketch";
import { buildSearchArgs, type SearchCommandInput } from "../runtime/search";
import {
  KetchExecutionError,
  type KetchExecutionErrorCode,
} from "./execution-error";

export interface SearchRequest {
  query: string;
  limit?: number;
  provider?: SearchProvider;
  scrape?: boolean | SearchScrapeOptions;
  searxngUrl?: string;
}

export type SearchProvider =
  | {
      mode: "configured";
    }
  | {
      mode: "single";
      backend: string;
    }
  | {
      mode: "multi";
      backends: "all" | readonly string[];
    };

export interface SearchScrapeOptions {
  trim?: boolean;
  maxChars?: number;
  cookieFile?: string;
}

export interface SearchExecutionOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  fetchedUrl?: string;
  description?: string;
  content?: string;
  backends?: readonly string[];
}

export interface SearchResponse {
  results: readonly SearchResult[];
  diagnostics?: string;
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_SCRAPE_MAX_CHARS = 6_000;
const MIN_SCRAPE_MAX_CHARS = 1_000;
const MAX_SCRAPE_MAX_CHARS = 50_000;

function validationError(message: string): never {
  throw new KetchExecutionError(message, "validation");
}

function trimmedRequired(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    validationError(`${field} must not be blank`);
  }
  return value.trim();
}

function trimmedOptional(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return trimmedRequired(value, field);
}

function validatedInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    validationError(`${field} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function validatedPositiveInteger(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    validationError(`${field} must be a positive integer`);
  }
  return value;
}

function normalizeProvider(
  provider: SearchProvider | undefined,
): Pick<SearchCommandInput, "backend" | "multi"> {
  if (provider === undefined) return {};
  if (
    provider === null ||
    typeof provider !== "object" ||
    Array.isArray(provider)
  ) {
    validationError("provider is invalid");
  }

  switch (provider.mode) {
    case "configured":
      return {};
    case "single":
      return { backend: trimmedRequired(provider.backend, "provider.backend") };
    case "multi": {
      if (provider.backends === "all") return { multi: "all" };
      if (!Array.isArray(provider.backends) || provider.backends.length === 0) {
        validationError("provider.backends must not be empty");
      }

      const backends: string[] = [];
      const seen = new Set<string>();
      for (const backend of provider.backends) {
        const normalized = trimmedRequired(backend, "provider.backends");
        if (normalized === "all") {
          validationError('provider.backends must not contain "all"');
        }
        if (!seen.has(normalized)) {
          seen.add(normalized);
          backends.push(normalized);
        }
      }
      return { multi: backends.join(",") };
    }
    default:
      return validationError("provider.mode is invalid");
  }
}

function normalizeScrape(
  scrape: SearchRequest["scrape"],
): Pick<SearchCommandInput, "scrape" | "trim" | "maxChars" | "cookieFile"> {
  if (scrape === undefined || scrape === false) return {};
  if (scrape === true) {
    return {
      scrape: true,
      trim: true,
      maxChars: DEFAULT_SCRAPE_MAX_CHARS,
    };
  }
  if (scrape === null || typeof scrape !== "object" || Array.isArray(scrape)) {
    validationError("scrape is invalid");
  }

  const trim =
    scrape.trim === undefined
      ? true
      : typeof scrape.trim === "boolean"
        ? scrape.trim
        : validationError("scrape.trim must be a boolean");
  const maxChars =
    scrape.maxChars === undefined
      ? DEFAULT_SCRAPE_MAX_CHARS
      : validatedInteger(
          scrape.maxChars,
          "scrape.maxChars",
          MIN_SCRAPE_MAX_CHARS,
          MAX_SCRAPE_MAX_CHARS,
        );

  return {
    scrape: true,
    trim,
    maxChars,
    cookieFile: trimmedOptional(scrape.cookieFile, "scrape.cookieFile"),
  };
}

function normalizeRequest(request: SearchRequest): SearchCommandInput {
  if (request === null || typeof request !== "object") {
    validationError("request is invalid");
  }

  const query = trimmedRequired(request.query, "query");
  const limit =
    request.limit === undefined
      ? undefined
      : validatedInteger(request.limit, "limit", 1, 20);

  return {
    query,
    limit,
    ...normalizeProvider(request.provider),
    ...normalizeScrape(request.scrape),
    searxngUrl: trimmedOptional(request.searxngUrl, "searxngUrl"),
  };
}

function normalizeExecutionOptions(
  options: SearchExecutionOptions,
): Required<Pick<SearchExecutionOptions, "cwd" | "timeoutMs">> &
  Pick<SearchExecutionOptions, "signal"> {
  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    typeof options.cwd !== "string" ||
    options.cwd.length === 0
  ) {
    validationError("cwd must be provided");
  }

  const timeoutMs =
    options.timeoutMs === undefined
      ? DEFAULT_TIMEOUT_MS
      : validatedPositiveInteger(options.timeoutMs, "timeoutMs");

  return {
    cwd: options.cwd,
    signal: options.signal,
    timeoutMs,
  };
}

function diagnosticsText(...values: string[]): string | undefined {
  const diagnostics = values.filter(Boolean).join("\n");
  return diagnostics.trim() ? diagnostics : undefined;
}

function exitErrorCode(code: number): KetchExecutionErrorCode {
  switch (code) {
    case 2:
      return "validation";
    case 3:
      return "not_found";
    case 4:
      return "upstream";
    case 5:
      return "precondition";
    case 6:
      return "cancelled";
    default:
      return "execution";
  }
}

function cancelledError(cause?: unknown): KetchExecutionError {
  return new KetchExecutionError("ketch search was cancelled", "cancelled", {
    cause,
  });
}

function processError(
  error: unknown,
  signal: AbortSignal | undefined,
): KetchExecutionError {
  if (
    signal?.aborted ||
    (error instanceof KetchExecutionFailure && error.code === "cancelled")
  ) {
    return cancelledError(error);
  }

  if (error instanceof KetchExecutionFailure && error.code === "not_found") {
    return new KetchExecutionError(
      "ketch executable was not found",
      "precondition",
      { diagnostics: error.message, cause: error },
    );
  }

  const diagnostics =
    error instanceof Error
      ? diagnosticsText(error.message)
      : diagnosticsText(String(error));
  return new KetchExecutionError("ketch search execution failed", "execution", {
    diagnostics,
    cause: error,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseResults(stdout: string): readonly SearchResult[] {
  const value: unknown = JSON.parse(stdout);
  if (!Array.isArray(value)) throw new Error("search output must be an array");

  return value.map((item) => {
    if (!isObject(item)) throw new Error("search result must be an object");
    if (typeof item.title !== "string" || typeof item.url !== "string") {
      throw new Error("search result title and url must be strings");
    }

    const fetchedUrl = item.fetched_url;
    const description = item.description;
    const content = item.content;
    const backends = item.backends;
    if (
      (hasOwn(item, "fetched_url") && typeof fetchedUrl !== "string") ||
      (hasOwn(item, "description") && typeof description !== "string") ||
      (hasOwn(item, "content") && typeof content !== "string") ||
      (hasOwn(item, "backends") && !isStringArray(backends))
    ) {
      throw new Error("search result field has an invalid type");
    }

    const result: SearchResult = {
      title: item.title,
      url: item.url,
    };
    if (hasOwn(item, "fetched_url") && typeof fetchedUrl === "string") {
      result.fetchedUrl = fetchedUrl;
    }
    if (hasOwn(item, "description") && typeof description === "string") {
      result.description = description;
    }
    if (hasOwn(item, "content") && typeof content === "string") {
      result.content = content;
    }
    if (hasOwn(item, "backends") && isStringArray(backends)) {
      result.backends = backends;
    }
    return result;
  });
}

export async function executeSearch(
  pi: Pick<ExtensionAPI, "exec">,
  request: SearchRequest,
  options: SearchExecutionOptions,
): Promise<SearchResponse> {
  const input = normalizeRequest(request);
  const executionOptions = normalizeExecutionOptions(options);
  if (executionOptions.signal?.aborted) throw cancelledError();

  const args = buildSearchArgs(input);
  let raw;
  try {
    raw = await executeKetch(pi, args, executionOptions);
  } catch (error) {
    throw processError(error, executionOptions.signal);
  }

  if (executionOptions.signal?.aborted) throw cancelledError();

  if (raw.exitCode !== 0) {
    const code = exitErrorCode(raw.exitCode);
    throw new KetchExecutionError(
      `ketch search failed with exit code ${raw.exitCode}`,
      code,
      {
        exitCode: raw.exitCode,
        diagnostics: diagnosticsText(raw.stderr, raw.stdout),
      },
    );
  }

  let results: readonly SearchResult[];
  try {
    results = parseResults(raw.stdout);
  } catch (error) {
    throw new KetchExecutionError(
      "ketch search returned invalid JSON output",
      "invalid_output",
      { cause: error },
    );
  }

  const diagnostics = diagnosticsText(raw.stderr);
  return diagnostics ? { results, diagnostics } : { results };
}

export { KetchExecutionError } from "./execution-error";
export type { KetchExecutionErrorCode } from "./execution-error";
