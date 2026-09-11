import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import { registerKetchSearchTool } from "../../src/tools/search";

describe("ketch_search tool adapter", () => {
  it("keeps raw ketch JSON while sharing canonical Search arguments", async () => {
    const stdout = '[{"title":"Title","url":"url","fetched_url":"fetched"}]';
    const registerTool = vi.fn();
    const exec = vi.fn<ExtensionAPI["exec"]>().mockResolvedValue({
      stdout,
      stderr: "",
      code: 0,
      killed: false,
    });

    registerKetchSearchTool({ registerTool, exec });
    const tool = registerTool.mock.calls[0][0];
    const result = await tool.execute(
      "call-1",
      {
        query: " pi ",
        scrape: true,
        trim: false,
        maxChars: 50_001,
        searxngUrl: " https://search.example ",
        cookieFile: " cookies.txt ",
      },
      undefined,
      undefined,
      { cwd: "/tmp/project" },
    );

    expect(exec).toHaveBeenCalledWith(
      "ketch",
      [
        "search",
        " pi ",
        "--scrape",
        "--max-chars",
        "50000",
        "--searxng-url",
        "https://search.example",
        "--cookie-file",
        "cookies.txt",
        "--json",
      ],
      {
        cwd: "/tmp/project",
        signal: undefined,
        timeout: 45_000,
      },
    );
    expect(result.content).toEqual([{ type: "text", text: stdout }]);
  });

  it("preserves existing backend/multi validation", async () => {
    const registerTool = vi.fn();
    const exec = vi.fn<ExtensionAPI["exec"]>();
    registerKetchSearchTool({ registerTool, exec });
    const tool = registerTool.mock.calls[0][0];

    await expect(
      tool.execute(
        "call-1",
        { query: "pi", backend: "brave", multi: "ddg" },
        undefined,
        undefined,
        { cwd: "/tmp/project" },
      ),
    ).rejects.toThrow("backend and multi are mutually exclusive");
    expect(exec).not.toHaveBeenCalled();
  });
});
