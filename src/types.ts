export type KetchResearchCommand = "search" | "scrape" | "docs" | "code";
export type KetchCommand = KetchResearchCommand | "config" | "doctor";
export type FlagValue = string | number | boolean | undefined;
export type Flags = Record<string, FlagValue>;

export interface KetchRunOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  cwd: string;
  allowExitCodes?: number[];
}

export interface KetchTruncation {
  outputLines: number;
  totalLines: number;
  outputBytes: number;
  totalBytes: number;
}

export interface KetchRunResult {
  command: "ketch";
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated?: KetchTruncation;
  fullOutputPath?: string;
}

export interface KetchToolDetails {
  command: "ketch";
  args: string[];
  exitCode: number;
  stderr?: string;
  truncated?: KetchTruncation;
  fullOutputPath?: string;
}
