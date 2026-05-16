# @org/habit-core

habits アプリの純粋ドメインロジック。副作用を持たない、TypeScript ネイティブのライブラリ。

## 公開 API

- `Frequency` — 頻度ルールの判別共用体（毎日 / n 日に 1 回 / 曜日 / 第 n 週指定 / n 週に 1 回）
- `isDueOn(rule, date, taskCreatedAt)` — 指定日にルールが該当するか（M4 で実装）
- `TaskStatus`, `DisplayTaskStatus` — タスク状態型
- `LogEntry`, `calculateStreak(logsAsc)` — 連続完了数（M4 で実装）

## 設計参照

- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §5.2 / §6.3
