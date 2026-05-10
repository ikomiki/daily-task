---
description: 変更影響範囲のlintをサブエージェントで実行
allowed-tools: Agent
---

`general-purpose` サブエージェントを起動し、`pnpm nx affected -t lint` を実行してください。
結果を以下の形式で要約してメインに返却します:

- 対象プロジェクト一覧
- 失敗があれば対象プロジェクトと違反ルールを列挙
- 全体の合否（PASS/FAIL）

コンソールの全文ではなく、必要な情報だけを抜粋してください。
