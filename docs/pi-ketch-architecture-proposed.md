# Architecture

Pi adapter、package Public API、ketch CLI の実行処理を分離する。

## Overview

```text
                         ┌──────────────────────┐
                         │ Other Pi package     │
                         └──────────┬───────────┘
                                    │
                                    │ pi-ketch/search
                                    ▼
                         ┌──────────────────────┐
                         │ Package Public API   │
                         │ src/api/             │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌──────────────────────┐  ┌──────────────────────┐
│ commands/ tools/ ui/ │─▶│ capability runtime   │
│ Pi adapters          │  │ src/runtime/search.ts│
└──────────────────────┘  └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ raw ketch execution  │
                          │ execute-ketch.ts     │
                          └──────────┬───────────┘
                                     │
                                     ▼
                                  ketch CLI
```

## Boundaries

### Pi adapters

- `src/index.ts`: Pi Extension entry point
- `commands/`, `tools/`, `ui/`: Pi API との接点
- `src/researcher-tools.ts`: Researcher subagent 用 Tool registration entry
- Pi Tool / Command 用の表示、truncate、details は package Public API の責務に含めない

### Package Public API

- package consumer 向け API は `package.json` の `exports` で明示する
- Public API は capability-oriented subpath とする
- 最初の Public capability は `pi-ketch/search`
- `src/index.ts` を package Public API entry と兼用しない
- generic な raw ketch executor は公開しない
- internal module への deep import を Public contract にしない

### Search capability

`src/runtime/search.ts` は Search の canonical CLI argument construction を担当する。

Pi Tool と package Public API は同じ Search command construction を共有する。

ただし result presentation は分離する。

```text
Search capability
      │
      ├── Pi Tool
      │     └── raw JSON text
      │          + truncate
      │          + full-output temp file
      │          + Tool details
      │
      └── Package Public API
            └── full stdout
                 + JSON validation
                 + typed result
                 + structured error
                 + diagnostics
```

### Raw execution

`src/runtime/execute-ketch.ts` は `pi.exec("ketch", args, ...)` の raw subprocess execution のみを担当する。

raw execution 層では以下を行わない。

- output truncation
- temporary output file
- Tool details
- Search result JSON parsing
- capability-specific presentation

### Tool-oriented runtime

`src/runtime/run-ketch.ts` は既存 Pi Tool / Command 向け wrapper として残す。

- exit code の既存扱い
- user-facing error formatting
- output truncation
- truncate 時の full output temporary file
- `detailsFor()`

を維持する。

## Public Search API

正式な import path:

```ts
import { executeSearch } from "pi-ketch/search";
```

Public Search API は ketch CLI の raw arguments や stdout string を package contract としない。

caller は typed request を渡し、typed search results を受け取る。

`stderr` warning が存在しても exit code 0 なら成功 result を返し、warning は diagnostics として保持する。

Public API は full JSON stdout を parse するため、Pi Tool 用の output truncation を通さない。

## Package loading

Pi Extension のロードは引き続き `package.json` の以下を使用する。

```json
{
  "pi": {
    "extensions": [
      "./src/index.ts"
    ]
  }
}
```

package `exports` は package consumer 向け import boundary であり、Pi Extension entry を置き換えない。
