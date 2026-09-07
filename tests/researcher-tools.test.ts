import { describe, expect, it, vi } from "vitest";

import researcherTools from "../src/researcher-tools";

describe("researcherTools", () => {
  it("registers only the Ketch research tools", () => {
    const registerTool = vi.fn();
    const pi = {
      registerTool,
      exec: vi.fn(),
    };

    researcherTools(pi);

    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      "ketch_search",
      "ketch_scrape",
      "ketch_code",
      "ketch_docs",
    ]);
  });
});
