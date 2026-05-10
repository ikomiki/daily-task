---
name: pnpm 11 allowBuilds 設定の罠
description: pnpm 11 系で esbuild や @swc/core などのネイティブバイナリ系パッケージの postinstall がブロックされ、`pnpm exec` も exit 1 になる
type: project
---

## What

`pnpm exec tsc ...` を実行すると `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: esbuild@0.27.7` で exit 1。
モジュールは導入済みなのに `pnpm exec` の事前 install チェックが失敗するため、
配下のコマンドが一切起動しない。LSP も `Cannot find module 'vitest/config'` と誤検知する。

## Why

pnpm 11+ はデフォルトで postinstall スクリプトをブロックする。
Task 3 で導入時に `onlyBuiltDependencies: [nx]` を指定したが、
- 後から増えた esbuild / @swc/core が未許可で再びブロックされる
- pnpm 11 の新書式は `allowBuilds: { name: true }` に変わっており、`onlyBuiltDependencies` は古い書式

両者が混在して挙動が不安定になっていた。

## Fix

`pnpm-workspace.yaml` に `allowBuilds` で **使うパッケージを明示的に true** にする:

```yaml
allowBuilds:
  '@swc/core': true
  esbuild: true
  nx: true
```

その後 `pnpm install` を再実行すると postinstall が走る。

## Prevention

- 新しいパッケージを追加するとき pnpm が `allowBuilds: <name>: set this to true or false` を書き込んできたら、
  使うものは即 `true` に書き換える（プレースホルダのまま放置しない）
- `pnpm exec` で `ERR_PNPM_IGNORED_BUILDS` が出たら、まず `pnpm-workspace.yaml` の `allowBuilds` を確認する
