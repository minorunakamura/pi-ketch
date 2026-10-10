import { describe, expect, it, vi } from "vitest";

import { registerTools } from "../../src/tools";
import { renderKetchResult } from "../../src/ui/tool-result";

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
    for (const [tool] of registerTool.mock.calls) {
      expect(tool.renderResult).toBe(renderKetchResult);
    }
  });

  it("collapses long JSON for all tools without changing their returned content", async () => {
    const stdout = JSON.stringify([
      { title: "Result", content: "Page content\n".repeat(1000) },
    ]);
    const registerTool = vi.fn();
    registerTools({
      registerTool,
      exec: vi
        .fn()
        .mockResolvedValue({ stdout, stderr: "", code: 0, killed: false }),
    });
    const theme = { fg: (_color: string, text: string) => text };

    await Promise.all(
      registerTool.mock.calls.map(async ([tool]) => {
        const result = await tool.execute(
          "call-1",
          { query: "pi", url: "https://example.com" },
          undefined,
          undefined,
          { cwd: "/tmp/project" },
        );
        expect(result.content).toEqual([{ type: "text", text: stdout }]);
        const original = structuredClone(result);
        const render = (
          expanded: boolean,
          isPartial = false,
          isError = false,
        ) =>
          tool.renderResult(result, { expanded, isPartial }, theme, {
            isError,
          });

        const collapsed = render(false).render(80);
        expect(collapsed.length).toBeLessThanOrEqual(2);
        expect(collapsed.join("\n")).toContain("完了");
        expect(collapsed.join("\n")).toContain("で展開");
        expect(collapsed.join("\n")).not.toContain("Page content");
        expect(render(true).render(stdout.length)[0]).toBe(stdout);
        expect(render(false, true).render(80).join("\n")).toContain("取得中…");
        const error = render(false, false, true);
        expect(error.render(80).join("\n")).toContain("エラー:");
        expect(error.render(80).length).toBeLessThanOrEqual(4);
        expect(render(true, false, true).render(stdout.length)[0]).toBe(stdout);
        expect(result).toEqual(original);
      }),
    );
  });
});
