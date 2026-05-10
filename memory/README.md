# memory/ — プロジェクト固有の失敗事例

タスクが失敗・誤りだった場合、以下の手順で記録する。

## 書き方

1. ファイル名: `YYYY-MM-DD-<topic>.md`（例: `2026-05-12-tailwind-v4-content-glob.md`）
2. 推奨の frontmatter:

   ```markdown
   ---
   name: <短いタイトル>
   description: <一文での要約>
   type: project | feedback | reference
   ---
   ```

3. 本文に **What / Why / Fix / Prevention** を記述する:
   - **What**: 何が起きたか（症状）
   - **Why**: なぜ起きたか（根因）
   - **Fix**: どう直したか
   - **Prevention**: 次回どう防ぐか

## 昇格ルール

同種の失敗が memory/ に **2回以上** 記録されたら `rules/` に昇格させ、
`CLAUDE.md` から参照を追加する。

## いつ参照するか

- 同じ症状やエラーメッセージを見たとき
- 新しいパッケージやツールを追加するとき
- インストール/ビルド/テストが想定外に失敗したとき
