export type KetchExecutionErrorCode =
  | "validation"
  | "not_found"
  | "upstream"
  | "precondition"
  | "cancelled"
  | "execution"
  | "invalid_output";

export interface KetchExecutionErrorOptions {
  exitCode?: number;
  diagnostics?: string;
  cause?: unknown;
}

export class KetchExecutionError extends Error {
  readonly code: KetchExecutionErrorCode;
  readonly exitCode?: number;
  readonly diagnostics?: string;

  constructor(
    message: string,
    code: KetchExecutionErrorCode,
    options: KetchExecutionErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "KetchExecutionError";
    this.code = code;
    this.exitCode = options.exitCode;
    this.diagnostics = options.diagnostics;
  }
}
