# @org/habit-sync

habits アプリの同期層。legend-state を中心に Supabase との双方向同期と IndexedDB 永続化を担当する。

## 公開 API（M1 時点）

- `getSupabaseClient(config)` / `resetSupabaseClient()` — Supabase クライアントのシングルトン
- `state$` — legend-state observable の root（M5 で syncedSupabase を結線）
- `NotificationProvider`, `PermissionState`, `SlotSchedule` — 通知バックエンドの抽象

## 設計参照

- 設計仕様: `docs/superpowers/specs/2026-05-16-habits-app-design.md` §6 / §7
