# M14: Claude Design プロトタイプ適用 仕様メモ

**作成日**: 2026-05-19  
**対応マイルストーン**: M14  
**ブランチ**: worktree-feature+habits-m14-design-apply

---

## プロトタイプ

- **URL**: `https://api.anthropic.com/v1/design/h/prNtTwBM7iPUTmDOakRWLA`
- **展開先**: `/tmp/design-fetch/daily-task/`
- **生成日**: 2026-05-18
- **チャット**: 全 10 画面のハイファイ・インタラクティブプロトタイプを 1 セッションで作成

### バンドル構成

```
daily-task/
├── README.md             # コーディングエージェント向け指示
├── chats/chat1.md        # Claude Design とのチャット記録
└── project/
    ├── index.html        # エントリポイント
    ├── theme.css         # 共通テーマ（CSS 変数 + 基礎スタイル）
    ├── state.jsx         # モック状態管理（localStorage）
    ├── components.jsx    # 共通コンポーネント（NavBar / TopBar / PageHeader 等）
    ├── app.jsx           # ハッシュルータ
    ├── screens-auth.jsx
    ├── screens-today.jsx
    ├── screens-tasks.jsx
    ├── screens-task-edit.jsx
    ├── screens-time-slots.jsx
    ├── screens-settings.jsx
    ├── screens-stash.jsx
    ├── screens-history.jsx
    └── screens-calendar.jsx
```

---

## 確定スコープ

### 実施内容

1. **テーマトークン拡張** (`packages/config-tailwind/src/theme.css`)
   - 新トークン: `--color-game-fg-muted/dim/accent-soft`, `--color-surface-1/2/3`,
     `--color-border-default/strong`, `--color-status-complete/skip/fail`,
     `--radius-sm/md/lg/full`, `--font-mono`
   - `--font-display` に Hiragino Kaku Gothic ProN / Yu Gothic / Meiryo を補完

2. **フォント同梱** (`@fontsource/inter` + `@fontsource/jetbrains-mono`)
   - pnpm catalog + apps/habits deps に追加
   - `apps/habits/src/styles.css` で latin subset のみ import（Inter 400/500/600/700 + Mono 400/500）

3. **`@org/ui` プリミティブ改修・新規追加**
   - 改修 (クラス書き換え + API 追加): Button / Card / PageContainer / PageHeader / AppNav / TextInput / SelectInput / AlertText
   - 破壊的変更: `PageHeader.nav` prop 撤去 → callsite を Phase 3 で同時更新
   - 新規: TopBar / Banner / EmptyState
   - 純関数追加（TDD）: `isNavItemActive(itemTo, currentPath)` in AppNav

4. **グローバル sticky TopBar** の全認証済ルートへの適用
   - `router.tsx` の rootRoute で auth 以外に常時マウント
   - `RoutedAppNav.tsx` でルーターからの currentPath 自動注入

5. **全 10 画面の視覚再描画**
   - Auth / Today / Tasks / Task edit / Time slots / Settings / Stash / History / Calendar
   - データフロー・ルーター・Supabase 同期は **触らない**

6. **design-prompts ドキュメント同期**
   - `docs/design-prompts/README.md` の「共通スタイル方針」に新トークンを追記
   - 各画面 .md の「既存スタイル参照」を新トークンで補強

### 視覚改良ポイント

- Inter フォントが読み込まれ、文字がシャープになる
- sticky TopBar（`habits.` ブランド）が全ページ上部に固定
- AppNav が pill スタイルに + active 状態がアクセント色で強調
- PageHeader にサブタイトル + 右スロットが追加
- StatusButtons が `bg-status-complete/skip/fail` で 3 色塗りつぶし
- Calendar セルが `inset` リングで today 表示 + 凡例追加
- Stash が dl グリッド + streak バッジ + 3 色プログレスバー
- Banner でオフライン通知が視覚的に強調

---

## Out of Scope（M14 では扱わない）

- Storybook 化 / Visual Regression テスト
- Lighthouse CI 自動化
- Web Push 通知 (v1.5 で予定)
- PNG icon 自動生成 (SVG のまま)
- ライトモード追加（ダーク前提）
- 国際化（ja 固定）
- Tauri ネイティブ移行
- semantic token のさらなる正規化（M15+ で要否判断）
- Storage migration（state schema は変更しない）
- `PendingSyncBadge` の `pending_count >= 1` 併記（CLAUDE.md M8 仕様乖離 → 別 PR）
- `status-*` と `cal-*` の意味的分離はそのまま維持
- `font-mono` の上書きが Tailwind 既定に与える影響は Phase 1 で確認し記録するが、対処は軽微な調整に留める

---

## 実装プラン

詳細は `/Users/ikomiki/.claude/plans/fetch-this-design-file-refactored-raccoon.md` を参照。
