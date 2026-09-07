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
});
