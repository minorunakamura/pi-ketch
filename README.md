# pi-ketch

[ketch](https://github.com/1broseidon/ketch) CLI を Pi Extension の tools と commands として提供します。

## 開発

```bash
pnpm install
pnpm test
pnpm check
```

ketch CLI が必要です。

## Pi で読み込む

```bash
pi -e ./src/index.ts
```

Pi package としてインストールする場合は、`package.json` の `pi.extensions` が `src/index.ts` を Extension entry point として使用します。

## Subagent

`pi-subagents` を利用している場合、Pi package から
`pi-ketch.researcher` Agent も利用できます。

```text
subagent({
  agent: "pi-ketch.researcher",
  task: "Research ..."
})
