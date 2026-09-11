import { readFile, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runKetch } from "../../src/runtime/run-ketch";

describe("runKetch", () => {
  it("executes ketch through ExtensionAPI", async () => {
    const exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout: "[]",
      stderr: "",
    });
    const pi = { exec };

    const result = await runKetch(pi, ["search", "pi", "--json"], {
      cwd: "/tmp/project",
    });

    expect(exec).toHaveBeenCalledWith("ketch", ["search", "pi", "--json"], {
      cwd: "/tmp/project",
      signal: undefined,
      timeout: 60_000,
    });
    expect(result.stdout).toBe("[]");
    expect(result.exitCode).toBe(0);
  });

  it("keeps Tool truncation and full-output file handling", async () => {
    const stdout = "line\n".repeat(100_000);
    const exec = vi.fn().mockResolvedValue({
      code: 0,
      stdout,
      stderr: "",
    });

    const result = await runKetch({ exec }, ["search", "pi", "--json"], {
      cwd: "/tmp/project",
    });

    expect(result.truncated).toBeDefined();
    expect(result.stdout).toContain("[Output truncated:");
    expect(result.fullOutputPath).toBeDefined();
    if (result.fullOutputPath) {
      try {
        await expect(readFile(result.fullOutputPath, "utf8")).resolves.toBe(
          stdout,
        );
      } finally {
        await rm(dirname(result.fullOutputPath), {
          recursive: true,
          force: true,
        });
      }
    }
  });
});
