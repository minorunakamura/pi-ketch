# Architecture

Pi adapter、package Public API、ketch CLI の実行処理を分離する。

## Overview

```text
Other Pi package
       │ import pi-ketch/search
       ▼
Package Public API (src/api/search.ts)
       │
       ▼
Search capability (src/runtime/search.ts)
       │
       ▼
Raw execution (src/runtime/execute-ketch.ts)
       │
       ▼
    ketch CLI

Pi Extension (src/index.ts)
       ├── commands/ ─────┐
       ├── tools/ ────────┼──> Search capability
       └── ui/ <──────────┘    (result presentation)
```

## Boundaries

- `src/index.ts` は Pi Extension entry point として維持し、package Public API entry と兼用しない。
- package consumer 向けの公開 entry は `package.json` の `exports` で定義する。今回の Public capability は `pi-ketch/search` と `pi-ketch/package.json` のみ。
- `src/api/search.ts` は typed request / response、validation、JSON parsing、`KetchExecutionError` を提供する。
- `src/runtime/search.ts` は Pi Tool と Public API が共有する Search の canonical CLI argument construction を担当する。
- `src/runtime/execute-ketch.ts` は `pi.exec("ketch", args, ...)` と full stdout / stderr / exit code の取得だけを担当する。generic raw executor と internal runtime module は package public export にしない。
- `src/runtime/run-ketch.ts` は既存の Pi Command / Tool adapter 用 wrapper として、exit code の既存扱い、output truncation、full-output temporary file、Tool details を維持する。
- `src/types.ts` は Extension 内で共有する既存の Command / Tool runtime 型を保持する。

## Search result presentation

```text
Search capability
       ├── Pi Tool
       │     └── raw JSON text + truncation + full-output temp file + details
       └── Package Public API
             └── full stdout + JSON validation + typed result + diagnostics
```

Public API は `fetched_url` を `fetchedUrl` に変換し、exit code 0 の stderr warning は `diagnostics` として返す。stderr があるだけでは失敗にしない。Public API は Tool 用の truncation や temporary file を行わない。

## Pi package loading

Pi Extension のロードは引き続き `package.json` の `pi.extensions` を使用する。

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

`exports` は package consumer の public/private boundary を定義し、Pi Extension のロード経路を置き換えない。
