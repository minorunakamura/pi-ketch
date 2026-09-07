# Architecture

Pi の adapter と ketch CLI の実行処理を最小構成で分離する。

```text
commands/ tools/ ui/
              │
              ▼
          runtime/
              │
              ▼
           ketch CLI
```

- `commands/`, `tools/`, `ui/`: Pi API との接点
- `runtime/run-ketch.ts`: CLI 引数構築、実行、出力・エラー処理
- `types.ts`: Extension 全体で共有する型
