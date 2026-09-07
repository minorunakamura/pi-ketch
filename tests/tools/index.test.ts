import { describe, expect, it, vi } from "vitest";

import { registerTools } from "../../src/tools";

describe("registerTools", () => {
  it("registers one tool per tool module", () => {
    const registerTool = vi.fn();
    const pi = { registerTool, exec: vi.fn() };

    registerTools(pi);

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      "ketch_search",
      "ketch_scrape",
      "ketch_code",
      "ketch_docs",
    ]);
  });
});
