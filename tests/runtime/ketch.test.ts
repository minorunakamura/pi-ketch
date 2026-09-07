import { describe, expect, it } from "vitest";

import {
  buildKetchArgs,
  clampInteger,
  classifyKetchExit,
  commandLine,
  nonEmpty,
} from "../../src/runtime/run-ketch";

describe("ketch core helpers", () => {
  it("builds CLI arguments and preserves ketch's multi syntax", () => {
    expect(
      buildKetchArgs("search", ["pi extension"], {
        limit: 5,
        multi: "brave,ddg",
        scrape: false,
      }),
    ).toEqual([
      "search",
      "pi extension",
      "--limit",
      "5",
      "--multi=brave,ddg",
      "--json",
    ]);
  });

  it("normalizes values and classifies failures", () => {
    expect(clampInteger(20.8, 1, 20)).toBe(20);
    expect(clampInteger(-1, 1, 20)).toBe(1);
    expect(nonEmpty("  query ")).toBe("query");
    expect(nonEmpty("  ")).toBeUndefined();
    expect(classifyKetchExit(5)).toBe(
      "[precondition] missing configuration or dependency",
    );
    expect(commandLine(["search", "pi extension"])).toBe(
      'ketch search "pi extension"',
    );
  });
});
