import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { keyText } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export const renderKetchResult: NonNullable<ToolDefinition["renderResult"]> = (
  result,
  { expanded, isPartial },
  theme,
  context,
) => {
  if (isPartial) return new Text(theme.fg("muted", "取得中…"), 0, 0);

  const output = result.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  if (expanded) return new Text(theme.fg("toolOutput", output), 0, 0);

  const summary = context.isError
    ? `エラー: ${output.replace(/\s+/g, " ").slice(0, 160)}`
    : `完了 · ${output.length.toLocaleString()}文字`;
  return new Text(
    theme.fg(
      context.isError ? "error" : "muted",
      `${summary}（${keyText("app.tools.expand")} で展開）`,
    ),
    0,
    0,
  );
};
