# pi-ketch Package Public Execution API / Search Capability 実装仕様

- 対象リポジトリ: `minorunakamura/pi-ketch`
- 対象ブランチ基準: `main`
- 現状確認日: 2026-09-11
- 目的: 他の Pi package から `pi-ketch` の検索実行を安全に再利用できる Public API 基盤を追加し、最初の capability として Search を公開する

## 1. 概要

今回の変更では、既存の Pi Extension / Tool を置き換えない。

`pi-ketch` に package 向けの Public Execution API 境界を追加し、最初の capability として Search を `pi-ketch/search` subpath から公開する。

外部 package は ketch CLI の引数、JSON stdout、exit code、Pi Tool 用の output truncation などに直接依存せず、型付きの Search API を利用する。

既存の Pi Tool (`ketch_search`) は従来どおり利用可能とし、Tool 名、Tool parameter、Tool result の表示上の挙動、Extension entry、Researcher subagent の利用方法を互換範囲として維持する。

### 1.1 目標アーキテクチャ

```text
Other Pi package
    │
    │ import { executeSearch } from "pi-ketch/search"
    ▼
Package Public API
    │
    ▼
Search capability core
    │
    ▼
Raw ketch execution
    │
    ▼
ketch CLI


Pi Tool: ketch_search
    │
    ▼
Pi Tool adapter
    │
    ▼
Search capability core
    │
    ▼
Raw ketch execution
    │
    ▼
Tool output formatting / truncation
```

Public API と Pi Tool は Search の CLI 引数構築ルールを共有するが、出力の扱いは分離する。

- Public API: full stdout を JSON parse し、型付き result を返す。truncate しない。一時ファイルを作らない。
- Pi Tool: 現在の `runKetch()` 相当の bounded output / truncation / full-output temp file の挙動を維持する。

## 2. 現状コードベース

現行実装で今回の変更に直接関係する箇所は以下。

### `package.json`

- package name: `pi-ketch`
- Pi Extension entry: `pi.extensions = ["./src/index.ts"]`
- `exports` は未定義
- `@earendil-works/pi-coding-agent` と `typebox` は `peerDependencies`
- TypeScript source をそのまま Pi package として配布する構成

### `src/index.ts`

- default export の Pi Extension factory
- `registerCommands(pi)` と `registerTools(pi)` を登録
- package consumer 向け API は持たない

### `src/runtime/run-ketch.ts`

現在は以下の責務を1ファイルで持つ。

- ketch CLI argument helper
- `pi.exec("ketch", args, ...)`
- timeout / AbortSignal
- missing executable の検知
- exit code 分類
- error message 生成
- stdout の truncate
- truncate 時の full output 一時ファイル保存
- Tool details 生成

Public API では JSON parse 前の stdout を truncate してはいけないため、この責務分離が必要。

### `src/tools/search.ts`

現在の `ketch_search` は以下を行う。

- Tool schema 定義
- `backend` と `multi` の排他チェック
- query blank チェック
- `limit` / `maxChars` の clamp
- `scrape=true` 時の `trim=true` default
- `scrape=true` 時の `maxChars=6000` default
- Search 用 flags 構築
- `buildKetchArgs("search", ...)`
- `runKetch()`
- `run.stdout` を Tool content として返却

この Search CLI argument 構築ルールは Public API と共有可能な internal capability core に移す。

### upstream ketch

現行 upstream の `ketch search --json` は JSON array を stdout に出力する。

各 result の既知フィールド:

```json
{
  "title": "string",
  "url": "string",
  "fetched_url": "string (optional)",
  "description": "string (optional)",
  "content": "string (optional)",
  "backends": ["string"] 
}
```

`--scrape` 中の一部 scrape failure や `--multi` の partial backend failure は stderr に warning を出しつつ、成功 result を stdout に返して exit 0 となる場合がある。

そのため Public API は `stderr !== ""` を失敗条件にしてはいけない。

## 3. Scope

今回実装するもの:

1. package Public API 用の明示的な source boundary
2. `pi-ketch/search` subpath export
3. raw ketch execution 層
4. Search CLI argument 構築の共通 internal core
5. `executeSearch()` Public API
6. typed request / response
7. structured execution error
8. ketch JSON result parser
9. 既存 `ketch_search` の互換維持
10. package export / Public API regression tests
11. `docs/architecture.md` の更新
12. README の Public API 利用方法の最小追記

## 4. Non-goals

今回実装しない。

- generic な `executeKetch(command, args)` の package public export
- raw CLI argument escape hatch
- `pi-ketch/docs` Public API
- `pi-ketch/code` Public API
- `pi-ketch/scrape` Public API
- Search の `random` mode
- ketch config の読み書き API
- backend 自動選択ロジックの追加
- backend fallback / retry ロジックの追加
- Search backend 名の closed union 化
- ketch CLI 自体の変更
- 既存 Pi Tool / Command / Researcher agent の仕様変更

## 5. Public package entry

Search capability の正式な import path は次とする。

```ts
import {
  executeSearch,
  KetchExecutionError,
  type SearchExecutionOptions,
  type SearchProvider,
  type SearchRequest,
  type SearchResponse,
  type SearchResult,
  type SearchScrapeOptions,
} from "pi-ketch/search";
```

package root (`pi-ketch`) に Search API を re-export しない。

`src/index.ts` は Pi Extension entry のままとし、Public API entry と兼用しない。

### `package.json`

`exports` に少なくとも以下を追加する。

```json
{
  "exports": {
    "./search": "./src/api/search.ts",
    "./package.json": "./package.json"
  }
}
```

`pi.extensions` の `./src/index.ts` は変更しない。

`./extension` subpath は今回追加しない。

`./package.json` は `exports` 導入前に可能だった package metadata 参照を不要に壊さないため公開してよい。

## 6. Public Search API

### 6.1 Signature

```ts
export async function executeSearch(
  pi: Pick<ExtensionAPI, "exec">,
  request: SearchRequest,
  options: SearchExecutionOptions,
): Promise<SearchResponse>;
```

Public API v1 は Pi package 間での再利用を対象とするため、独自 Executor abstraction は導入せず `Pick<ExtensionAPI, "exec">` を受け取る。

Pi API 全体には依存しない。

### 6.2 Request types

```ts
export interface SearchRequest {
  query: string;
  limit?: number;
  provider?: SearchProvider;
  scrape?: boolean | SearchScrapeOptions;
  searxngUrl?: string;
}

export type SearchProvider =
  | {
      mode: "configured";
    }
  | {
      mode: "single";
      backend: string;
    }
  | {
      mode: "multi";
      backends: "all" | readonly string[];
    };

export interface SearchScrapeOptions {
  trim?: boolean;
  maxChars?: number;
  cookieFile?: string;
}

export interface SearchExecutionOptions {
  cwd: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}
```

`provider` 未指定は `{ mode: "configured" }` と同義。

### 6.3 Request semantics

#### `query`

- trim 後が空なら Public API validation error
- CLI に渡す query は trim 済み値を使用する

#### `limit`

- 未指定なら `--limit` を付けず ketch config/default に委譲
- 指定時は integer かつ `1..20`
- Public API では clamp せず invalid input を error にする

#### `provider.mode = "configured"`

- `--backend` を付けない
- `--multi` を付けない
- ketch の configured/default backend を使用

#### `provider.mode = "single"`

- `backend` は trim 後 non-empty
- `--backend <backend>` を使用
- backend 名は `string` とし、pi-ketch 側で closed union にしない
- backend の存在確認は ketch に委譲

#### `provider.mode = "multi"`

- `backends: "all"` は `--multi=all`
- array の場合は1件以上
- 各 backend は trim 後 non-empty
- array 内の `"all"` は禁止し、全 backend 指定は `"all"` sentinel を使用
- 重複 backend は先頭を残して除去してよい
- CLI は必ず `--multi=a,b` の `=` 形式を使用

#### `searxngUrl`

- optional
- 指定時は trim 後 non-empty
- `--searxng-url <value>`
- URL format の追加 validation は今回行わず ketch に委譲する

#### `scrape`

`undefined` / `false`:

- `--scrape` を付けない
- `--trim`, `--max-chars`, `--cookie-file` を付けない

`true`:

- scrape enabled
- `trim = true`
- `maxChars = 6000`

object:

- scrape enabled
- `trim = true` unless explicitly `false`
- `maxChars = 6000` unless specified
- `cookieFile` optional

`maxChars` 指定値は integer かつ `1000..50000`。

`cookieFile` は指定時 trim 後 non-empty。

### 6.4 Execution defaults

- Public Search default timeout: `45_000 ms`
- `timeoutMs` 指定時は正の有限 integer
- `cwd` は caller が明示する
- `signal` は caller の AbortSignal をそのまま `pi.exec` に渡す

### 6.5 CLI contract

Public API は必ず JSON output を要求する。

例:

```text
ketch search <query> [search flags...] --json
```

Public API から shell command string は生成しない。

必ず:

```ts
pi.exec("ketch", args, ...)
```

の argv 形式を使用する。

## 7. Public response

### 7.1 Types

```ts
export interface SearchResult {
  title: string;
  url: string;
  fetchedUrl?: string;
  description?: string;
  content?: string;
  backends?: readonly string[];
}

export interface SearchResponse {
  results: readonly SearchResult[];
  diagnostics?: string;
}
```

Public TypeScript API は camelCase とし、upstream JSON の `fetched_url` は `fetchedUrl` に変換する。

### 7.2 JSON parsing

正常終了時の stdout を JSON parse する。

validation rule:

- top-level は array 必須
- 各 element は object 必須
- `title` は string 必須
- `url` は string 必須
- `fetched_url`, `description`, `content` は存在する場合 string
- `backends` は存在する場合 string array
- unknown field は許容し無視する

unknown field を理由に失敗させない。

これにより upstream ketch が additive field を追加した場合の forward compatibility を確保する。

既知 field の型不正、malformed JSON、top-level shape 不正は `invalid_output` error とする。

result の順序は upstream JSON の順序を維持する。

### 7.3 stderr / diagnostics

exit code 0 で stderr が non-empty の場合:

- execution は成功扱い
- stdout の result を返す
- stderr を `diagnostics` として返す
- warning の存在だけで throw しない

`diagnostics` は空白だけなら `undefined`。

## 8. Structured error

Public API は caller に error message の文字列解析を要求しない。

共通 error class を用意する。

```ts
export type KetchExecutionErrorCode =
  | "validation"
  | "not_found"
  | "upstream"
  | "precondition"
  | "cancelled"
  | "execution"
  | "invalid_output";

export class KetchExecutionError extends Error {
  readonly code: KetchExecutionErrorCode;
  readonly exitCode?: number;
  readonly diagnostics?: string;
}
```

必要なら constructor で `cause` を保持する。

### 8.1 Exit code mapping

現行 `classifyKetchExit()` の意味を Public API の stable code に変換する。

| ketch exit code | Public error code |
|---:|---|
| 2 | `validation` |
| 3 | `not_found` |
| 4 | `upstream` |
| 5 | `precondition` |
| 6 | `cancelled` |
| other non-zero | `execution` |

### 8.2 Process-level failure

- call 前に `signal.aborted`: `cancelled`
- call 中に AbortSignal による abort が確認できる場合: `cancelled`
- ketch executable missing / ENOENT 相当: `precondition`
- その他の `pi.exec` throw: `execution`
- JSON parse / schema failure: `invalid_output`

Public error `message` に query や全 CLI args を埋め込まない。

非 zero exit の stderr/stdout が diagnostic として有用な場合は `diagnostics` に保持できるが、caller が structured `code` で分岐できることを必須とする。

## 9. Internal execution foundation

### 9.1 `src/runtime/execute-ketch.ts`

新設する。

責務:

- `pi.exec("ketch", args, ...)` の raw execution
- `cwd`, `signal`, `timeout`
- pre-abort
- spawn / executable missing の識別に必要な internal error
- stdout / stderr / exit code の full value を返す

禁止:

- output truncation
- temp file write
- Tool details
- Search JSON parse
- Search-specific validation
- user-visible command line formatting

概念的な raw result:

```ts
interface KetchExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

これは internal type とし、package `exports` から公開しない。

### 9.2 `src/runtime/run-ketch.ts`

既存 Pi Tool / Command 用 wrapper として残す。

変更後:

1. raw subprocess execution は `execute-ketch.ts` を利用
2. 既存の allowed exit code 判定を維持
3. 既存の user-facing error text を可能な限り維持
4. 既存の truncate / temp file 保存を維持
5. `detailsFor()` を維持

以下の既存 helper は internal のままでよい。

- `buildKetchArgs`
- `clampInteger`
- `nonEmpty`
- `classifyKetchExit`
- `commandLine`
- `detailsFor`

これらを package public export しない。

### 9.3 `src/runtime/search.ts`

新設する。

Search CLI argument 構築の canonical internal implementation とする。

少なくとも以下を1箇所に集約する。

- query positional
- limit
- backend
- multi
- scrape
- trim
- max-chars
- searxng-url
- cookie-file
- `--json`

Public API と `ketch_search` Tool が同じ builder を利用する。

internal input は public request type と同一である必要はない。

Tool adapter が現在の flat parameters を既存 semantics のまま internal search command input に変換でき、Public API は validated Public request を同じ internal input に変換できればよい。

`random`, `minimal`, `user-agent` は今回の internal Public Search path に追加しない。

## 10. `ketch_search` Tool compatibility

`src/tools/search.ts` の externally observable contract は維持する。

維持対象:

- Tool name: `ketch_search`
- label / description / prompt guidance の既存意味
- parameter names
- `backend` と `multi` の既存 flat parameters
- query blank validation
- `limit` の既存 clamp behavior
- `maxChars` の既存 clamp behavior
- scrape 時 `trim=true` default
- scrape 時 `maxChars=6000` default
- current timeout `45_000`
- Tool content は JSON text
- Tool output truncation / full output path
- `detailsFor(run)` の details shape

Public API が strict validation を採用しても、既存 Tool の clamp behavior を変更してはならない。

したがって Tool は Public API の request validation をそのまま通す必要はない。

Tool と Public API は internal Search CLI builder / raw execution foundation を共有し、それぞれの adapter semantics を維持する。

### 10.1 重要: Tool は Public response を再 serialize しない

Public API は `fetched_url` を `fetchedUrl` に normalize するため、Tool が `SearchResponse.results` を `JSON.stringify()` して返すと既存 ketch JSON shape が変わる。

したがって Tool result は従来どおり raw ketch JSON stdout を基準とする。

これにより Pi Tool の JSON field 名を変更しない。

## 11. Source layout

推奨する今回の最小構成:

```text
src/
├── api/
│   ├── execution-error.ts
│   └── search.ts
├── commands/
├── runtime/
│   ├── execute-ketch.ts
│   ├── run-ketch.ts
│   └── search.ts
├── tools/
│   ├── search.ts
│   └── ...
├── ui/
├── index.ts
├── researcher-tools.ts
└── types.ts
```

### Public boundary

package consumer が import してよいのは `package.json` の `exports` で明示した entry のみ。

今回:

```text
pi-ketch/search
pi-ketch/package.json
```

以下の deep import は Public API ではない。

```text
pi-ketch/src/runtime/run-ketch
pi-ketch/src/runtime/execute-ketch
pi-ketch/src/runtime/search
pi-ketch/src/tools/search
pi-ketch/src/api/execution-error
```

## 12. File-by-file implementation requirements

### `package.json`

変更:

- `exports` 追加
- `pi.extensions` は維持
- peer dependency 構成は今回変更しない
- scripts は既存 `pnpm check` を維持

version bump はこの実装タスクには含めない。release 時に別途判断する。

### `src/api/execution-error.ts`

新設:

- `KetchExecutionErrorCode`
- `KetchExecutionError`
- public error contract の implementation

直接の package subpath は追加しない。

`src/api/search.ts` から必要な error symbol を re-export する。

### `src/api/search.ts`

新設:

- Public types
- `executeSearch()`
- public request validation / normalization
- raw result JSON parse
- response mapping
- public error mapping
- `KetchExecutionError` / type の re-export

このファイルを `pi-ketch/search` の entry とする。

### `src/runtime/execute-ketch.ts`

新設:

- raw `pi.exec`
- full stdout/stderr
- execution result
- internal process error classification に必要な最小 implementation

Public API と Tool presentation のどちらにも依存しない。

### `src/runtime/search.ts`

新設:

- canonical Search argument builder
- internal normalized Search command input
- `buildKetchArgs()` を利用して最終 argv を作成してよい

### `src/runtime/run-ketch.ts`

変更:

- raw process call を `execute-ketch.ts` へ委譲
- Tool-oriented output handling はここに残す
- existing exports / current tests を不要に壊さない
- output truncate behavior を変更しない

### `src/tools/search.ts`

変更:

- Search flags の直接組み立てを `src/runtime/search.ts` の canonical builder に寄せる
- Tool schema と Tool adapter semantics は維持
- Public API の camelCase response を Tool output に使用しない

### `src/types.ts`

必要な internal raw execution type を置く場合のみ最小変更する。

Public Search types はここに置かず `src/api/search.ts` 側に置く。

### `docs/architecture.md`

Public API boundary、raw execution と Tool presentation の分離、Search capability を追記する。

別添の `pi-ketch-architecture-proposed.md` を反映候補として使用できる。

### `README.md`

最小限追記:

- `pi-ketch/search` が package Public API であること
- import の短い例
- consumer Pi package は `pi-ketch` を runtime dependency として解決する必要があること
- Pi Extension / Researcher の既存説明は維持

README を詳細 API reference にしない。

## 13. Tests

新規・更新テストは少なくとも以下をカバーする。

### Public API

- package self-reference で `pi-ketch/search` を import できる
- import だけで Tool / Command registration side effect が発生しない
- configured provider は backend/multi flag を追加しない
- single provider は `--backend`
- multi all は `--multi=all`
- multi list は `--multi=a,b`
- multi list の blank backend を reject
- multi array の `"all"` を reject
- blank query を reject
- invalid limit (`0`, `21`, non-integer) を reject
- scrape default が `trim=true`, `maxChars=6000`
- scrape false で scrape-only flags を出さない
- invalid maxChars を reject
- custom timeout が `pi.exec` に渡る
- default timeout が `45_000`
- AbortSignal を渡す
- pre-aborted signal は `cancelled`
- exit codes `2..6` の mapping
- unknown non-zero exit -> `execution`
- missing executable -> `precondition`
- malformed JSON -> `invalid_output`
- non-array JSON -> `invalid_output`
- required result field type mismatch -> `invalid_output`
- optional field type mismatch -> `invalid_output`
- unknown JSON field は許容
- `fetched_url` -> `fetchedUrl`
- `backends` を保持
- exit 0 + stderr warning は成功し `diagnostics` に保持
- large valid JSON を truncate せず parse できる
- Public execution で temp file を作らない

### Existing Tool regression

- `registerTools()` の tool list が不変
- `researcherTools()` の tool list が不変
- `runKetch()` の既存 execution test
- `buildKetchArgs()` の `--multi=` syntax
- `ketch_search` の既存 parameter semantics
- Tool output は upstream raw JSON field (`fetched_url`) のまま
- Tool truncate behavior が維持される

### Package boundary

- `pi-ketch/search` が公開される
- public Search entry が `src/index.ts` を import しない
- public Search entry が Tool registration module を import しない
- internal runtime module を package public export に追加しない

## 14. Acceptance criteria

以下を全て満たして完了。

1. 他の package から `import { executeSearch } from "pi-ketch/search"` が解決できる。
2. Public API import に Pi Tool / Command registration side effect がない。
3. `executeSearch()` は ketch CLI を `pi.exec` の argv 形式で実行する。
4. Public API は full JSON stdout を typed result に変換し、Tool 用 truncate を受けない。
5. exit 0 + stderr warning を成功として扱える。
6. Public caller は `KetchExecutionError.code` で error classification できる。
7. raw ketch executor / arbitrary CLI args は package public API として公開されない。
8. existing `ketch_search`, `ketch_scrape`, `ketch_code`, `ketch_docs` の登録が維持される。
9. existing `src/index.ts` Extension entry が維持される。
10. Researcher subagent の `../src/researcher-tools.ts` 利用を壊さない。
11. `docs/architecture.md` と README が新しい境界を説明する。
12. `pnpm check` が成功する。

## 15. Consumer package 側の利用条件

Pi の package loader は package ごとに module root を分離する。

別 Pi package から `pi-ketch/search` を import する package は、`pi-ketch` が別途 Pi にインストールされていることだけに依存してはいけない。

配布する consumer package は Pi package documentation に従い、`pi-ketch` を runtime dependency として package 内から解決可能にする。

npm tarball で別 Pi package を依存させる場合の基本方針:

```json
{
  "dependencies": {
    "pi-ketch": "<compatible-version>"
  },
  "bundledDependencies": [
    "pi-ketch"
  ]
}
```

具体的な version / source は consumer repository の release 方針に従う。

`@earendil-works/pi-coding-agent` は Pi が提供する core package なので、既存方針どおり peer dependency として扱う。

## 16. Architecture document への反映方針

`docs/architecture.md` では、現在の

```text
commands/ tools/ ui/
          │
          ▼
      runtime/
          │
          ▼
       ketch CLI
```

だけの図から、Pi adapter と Package Public API の2つの入口を明示する。

最低限、以下を architecture decision として残す。

- Pi Extension entry と package Public API entry を分離する
- Public API は capability-oriented subpath とする
- raw generic executor は internal
- Search が最初の Public capability
- Tool と Public API は Search CLI construction を共有する
- Tool output presentation と Public structured response は分離する
- Public API は full stdout を parse し、truncate/temp-file presentation を行わない
- package `exports` が public/private boundary を定義する

## 17. 参照資料

現行 pi-ketch:

- Repository: https://github.com/minorunakamura/pi-ketch
- `package.json`: https://github.com/minorunakamura/pi-ketch/blob/main/package.json
- `docs/architecture.md`: https://github.com/minorunakamura/pi-ketch/blob/main/docs/architecture.md
- `src/index.ts`: https://github.com/minorunakamura/pi-ketch/blob/main/src/index.ts
- `src/runtime/run-ketch.ts`: https://github.com/minorunakamura/pi-ketch/blob/main/src/runtime/run-ketch.ts
- `src/tools/search.ts`: https://github.com/minorunakamura/pi-ketch/blob/main/src/tools/search.ts
- `src/types.ts`: https://github.com/minorunakamura/pi-ketch/blob/main/src/types.ts
- `src/researcher-tools.ts`: https://github.com/minorunakamura/pi-ketch/blob/main/src/researcher-tools.ts
- `agents/researcher.md`: https://github.com/minorunakamura/pi-ketch/blob/main/agents/researcher.md

Pi:

- Packages: https://pi.dev/docs/latest/packages
- Extensions: https://pi.dev/docs/latest/extensions

upstream ketch:

- Search command: https://github.com/1broseidon/ketch/blob/main/cmd/search.go
- Search result model: https://github.com/1broseidon/ketch/blob/main/search/search.go
