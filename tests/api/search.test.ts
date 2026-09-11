import { describe, expect, it, vi } from "vitest";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  executeSearch,
  KetchExecutionError,
  type SearchRequest,
} from "pi-ketch/search";

type MockPi = { exec: ReturnType<typeof vi.fn<ExtensionAPI["exec"]>> };

function mockPi(stdout = "[]", stderr = "", code = 0): MockPi {
  return {
    exec: vi.fn<ExtensionAPI["exec"]>().mockResolvedValue({
      stdout,
      stderr,
      code,
      killed: false,
    }),
  };
}

function invalidRequest(value: unknown): SearchRequest {
  // Deliberately bypass the static contract to exercise runtime validation.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as SearchRequest;
}

function executionOptions(signal?: AbortSignal) {
  return { cwd: "/tmp/project", signal };
}

describe("pi-ketch/search public API", () => {
  it("is importable without registering Pi tools or commands", () => {
    expect(executeSearch).toBeTypeOf("function");
    expect(KetchExecutionError).toBeTypeOf("function");
  });

  it("uses the configured provider by default and trims the query", async () => {
    const pi = mockPi();

    await executeSearch(pi, { query: "  pi extensions  " }, executionOptions());

    expect(pi.exec).toHaveBeenCalledWith(
      "ketch",
      ["search", "pi extensions", "--json"],
      {
        cwd: "/tmp/project",
        signal: undefined,
        timeout: 45_000,
      },
    );
  });

  it("builds single and multi provider arguments", async () => {
    const single = mockPi();
    await executeSearch(
      single,
      { query: "pi", provider: { mode: "single", backend: " brave " } },
      executionOptions(),
    );
    expect(single.exec.mock.calls[0][1]).toEqual([
      "search",
      "pi",
      "--backend",
      "brave",
      "--json",
    ]);

    const all = mockPi();
    await executeSearch(
      all,
      { query: "pi", provider: { mode: "multi", backends: "all" } },
      executionOptions(),
    );
    expect(all.exec.mock.calls[0][1]).toEqual([
      "search",
      "pi",
      "--multi=all",
      "--json",
    ]);

    const list = mockPi();
    await executeSearch(
      list,
      {
        query: "pi",
        provider: {
          mode: "multi",
          backends: ["brave", " ddg ", "brave"],
        },
      },
      executionOptions(),
    );
    expect(list.exec.mock.calls[0][1]).toEqual([
      "search",
      "pi",
      "--multi=brave,ddg",
      "--json",
    ]);
  });

  it("rejects invalid provider, query, and limit input", async () => {
    const requests = [
      { query: "   " },
      { query: "pi", limit: 0 },
      { query: "pi", limit: 21 },
      { query: "pi", limit: 1.5 },
      {
        query: "pi",
        provider: { mode: "multi" as const, backends: [] },
      },
      {
        query: "pi",
        provider: { mode: "multi" as const, backends: [" brave", " "] },
      },
      {
        query: "pi",
        provider: { mode: "multi" as const, backends: ["all"] },
      },
    ];

    await Promise.all(
      requests.map(async (request) => {
        const pi = mockPi();
        await expect(
          executeSearch(pi, request, executionOptions()),
        ).rejects.toMatchObject({
          code: "validation",
        });
        expect(pi.exec).not.toHaveBeenCalled();
      }),
    );
  });

  it("applies scrape defaults and omits scrape flags when disabled", async () => {
    const enabled = mockPi();
    await executeSearch(
      enabled,
      { query: "pi", scrape: true },
      executionOptions(),
    );
    expect(enabled.exec.mock.calls[0][1]).toEqual([
      "search",
      "pi",
      "--scrape",
      "--trim",
      "--max-chars",
      "6000",
      "--json",
    ]);

    const disabled = mockPi();
    await executeSearch(
      disabled,
      {
        query: "pi",
        scrape: {
          trim: false,
          maxChars: 1_000,
          cookieFile: " cookies.txt ",
        },
        searxngUrl: " https://search.example ",
      },
      executionOptions(),
    );
    expect(disabled.exec.mock.calls[0][1]).toEqual([
      "search",
      "pi",
      "--scrape",
      "--max-chars",
      "1000",
      "--searxng-url",
      "https://search.example",
      "--cookie-file",
      "cookies.txt",
      "--json",
    ]);

    const noScrape = mockPi();
    await executeSearch(
      noScrape,
      { query: "pi", scrape: false },
      executionOptions(),
    );
    expect(noScrape.exec.mock.calls[0][1]).toEqual(["search", "pi", "--json"]);
  });

  it("rejects invalid scrape options and timeout", async () => {
    const requests = [
      { query: "pi", scrape: { maxChars: 999 } },
      { query: "pi", scrape: { maxChars: 50_001 } },
      { query: "pi", scrape: { maxChars: 1.5 } },
      invalidRequest({ query: "pi", scrape: { trim: "yes" } }),
      { query: "pi", scrape: { cookieFile: "  " } },
    ];

    await Promise.all(
      requests.map((request) =>
        expect(
          executeSearch(mockPi(), request, executionOptions()),
        ).rejects.toMatchObject({ code: "validation" }),
      ),
    );

    await expect(
      executeSearch(
        mockPi(),
        { query: "pi" },
        {
          cwd: "/tmp/project",
          timeoutMs: 0,
        },
      ),
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("passes a custom timeout and the original AbortSignal", async () => {
    const pi = mockPi();
    const controller = new AbortController();

    await executeSearch(
      pi,
      { query: "pi" },
      { cwd: "/tmp/project", signal: controller.signal, timeoutMs: 12_345 },
    );

    expect(pi.exec.mock.calls[0][2]).toEqual({
      cwd: "/tmp/project",
      signal: controller.signal,
      timeout: 12_345,
    });
  });

  it("maps exit codes and process failures to structured errors", async () => {
    const exitCodes = [
      [2, "validation"],
      [3, "not_found"],
      [4, "upstream"],
      [5, "precondition"],
      [6, "cancelled"],
      [1, "execution"],
    ] as const;

    await Promise.all(
      exitCodes.map(([exitCode, code]) =>
        expect(
          executeSearch(
            mockPi("", `stderr-${exitCode}`, exitCode),
            { query: "pi" },
            executionOptions(),
          ),
        ).rejects.toMatchObject({ code, exitCode }),
      ),
    );

    const missing = mockPi();
    missing.exec.mockRejectedValue(
      Object.assign(new Error("spawn ketch ENOENT"), { code: "ENOENT" }),
    );
    await expect(
      executeSearch(missing, { query: "pi" }, executionOptions()),
    ).rejects.toMatchObject({ code: "precondition" });

    const failed = mockPi();
    failed.exec.mockRejectedValue(new Error("process failed"));
    await expect(
      executeSearch(failed, { query: "pi" }, executionOptions()),
    ).rejects.toMatchObject({ code: "execution" });
  });

  it("maps pre-aborted and in-flight aborts to cancelled", async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    const preAbortedPi = mockPi();
    await expect(
      executeSearch(
        preAbortedPi,
        { query: "pi" },
        executionOptions(preAborted.signal),
      ),
    ).rejects.toMatchObject({ code: "cancelled" });
    expect(preAbortedPi.exec).not.toHaveBeenCalled();

    const controller = new AbortController();
    const inFlight = mockPi();
    inFlight.exec.mockImplementation(async () => {
      controller.abort();
      throw new Error("terminated");
    });
    await expect(
      executeSearch(
        inFlight,
        { query: "pi" },
        executionOptions(controller.signal),
      ),
    ).rejects.toMatchObject({ code: "cancelled" });
  });

  it("parses and normalizes search results while allowing unknown fields", async () => {
    const pi = mockPi(
      JSON.stringify([
        {
          title: "Title",
          url: "https://example.com",
          fetched_url: "https://www.example.com",
          description: "Description",
          content: "Content",
          backends: ["brave", "ddg"],
          new_field: { additive: true },
        },
      ]),
    );

    await expect(
      executeSearch(pi, { query: "pi" }, executionOptions()),
    ).resolves.toEqual({
      results: [
        {
          title: "Title",
          url: "https://example.com",
          fetchedUrl: "https://www.example.com",
          description: "Description",
          content: "Content",
          backends: ["brave", "ddg"],
        },
      ],
    });
  });

  it("rejects malformed JSON, invalid shapes, and invalid field types", async () => {
    const outputs = [
      "not json",
      "{}",
      JSON.stringify([null]),
      JSON.stringify([{ title: "Title" }]),
      JSON.stringify([{ title: "Title", url: "url", content: null }]),
      JSON.stringify([{ title: "Title", url: "url", backends: ["brave", 1] }]),
    ];

    await Promise.all(
      outputs.map((stdout) =>
        expect(
          executeSearch(mockPi(stdout), { query: "pi" }, executionOptions()),
        ).rejects.toMatchObject({
          code: "invalid_output",
        }),
      ),
    );
  });

  it("returns stderr diagnostics only for non-blank warnings", async () => {
    await expect(
      executeSearch(
        mockPi("[]", "  warn: partial backend failure\n"),
        { query: "pi" },
        executionOptions(),
      ),
    ).resolves.toEqual({
      results: [],
      diagnostics: "  warn: partial backend failure\n",
    });

    await expect(
      executeSearch(mockPi("[]", " \n\t"), { query: "pi" }, executionOptions()),
    ).resolves.toEqual({ results: [] });
  });

  it("parses large valid stdout without Tool truncation", async () => {
    const content = "x".repeat(120_000);
    const pi = mockPi(
      JSON.stringify([{ title: "Large", url: "url", content }]),
    );

    const response = await executeSearch(
      pi,
      { query: "large" },
      executionOptions(),
    );

    expect(response.results[0]?.content).toBe(content);
  });
});
