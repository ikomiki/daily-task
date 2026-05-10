---
name: 各パッケージは tsconfig.json + tsconfig.lib.json の2層構成
description: LSP用とビルド用でtsconfigを分け、composite/emit設定を分離する
type: project
---

## ルール

各 `packages/<name>/` と `apps/<name>/` には次の2つのtsconfigを置く:

- `tsconfig.json`: LSP/IDE用。`@org/config-tsconfig/base.json` を extends。
  `noEmit: true`、`include` にテストとconfigファイルを含める。compositeなし。
- `tsconfig.lib.json` (libの場合) / `tsconfig.app.json` (appの場合): ビルド用。
  `@org/config-tsconfig/lib.json` または `app.json` を extends。
  `composite: true`、テストファイルを `exclude`。

## Why

- nx の `@nx/js/typescript` plugin は `tsconfig.lib.json` を build/typecheck に使う
- LSP (Cursor/VSCode) は最も近い `tsconfig.json` を使う
- 1ファイルにすると composite と include パターンが衝突する
  - composite には declaration: true が必要、テストには react-jsx も必要、
    両方を1つに入れると `declarationMap` 警告などが出やすい
- 2層分離で「LSPは緩く、ビルドは厳しく」を実現

## How to apply

新規 package/app を作るときは必ず2ファイル作成。Task 7のgame-coreがリファレンス実装。

## 関連の罠

- `composite: true` を base.json に入れない（appがnoEmit時に矛盾）
- `declarationMap: true` も base ではなく lib.json に置く
- vitest.config.ts で `@org/config-vitest/<preset>` を import するとき、
  preset 側 (config-vitest/src/) では他の preset を相対 import しない
  （@nx/vite plugin のNode解決がTS拡張子を扱えない）
