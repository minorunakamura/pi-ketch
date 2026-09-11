import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type KetchExecutionFailureCode = "cancelled" | "not_found" | "execution";

export class KetchExecutionFailure extends Error {
  readonly code: KetchExecutionFailureCode;

  constructor(
    code: KetchExecutionFailureCode,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message, options);
    this.name = "KetchExecutionFailure";
    this.code = code;
  }
}

export interface KetchExecutionOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface KetchExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingExecutable(error: unknown, message: string): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  return code === "ENOENT" || /ENOENT|not found|spawn\s+ketch/i.test(message);
}

export async function executeKetch(
  pi: Pick<ExtensionAPI, "exec">,
  args: string[],
  options: KetchExecutionOptions,
): Promise<KetchExecutionResult> {
  if (options.signal?.aborted) {
    throw new KetchExecutionFailure(
      "cancelled",
      "Aborted before ketch started",
    );
  }

  try {
    const result = await pi.exec("ketch", args, {
      cwd: options.cwd,
      signal: options.signal,
      timeout: options.timeoutMs,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  } catch (error) {
    if (error instanceof KetchExecutionFailure) throw error;

    const message = errorMessage(error);
    const code = options.signal?.aborted
      ? "cancelled"
      : isMissingExecutable(error, message)
        ? "not_found"
        : "execution";
    throw new KetchExecutionFailure(code, message || "ketch execution failed", {
      cause: error,
    });
  }
}
