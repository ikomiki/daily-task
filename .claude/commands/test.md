---
description: 変更影響範囲のtestをサブエージェントで実行
allowed-tools: Agent
---

`general-purpose` サブエージェントを起動し、`pnpm nx affected -t test` を実行してください。
結果を以下の形式で要約してメインに返却します:

- 対象プロジェクト一覧
- 失敗があれば対象テスト名と失敗の原因を抜粋
- 全体の合否（PASS/FAIL、件数）

全ログではなく要点だけ返してください。
