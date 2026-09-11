import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "@earendil-works/pi-coding-agent";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  Flags,
  KetchCommand,
  KetchRunOptions,
  KetchRunResult,
  KetchToolDetails,
} from "../types";
import { KetchExecutionFailure, executeKetch } from "./execute-ketch";

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_SEARCH_TIMEOUT_MS = 45_000;
export const DEFAULT_SCRAPE_TIMEOUT_MS = 90_000;
export const DEFAULT_TOOL_SCRAPE_CHARS = 6_000;
export const MAX_TOOL_CHARS = 50_000;

export function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}

export function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function pushFlag(args: string[], key: string, value: Flags[string]): void {
  if (value === undefined || value === false) return;

  // ketch's --multi accepts an optional value. The CLI requires --multi=a,b,
  // not "--multi a,b".
  if (key === "multi") {
    if (value === true) {
      args.push("--multi");
      return;
    }
    if (typeof value === "string" && value.trim()) {
      args.push(`--multi=${value.trim()}`);
      return;
    }
    return;
  }

  if (value === true) {
    args.push(`--${key}`);
    return;
  }

  args.push(`--${key}`, String(value));
}

export function buildKetchArgs(
  command: KetchCommand,
  positional: string[] = [],
  flags: Flags = {},
): string[] {
  const args = [command, ...positional];

  for (const [key, value] of Object.entries(flags)) {
    pushFlag(args, key, value);
  }

  args.push("--json");
  return args;
}

export function classifyKetchExit(code: number): string {
  switch (code) {
    case 2:
      return "[validation] bad input";
    case 3:
      return "[not_found] no match";
    case 4:
      return "[upstream] backend/network failure";
    case 5:
      return "[precondition] missing configuration or dependency";
    case 6:
      return "[cancelled] interrupted or timed out";
    default:
      return "[error] ketch failed";
  }
}

export function conciseErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function commandLine(args: string[]): string {
  return ["ketch", ...args]
    .map((arg) =>
      /^[a-zA-Z0-9_./:=@+-]+$/.test(arg) ? arg : JSON.stringify(arg),
    )
    .join(" ");
}

export const KETCH_INSTALL_HINT =
  "ketch CLI が見つかりません。インストール後に /reload してください: brew install 1broseidon/tap/ketch または go install github.com/1broseidon/ketch@latest";

async function maybeWriteFullOutput(output: string): Promise<{
  text: string;
  truncation?: KetchRunResult["truncated"];
  fullOutputPath?: string;
}> {
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });

  if (!truncation.truncated) {
    return { text: truncation.content };
  }

  const tempDir = await mkdtemp(join(tmpdir(), "pi-ketch-"));
  const tempFile = join(tempDir, "output.txt");
  await writeFile(tempFile, output, "utf8");

  const omittedLines = truncation.totalLines - truncation.outputLines;
  const omittedBytes = truncation.totalBytes - truncation.outputBytes;
  const notice = [
    "",
    `[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
    ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`,
    ` ${omittedLines} lines (${formatSize(omittedBytes)}) omitted.`,
    ` Full output saved to: ${tempFile}]`,
  ].join("");

  return {
    text: `${truncation.content}\n${notice}`,
    truncation: {
      outputLines: truncation.outputLines,
      totalLines: truncation.totalLines,
      outputBytes: truncation.outputBytes,
      totalBytes: truncation.totalBytes,
    },
    fullOutputPath: tempFile,
  };
}

export async function runKetch(
  pi: Pick<ExtensionAPI, "exec">,
  args: string[],
  options: KetchRunOptions,
): Promise<KetchRunResult> {
  if (options.signal?.aborted)
    throw new Error("[cancelled] Aborted before ketch started");

  let result: Awaited<ReturnType<typeof executeKetch>>;
  try {
    result = await executeKetch(pi, args, {
      cwd: options.cwd,
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  } catch (error) {
    const message = conciseErrorText(error);
    if (
      (error instanceof KetchExecutionFailure && error.code === "not_found") ||
      /ENOENT|not found|spawn ketch/i.test(message)
    ) {
      throw new Error(KETCH_INSTALL_HINT, { cause: error });
    }
    if (error instanceof KetchExecutionFailure && error.code === "cancelled") {
      throw new Error(`[cancelled] ${message}`, { cause: error });
    }
    throw new Error(`ketch 実行に失敗しました: ${message}`, { cause: error });
  }

  const allowedExitCodes = new Set([0, ...(options.allowExitCodes ?? [])]);
  if (!allowedExitCodes.has(result.exitCode)) {
    const output = [result.stderr, result.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    const detail = output ? `\n${output}` : "";
    throw new Error(
      `${classifyKetchExit(result.exitCode)}: ${commandLine(args)} failed with exit code ${result.exitCode}${detail}`,
    );
  }

  const fullOutput = result.stdout || result.stderr || "";
  const output = await maybeWriteFullOutput(fullOutput);

  return {
    command: "ketch",
    args,
    stdout: output.text,
    stderr: result.stderr,
    exitCode: result.exitCode,
    truncated: output.truncation,
    fullOutputPath: output.fullOutputPath,
  };
}

export function detailsFor(run: KetchRunResult): KetchToolDetails {
  return {
    command: run.command,
    args: run.args,
    exitCode: run.exitCode,
    stderr: run.stderr || undefined,
    truncated: run.truncated,
    fullOutputPath: run.fullOutputPath,
  };
}
