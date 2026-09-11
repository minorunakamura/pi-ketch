import { buildKetchArgs } from "./run-ketch";
import type { Flags } from "../types";

export interface SearchCommandInput {
  query: string;
  limit?: number;
  backend?: string;
  multi?: string;
  scrape?: boolean;
  trim?: boolean;
  maxChars?: number;
  searxngUrl?: string;
  cookieFile?: string;
}

export function buildSearchArgs(input: SearchCommandInput): string[] {
  const flags: Flags = {
    limit: input.limit,
    backend: input.backend,
    multi: input.multi,
    scrape: input.scrape,
    trim: input.trim,
    "max-chars": input.maxChars,
    "searxng-url": input.searxngUrl,
    "cookie-file": input.cookieFile,
  };

  return buildKetchArgs("search", [input.query], flags);
}
