# デプロイ・運用ガイド

## 目次

1. [本番 Supabase の準備](#1-本番-supabase-の準備)
2. [フロントエンドのデプロイ](#2-フロントエンドのデプロイ)
3. [環境変数の管理](#3-環境変数の管理)
4. [マイグレーションの運用](#4-マイグレーションの運用)
5. [Supabase Auth の設定](#5-supabase-auth-の設定)
6. [Realtime の設定確認](#6-realtime-の設定確認)
7. [バックアップ](#7-バックアップ)
8. [モニタリング](#8-モニタリング)
9. [ロールバック手順](#9-ロールバック手順)
10. [インシデント対応](#10-インシデント対応)
11. [Lighthouse 手動検証](#11-lighthouse-手動検証)

---

## 1. 本番 Supabase の準備

### 1.1 プロジェクトの作成

1. [supabase.com](https://supabase.com) にログインする
2. 「New project」でプロジェクトを作成する
   - **Organization:** 適切な組織を選択
   - **Name:** `habits-prod`（任意）
   - **Database Password:** 強固なパスワードを設定（保管すること）
   - **Region:** ユーザーに近いリージョンを選択（例: `ap-northeast-1` 東京）
3. プロジェクト作成完了を待つ（数分かかる）

### 1.2 マイグレーションの適用

ローカルで動作確認済みのマイグレーションを本番環境に適用する。

```bash
# Supabase CLI で本番プロジェクトにリンク
supabase link --project-ref <your-project-ref>
# project-ref は Supabase ダッシュボードの URL から確認
# 例: https://app.supabase.com/project/abcdefghijklmnop
#     → project-ref は "abcdefghijklmnop"

# 本番に未適用のマイグレーションを適用
supabase db push
```

### 1.3 TypeScript 型の確認

本番環境への接続でも型生成できる。スキーマが一致していることを確認する場合に使用。

```bash
supabase gen types typescript --project-id <your-project-ref> --schema public \
  > /tmp/prod-db-types.ts
diff packages/habit-sync/src/db-types.ts /tmp/prod-db-types.ts
```

---

## 2. フロントエンドのデプロイ

### 2.1 本番ビルド

```bash
pnpm nx build habits
# 出力先: apps/habits/dist/
```

`dist/` ディレクトリの内容を静的ホスティングサービスにデプロイする。

### 2.2 ホスティングサービス別の設定

#### Vercel（推奨）

1. GitHub リポジトリを Vercel にインポートする
2. 「Framework Preset」を **Vite** に設定する
3. **Build Command:** `cd ../.. && CI=true pnpm nx build habits`（もしくは Nx affected を活用）
4. **Output Directory:** `apps/habits/dist`
5. **Root Directory:** `apps/habits`
6. 環境変数を設定する（§3 参照）

**SPA ルーティングの設定:** TanStack Router は SPA ルーティングのため、すべてのリクエストを `index.html` にフォールバックする設定が必要。`vercel.json` を作成する。

```json
{
  "rewrites": [{ "source": "/((?!api).*)", "destination": "/index.html" }]
}
```

#### Netlify

`apps/habits/public/_redirects` に以下を追加する。

```
/*    /index.html   200
```

#### Cloudflare Pages

1. Build command: `pnpm nx build habits`
2. Build output directory: `apps/habits/dist`
3. Environment variables を設定する（§3 参照）

`apps/habits/public/_routes.json` に追加する（必要な場合）:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/api/*"]
}
```

---

## 3. 環境変数の管理

### 3.1 必須の環境変数

| 変数名 | 値の取得先 | 説明 |
|--------|----------|------|
| `VITE_SUPABASE_URL` | Supabase ダッシュボード → Project Settings → API | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase ダッシュボード → Project Settings → API → anon public | JWT トークン形式の公開キー |

**注意:** `VITE_` プレフィックスが必須。Vite はこのプレフィックスがある環境変数のみをビルドに含める。

### 3.2 各ホスティングサービスでの設定方法

| サービス | 設定場所 |
|---------|---------|
| Vercel | Project Settings → Environment Variables |
| Netlify | Site Settings → Environment Variables |
| Cloudflare Pages | Pages プロジェクト → Settings → Environment Variables |

### 3.3 ローカル開発

`apps/habits/.env.local` に記述する（Git 管理対象外）。`.env.local.example` を参照。

---

## 4. マイグレーションの運用

### 4.1 通常のマイグレーション追加フロー

```
1. ローカルで migration ファイル作成
   supabase migration new <名前>

2. SQL を記述し、ローカルで動作確認
   supabase db reset
   
3. TypeScript 型を再生成
   supabase gen types typescript --local --schema public \
     > packages/habit-sync/src/db-types.ts

4. テストを通す
   CI=true pnpm nx affected -t typecheck test

5. コミット・PR・レビュー

6. main にマージ後、本番に適用
   supabase link --project-ref <ref>
   supabase db push
```

### 4.2 本番適用前のチェックリスト

- [ ] ローカルで `supabase db reset` が成功する
- [ ] 全テストが pass する（`CI=true pnpm nx run-many -t test`）
- [ ] 型定義ファイル（`db-types.ts`）を更新してコミット済み
- [ ] 既存データへの影響を評価した（既存行のデフォルト値、NOT NULL 制約など）
- [ ] RLS ポリシーが適切に設定されている

### 4.3 データ量が多い場合の注意

既存テーブルに NOT NULL カラムを追加する場合、全行をロックする可能性がある。対処法:

1. NULL 許可カラムとして追加
2. バックグラウンドで既存行を更新（CONCURRENTLY 等）
3. デフォルト値が十分であればそのまま適用可能

---

## 5. Supabase Auth の設定

### 5.1 Email 確認の設定

| 環境 | 設定 | 理由 |
|------|------|------|
| 開発（ローカル） | 確認 OFF | 即座にログインできるようにするため |
| 本番 | 確認 ON | なりすまし防止 |

**本番での設定:**
1. Supabase ダッシュボード → Authentication → Email Templates
2. 「Confirm signup」テンプレートを日本語化する（推奨）
3. ダッシュボード → Authentication → Providers → Email で「Confirm email」を有効化

### 5.2 JWT 有効期限の設定

ダッシュボード → Authentication → JWT Settings で設定。

| 設定項目 | 推奨値 | 説明 |
|---------|-------|------|
| JWT expiry | 3600（1時間） | アクセストークンの有効期限 |

セッションは Supabase クライアントが自動更新（refresh token）するため、1時間でも問題ない。

### 5.3 許可オリジンの設定

ダッシュボード → Authentication → URL Configuration

| 設定 | 値 |
|------|-----|
| Site URL | `https://your-app.vercel.app`（本番 URL） |
| Redirect URLs | `https://your-app.vercel.app/**` |

ローカル開発用に `http://localhost:5173/**` も追加する。

---

## 6. Realtime の設定確認

### 6.1 Publication の確認

以下のテーブルが `supabase_realtime` publication に登録されていることを確認する。

```sql
-- Supabase Studio の SQL Editor で実行
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

期待される結果:
```
tablename
───────────────
time_slots
tasks
task_logs
task_stash
```

登録されていない場合はマイグレーション 10 を適用する。

### 6.2 RLS と Realtime の関係

Supabase Realtime も RLS を適用する。各ユーザーは自分のデータの変更通知のみ受け取れる。

---

## 7. バックアップ

### 7.1 Supabase の自動バックアップ

Supabase（Pro プラン以上）は自動的に日次バックアップを行う。

- **頻度:** 毎日
- **保持期間:** 7日間（Pro）/ 30日間（Team）
- **確認方法:** ダッシュボード → Project Settings → Backups

### 7.2 手動バックアップ

重要なマイグレーションやデータ変更の前に手動バックアップを取ることを推奨。

```bash
# CLI 経由でダンプ（Supabase Pro 以上）
supabase db dump -f backup.sql
```

---

## 8. モニタリング

### 8.1 Supabase ダッシュボード

| 確認事項 | 場所 |
|---------|------|
| API リクエスト数・レイテンシ | ダッシュボード → Reports |
| データベースクエリログ | ダッシュボード → Database → Logs |
| 認証エラー | ダッシュボード → Authentication → Logs |
| Realtime 接続数 | ダッシュボード → Reports → Realtime |
| ストレージ使用量 | ダッシュボード → Settings → Usage |

### 8.2 クライアントサイドエラートラッキング

現在、エラートラッキングツール（Sentry 等）は未導入。将来的に導入を検討。

導入時は以下を考慮:
- `setupSync()` の実行結果（同期エラー）
- `loadTaskHistory()` のネットワークエラー
- React のエラーバウンダリでキャッチした未処理例外

### 8.3 パフォーマンス監視のポイント

| 監視項目 | 閾値目安 | 対処 |
|---------|---------|------|
| `compute_task_days()` 実行時間 | > 100ms | task_days が遅い場合、task_logs が多い可能性。インデックス追加を検討 |
| `update_task_stash()` 実行時間 | > 50ms | streak 計算で全 task_logs を走査するため、ログが増えると遅くなる。将来的にキャッシュを検討 |
| Realtime 接続確立時間 | > 5秒 | ネットワーク問題の可能性 |

---

## 9. ロールバック手順

### 9.1 フロントエンドのロールバック

Vercel / Netlify / Cloudflare Pages はいずれもデプロイ履歴からワンクリックでロールバックできる。

1. ホスティングサービスのダッシュボードを開く
2. デプロイ履歴から正常だったバージョンを選択
3. 「Redeploy」または「Rollback」を実行

### 9.2 データベースマイグレーションのロールバック

**原則:** マイグレーションのロールバックは慎重に行う。既存データへの影響が大きい場合がある。

**推奨アプローチ:** 逆方向の新しいマイグレーションを作成して適用する（down マイグレーションの代わりに forward-only fix を使う）。

```bash
# 例: 追加したカラムを削除するロールバック用マイグレーション
supabase migration new rollback_add_tags_column
# → SQL: ALTER TABLE tasks DROP COLUMN IF EXISTS tags;
supabase db push
```

### 9.3 ロールバック前のチェックリスト

- [ ] バックアップが存在することを確認した
- [ ] ロールバック後のスキーマでアプリが正常動作するかローカルで確認した
- [ ] ユーザーデータへの影響（データ損失の可能性）を評価した
- [ ] フロントエンドと DB のバージョンが整合することを確認した

---

## 10. インシデント対応

### 10.1 よくある問題と対処

#### ユーザーがログインできない

1. Supabase ダッシュボード → Authentication → Logs でエラーを確認
2. 「Email not confirmed」の場合: Email 確認設定を確認
3. 「Invalid credentials」の場合: 正常（ユーザー操作の問題）
4. Supabase サービス障害の場合: [status.supabase.com](https://status.supabase.com) を確認

#### データが同期されない

1. Supabase ダッシュボード → Database → Logs で SQL エラーを確認
2. Realtime の接続数が 0 の場合: publication 設定を確認（§6 参照）
3. PGRST204 エラー: スキーマ変更後に型生成が行われているか確認

#### スタッシュが更新されない

1. `task_logs_update_stash` トリガーが存在するか確認

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'task_logs_update_stash';
```

2. `update_task_stash()` 関数が存在するか確認

```sql
SELECT proname FROM pg_proc WHERE proname = 'update_task_stash';
```

#### 本番 DB に直接接続して確認したい

```bash
# Supabase CLI 経由で psql
supabase db remote --uri postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

または Supabase ダッシュボード → Database → SQL Editor を使用する。

---

## 11. Lighthouse 手動検証

本番環境への本格デプロイ前に、品質指標（Performance / Accessibility / Best Practices / SEO / PWA）を Lighthouse で計測する。
手動運用とする理由は、Chrome ヘッドレスが CI 環境で詰まる前例があり、数値ブレが flaky テストになりやすいため。

### 11.1 数値目標

| カテゴリ | 目標スコア | 備考 |
|---|---|---|
| Performance | ≥ 90 | preview ビルド経由で測定 |
| Accessibility | ≥ 95 | aria-pressed / role="alert" / lang="ja" 適用済み |
| Best Practices | ≥ 95 | CSP 警告は許容、HTTPS は localhost 例外 |
| SEO | ≥ 90 | description / title / lang / robots 設定済み |
| PWA Installable | PASS | manifest + SW + icons 3 種で達成 |

### 11.2 実行手順

#### ステップ 1: 本番ビルド

```bash
pnpm nx build habits
# 出力先: apps/habits/dist/
```

#### ステップ 2: Preview サーバー起動（別ターミナル）

```bash
pnpm exec vite preview --config apps/habits/vite.config.ts --port 4173
# http://localhost:4173 でサーバーが起動
```

サーバーが起動したら、ブラウザで `http://localhost:4173/today` にアクセスして動作確認する。

#### ステップ 3: デスクトップ計測

```bash
pnpm dlx lighthouse http://localhost:4173/today \
  --view --output html --output-path ./lighthouse-desktop.html \
  --preset desktop --chrome-flags="--headless"
```

実行後、ブラウザで `lighthouse-desktop.html` が自動で開く。

#### ステップ 4: モバイル計測

```bash
pnpm dlx lighthouse http://localhost:4173/today \
  --view --output html --output-path ./lighthouse-mobile.html \
  --form-factor mobile --chrome-flags="--headless"
```

実行後、ブラウザで `lighthouse-mobile.html` が自動で開く。

#### ステップ 5: 結果確認と記録

各レポートから以下の数値を確認し、表 11.1 の目標に達しているか確認する:
- Performance スコア
- Accessibility スコア
- Best Practices スコア
- SEO スコア
- PWA Installable の合否

目標未達の場合は、§11.4 の チューニング項目 を参照。

### 11.3 よくあるエラーと対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `Chrome not found` | Chrome/Chromium がインストールされていない | `pnpm dlx lighthouse` は Puppeteer 経由で自動ダウンロード。ネット接続を確認して再実行 |
| `ECONNREFUSED 127.0.0.1:4173` | preview サーバーが起動していない | ステップ 2 でサーバーを起動してから再実行 |
| `Report saved to file` だが HTML が開かない | `--view` オプションが無視されている環境 | ブラウザで手動で `lighthouse-desktop.html` / `lighthouse-mobile.html` を開く |

### 11.4 失敗時のチューニング項目（優先度順）

#### 1. PWA Installable が FAIL

PNG icon（192×192, 512×512, maskable）が PNG では Lighthouse 最新版で要求される場合がある。
現在 SVG で対応しているため、PNG 追加が必要な場合は以下のファイルを生成・追加:

```bash
# apps/habits/public/ に以下を追加
icon-192.png   # 192×192 (RGB)
icon-512.png   # 512×512 (RGB)
icon-maskable.png  # 192×192 (maskable)
```

その後 `apps/habits/public/index.html` の `<link>` タグで参照を追加。

#### 2. Accessibility が ≥ 95 未満

以下の項目を確認：
- `lang="ja"` が `<html>` タグに設定されているか（`apps/habits/index.html`）
- 画像に `alt` 属性が漏れていないか（検索 `<img` で確認）
- ボタン・チェックボックスに `aria-label` / `aria-pressed` が設定されているか
- 見出しが h1 から h6 の順序で正しく使用されているか

#### 3. Performance が ≥ 90 未満

| 項目 | 確認内容 | 改善方法 |
|------|---------|--------|
| Largest Contentful Paint (LCP) | レポートの「Opportunities」を確認 | フォントの preconnect 追加（`rel="preconnect" href="https://fonts.googleapis.com"`）、Workbox の `globPatterns` で JS/CSS/SVG を確認 |
| Cumulative Layout Shift (CLS) | 動的ロード時にレイアウトがズレていないか | `width` / `height` を明示、アニメーション時に `will-change` を使用 |
| First Input Delay (FID) / Interaction to Next Paint (INP) | JavaScript の重い処理 | React.memo / useMemo / useCallback で最適化、大きなリストは仮想化（visx 等）を検討 |

#### 4. SEO が ≥ 90 未満

以下の項目を確認：
- `<meta name="description" content="...">` が `apps/habits/index.html` に設定されているか
- `<title>` タグが適切に設定されているか
- `<html lang="ja">` が設定されているか
- `<meta name="robots" content="index, follow">` が設定されているか

#### 5. Best Practices が ≥ 95 未満

| 項目 | 原因 | 対処 |
|------|------|------|
| CSP (Content Security Policy) 警告 | Lighthouse 基準は厳しめ | CSP 違反がなければそのまま許容 |
| HTTPS / SSL 警告 | localhost は例外扱い | 本番環境では自動的に PASS |
| Deprecated API 使用 | コンソールに警告が出ている | 検索 `console.error` / `console.warn` でコード内の該当箇所を除去 |

### 11.5 レポートの取り扱い

`lighthouse-desktop.html` と `lighthouse-mobile.html` は `.gitignore` に登録済みのため、Git で追跡されない。
ローカルテスト後は削除してもよい:

```bash
rm -f lighthouse-*.html
```

本番デプロイ前後に計測結果を記録する場合は、Notion / Wiki 等の外部ツールに保存すること。
