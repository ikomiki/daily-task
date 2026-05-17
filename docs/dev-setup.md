# 開発者セットアップガイド

このガイドでは、Habits アプリをローカル環境で開発・実行するための手順を説明します。

## 目次

1. [前提ソフトウェア](#1-前提ソフトウェア)
2. [リポジトリのセットアップ](#2-リポジトリのセットアップ)
3. [Supabase ローカル環境の設定](#3-supabase-ローカル環境の設定)
4. [アプリの起動](#4-アプリの起動)
5. [開発コマンド一覧](#5-開発コマンド一覧)
6. [データベース操作](#6-データベース操作)
7. [IDE 設定](#7-ide-設定)
8. [ハマりポイント集](#8-ハマりポイント集)

---

## 1. 前提ソフトウェア

以下のソフトウェアを事前にインストールしてください。

| ソフトウェア | バージョン | 備考 |
|------------|---------|------|
| Node.js | v24 系 | `.nvmrc` で指定。nvm 推奨 |
| pnpm | v10 以上 | `npm install -g pnpm` |
| Docker Desktop | 最新版 | Supabase ローカル環境に必要 |
| Supabase CLI | 最新版 | `brew install supabase/tap/supabase` |
| Git | 最新版 | — |

### Node.js のバージョン管理（nvm 使用の場合）

```bash
# nvm がインストール済みの場合
nvm install   # .nvmrc の Node バージョンをインストール
nvm use       # .nvmrc のバージョンに切り替え
node --version  # v24.x.x であることを確認
```

**重要:** Node v26 系を使用すると Playwright のダウンロードが停止するため、v24 系を使うこと。

---

## 2. リポジトリのセットアップ

### 2.1 クローンと依存関係のインストール

```bash
git clone <repository-url>
cd daily-task
pnpm install
```

### 2.2 環境変数の設定

```bash
# サンプルファイルをコピー
cp apps/habits/.env.local.example apps/habits/.env.local
```

`.env.local` の設定値は Supabase ローカル環境起動後に取得します（次節参照）。

---

## 3. Supabase ローカル環境の設定

### 3.1 Docker Desktop の起動

Supabase を起動する前に Docker Desktop が起動していることを確認してください。

### 3.2 Supabase の起動

```bash
supabase start
```

初回起動時は Docker イメージのダウンロードに数分かかります。起動が完了すると以下のような出力が表示されます。

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJ...（長い文字列）
service_role key: eyJhbGciOiJ...（長い文字列）
```

### 3.3 環境変数の設定

`supabase start` の出力から以下の値を `apps/habits/.env.local` に転記します。

```bash
# apps/habits/.env.local
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJ...  # anon key の値
```

### 3.4 Supabase Studio（管理画面）

```
http://127.0.0.1:54323
```

ブラウザで開くとデータベースの中身をGUI で確認できます。

### 3.5 Supabase の停止

```bash
supabase stop
```

---

## 4. アプリの起動

```bash
pnpm nx serve habits
```

ブラウザで `http://localhost:5173` を開くと Habits アプリが表示されます。

### 初回確認事項

1. `/auth/signup` でアカウントを作成する
2. ローカル環境では Email 確認が無効のため、即座にログイン状態になる
3. 初期タスク（6件）が自動生成され、「今日のタスク」画面に表示される

---

## 5. 開発コマンド一覧

### 基本コマンド

```bash
pnpm nx serve habits                  # 開発サーバー起動（ポート 5173）
pnpm nx build habits                  # 本番ビルド（出力: apps/habits/dist/）
```

### テスト・検証

```bash
# 全パッケージの型検査
CI=true pnpm nx run-many -t typecheck

# 全パッケージのユニットテスト
CI=true pnpm nx run-many -t test

# 影響を受けるパッケージのみ（PR 時の CI と同じ）
CI=true pnpm nx affected -t typecheck test

# 単一プロジェクトのテスト
pnpm nx test habit-core
pnpm nx test habit-sync
pnpm nx test habits

# テスト名で絞り込み
pnpm nx test habit-core -- -t "isDueOn"
```

**`CI=true` が必要な理由:** ローカルの対話環境では `@nx/js/typescript` の sync 警告で `nx run-many` がブロックされる。`CI=true` を付けるか、後述の nx.json 設定で回避する。

### Lint / Format

```bash
# format + lint チェック（CI と同じ動作）
pnpm exec biome ci .

# format + lint 自動修正
pnpm exec biome check --write .
```

### E2E テスト

```bash
# Playwright のインストール（初回のみ）
source ~/.nvm/nvm.sh && nvm use  # Node v24 に切り替えてから実行
pnpm exec playwright install --with-deps chromium

# E2E テスト実行
pnpm nx e2e habits
```

### その他

```bash
# 依存グラフを HTML で表示
pnpm nx graph

# Nx タスクのキャッシュクリア
pnpm nx reset
```

---

## 6. データベース操作

### マイグレーションの新規作成

```bash
supabase migration new <マイグレーション名>
# 例: supabase migration new add_tags_column
# → supabase/migrations/YYYYMMDDHHMMSS_add_tags_column.sql が作成される
```

作成されたファイルに SQL を記述し、`supabase db reset` で適用を確認する。

### データベースのリセット（全マイグレーション再適用）

```bash
supabase db reset
```

全データが削除され、すべてのマイグレーションが順番に再適用されます。開発中はスキーマ変更確認のために頻繁に使います。

### TypeScript 型の再生成

スキーマ変更後は必ず実行してコミットする。

```bash
supabase gen types typescript --local --schema public \
  > packages/habit-sync/src/db-types.ts
```

### ローカル DB への直接接続

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

## 7. IDE 設定

### VS Code

推奨拡張機能:

| 拡張機能 | 用途 |
|---------|------|
| Biome | リアルタイム lint + format |
| ESLint（無効化推奨） | Biome と競合するため無効化する |
| Tailwind CSS IntelliSense | クラス名補完 |

`.vscode/settings.json`（推奨設定）:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### tsconfig の構成

各パッケージには2つの `tsconfig` が存在します。

| ファイル | 用途 |
|---------|------|
| `tsconfig.json` | LSP / IDE 用（`noEmit: true`、テストを `include`） |
| `tsconfig.lib.json` / `tsconfig.app.json` | ビルド用（テストを `exclude`、composite） |

IDE は `tsconfig.json` を自動的に使用するため、特別な設定は不要です。

---

## 8. ハマりポイント集

### Playwright インストールが止まる

**現象:** `playwright install chromium` が途中で止まって完了しない

**原因:** Node v26 系では Chromium のダウンロードが停止する既知の問題

**対処:**
```bash
source ~/.nvm/nvm.sh && nvm use  # .nvmrc の Node v24 に切り替え
pnpm exec playwright install --with-deps chromium
```

詳細: `memory/2026-05-10-playwright-chromium-install-stuck.md`

---

### `pnpm nx run-many` がブロックされる

**現象:** ローカル環境で `pnpm nx run-many -t test` を実行すると sync 警告でブロックされる

**原因:** `@nx/js/typescript` プラグインが対話環境でプロンプトを出す

**対処:** `CI=true` を先頭に付ける
```bash
CI=true pnpm nx run-many -t test
```

---

### 新しい Native ビルドパッケージを追加したとき

**現象:** `pnpm install` がブロックされる、または警告が出る

**原因:** pnpm v11+ は postinstall スクリプトを既定でブロックする

**対処:** `pnpm-workspace.yaml` の `allowBuilds` セクションに追加する

```yaml
# pnpm-workspace.yaml
allowBuilds:
  - esbuild
  - "@swc/core"
  - nx
  - <新しいパッケージ名>  # ← ここに追加
```

---

### 環境変数が読み込まれない

**現象:** アプリ起動時に「VITE_SUPABASE_URL が設定されていません」などのエラーが出る

**確認事項:**
1. `apps/habits/.env.local` が存在するか
2. `supabase start` が起動しているか
3. `.env.local` の値が `supabase start` の出力と一致しているか

---

### Supabase Studio にアクセスできない

**確認事項:**
1. Docker Desktop が起動しているか: `docker ps` でコンテナ一覧を確認
2. `supabase start` が成功しているか: `supabase status` で状態確認

---

### マイグレーションの適用順序が狂う

**現象:** `supabase db reset` でエラーが出る

**確認事項:** `supabase/migrations/` ディレクトリ内のファイル名（タイムスタンプ）の順序を確認する。ファイル名の順序でマイグレーションが適用されるため、依存関係の逆転が起きていないか確認する。

---

### Jest/Vitest で IndexedDB 関連のテストが失敗する

**確認事項:** `packages/config-vitest/` の setup ファイルで `fake-indexeddb/auto` がインポートされていることを確認する。`habit-sync` のテストでは自動的に fake-indexeddb が使用される。
