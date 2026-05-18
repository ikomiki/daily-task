# Claude Design プロンプト集（habits アプリ）

## 目的

このディレクトリは、habits アプリの UI デザイン（見た目・インタラクション・レスポンシブ対応・アクセシビリティ）を統一するための Claude Design プロンプト集です。

各画面の設計を進める際には、対応するプロンプトファイルを Claude Design（または Claude.ai）に投入し、UI 仕様とコンポーネント設計を生成します。

### 取り込みフロー

1. 新規画面の場合は、本 README の「## 運用」に従い新規プロンプトファイルを作成する
2. 既存画面をアップデートする場合は、対応するプロンプトファイルを編集する
3. Claude Design にプロンプトを投入し、UI 仕様書（Markdown）+ コンポーネント実装例（JSX）を生成
4. レビュー観点（「## 運用」§3 参照）で出力をチェックし、フィードバックを反映する
5. 生成内容を実装に取り込む（手動 / 自動スキャフォルディング）

## 対象画面（10 画面 + README）

| ファイル | 画面名 | 概説 |
|---------|--------|------|
| `README.md` | このファイル | 設計方針・共通ガイド・運用手順 |
| `auth-login.md` | ログイン画面 | Email / Password 認証 |
| `auth-signup.md` | サインアップ画面 | 新規ユーザー登録 |
| `today.md` | Today 画面 | 当日タスク一覧（時間帯別）、3 ボタン操作 |
| `tasks-list.md` | タスク一覧画面 | 全タスク表示、新規追加、編集、アーカイブ、復元 |
| `task-edit.md` | タスク編集画面 | タスクプロパティ設定、頻度ピッカー |
| `time-slots.md` | 時間帯設定画面 | 時間帯の CRUD |
| `settings.md` | 設定画面 | 通知権限・ユーザー情報・ログアウト |
| `stash-panel.md` | スタッシュ（集計）画面 | 全タスク集計表示（完了率など） |
| `history.md` | 履歴画面 | タスク単位の過去ログ、遅延ロード |
| `calendar.md` | カレンダー画面 | 月別タスク状態編集、日付グリッド |

## 共通スタイル方針

### カラートークン（8 種）+ フォントトークン（1 種）

`packages/config-tailwind/src/theme.css` で定義。Tailwind v4 の CSS-first `@theme` ブロック。

| トークン名 | 値 | 用途 |
|-----------|-----|------|
| `--color-game-bg` | `#0b0d12` | 背景（ダークテーマ基調） |
| `--color-game-fg` | `#e6e8ef` | フォアグラウンド（テキスト） |
| `--color-game-accent` | `#4cc9f0` | アクセント（ボタン・フォーカス） |
| `--color-cal-complete` | `#4cc9f0` | カレンダー：完了日 |
| `--color-cal-fail` | `#ef4444` | カレンダー：失敗日 |
| `--color-cal-skip` | `#9ca3af` | カレンダー：スキップ日 |
| `--color-cal-today` | `#facc15` | カレンダー：本日 |
| `--color-cal-dim` | `#374151` | カレンダー：処理対象外日 |
| `--font-display` | `"Inter", "Hiragino Sans", sans-serif` | UI 全体フォント |

**クラス名の使い方：**

```html
<!-- 背景 -->
<div class="bg-game-bg">...</div>

<!-- テキスト -->
<p class="text-game-fg">...</p>

<!-- アクセント（ボタンなど） -->
<button class="bg-game-accent text-game-bg">...</button>

<!-- カレンダーセル -->
<div class="bg-cal-complete">完了</div>
<div class="bg-cal-fail">失敗</div>
```

### フォント

- **ファミリ：** `Inter` (Latin) + `Hiragino Sans` (日本語)
- **トークン：** `--font-display` (Tailwind クラス: `font-display`)
- **用途：** UI 全体で統一（本文・見出し・ラベル）

```html
<body class="font-display bg-game-bg text-game-fg">...</body>
```

### 配色基調

- **テーマ：** ダーク（背景 `#0b0d12`、テキスト `#e6e8ef`）
- **コントラスト：** WCAG AA 以上（推奨 AAA）

### レイアウト最大幅

| 画面タイプ | 最大幅クラス | 例 |
|-----------|------------|-----|
| 認証（ログイン・サインアップ） | `max-w-md` | ログインフォーム |
| その他全画面 | `max-w-2xl` | Today / タスク一覧 / 設定 |

### a11y（アクセシビリティ）必須事項

#### 1. フォーカスリング

すべてのインタラクティブ要素（ボタン・リンク・フォーム）は、フォーカス時に視認可能なリング表示が必須。

```html
<!-- ボタン -->
<button class="focus:ring-2 focus:ring-game-accent focus:outline-none">...</button>

<!-- リンク -->
<a href="/" class="focus:ring-2 focus:ring-game-accent focus:outline-none">...</a>

<!-- フォーム -->
<input class="focus:ring-2 focus:ring-game-accent focus:outline-none" />
```

#### 2. ARIA ロール・ラベル

- `role="alert"` — 緊急情報（エラーメッセージなど）
- `aria-label` / `aria-labelledby` — ボタン・アイコン単体の場合
- `aria-pressed` — トグル状態の表示
- `aria-expanded` — 折りたたみ要素

```html
<!-- ステータスボタン（トグル） -->
<button aria-pressed="true" class="...">完了</button>

<!-- エラーメッセージ -->
<div role="alert" class="text-cal-fail">入力に誤りがあります</div>
```

#### 3. コントラスト比

- 通常テキスト：4.5:1 以上（AA）
- 大型テキスト（18pt+）：3:1 以上（AA）
- 推奨：4.5:1 以上（AAA）

```css
/* Good: #e6e8ef on #0b0d12 = 高コントラスト */
background: #0b0d12;
color: #e6e8ef;

/* Avoid: グレー系テキストが暗すぎる場合は明るくする */
color: #a0a0a0;  /* 暗い → NG */
color: #d0d0d0;  /* 明るく → OK */
```

#### 4. キーボード操作

- Tab キーで全インタラクティブ要素に到達可能
- Enter / Space キーで動作
- 矢印キー（ピッカー・リスト）対応時は明示

```html
<!-- リスト項目（矢印キー対応） -->
<li role="option" tabindex="0">...</li>
```

#### 5. スクリーンリーダー対応

- `<label for="id">` で form 要素を関連づける
- `aria-describedby` で補足説明を関連づける
- 非表示要素（`.sr-only`）で補足テキストを提供

```html
<label for="email">メールアドレス</label>
<input id="email" type="email" aria-describedby="email-help" />
<span id="email-help" class="sr-only">登録済みのメールアドレスを入力</span>
```

### 既存スタイル参照

デザイン作成時に参照すべき既存スタイル源：

- **Tailwind v4 設定：** `packages/config-tailwind/` （theme.css ・ Tailwind.config.ts）
- **共有コンポーネント（M13 追加予定）：** `packages/ui/` 配下
- **既存画面の実装：** `apps/habits/src/features/` / `apps/habits/src/routes/` 配下
- **共有フック・ユーティリティ：** `apps/habits/src/hooks/` / `apps/habits/src/lib/`

## 共通章立て（各画面ファイルが守る 7 セクション）

各画面プロンプトファイル（`auth-login.md` など）は、以下の 7 つのセクションで構成されます。

### 1. 目的

その画面の機能・ユースケースを簡潔に説明。

**例：**

```markdown
## 目的

ユーザーが自分の習慣タスクをその日のうちに実行し、完了・スキップ・失敗のいずれかを記録する画面。
時間帯ごとにタスクをグループ化し、視認性を高める。
```

### 2. 表示要素

画面上に表示される全要素：見出し・テキスト・フォーム・ボタン・リスト・バッジなど。

各要素について：
- 名前・説明
- テキスト内容（静的 / 動的）
- サイズ・色・スタイル
- 配置

**例：**

```markdown
## 表示要素

### ページヘッダー

- **見出し：** "今日の習慣"（`h1`、`text-2xl font-bold`）
- **位置：** ページ上部中央
- **配色：** `text-game-fg`

### タスク項目

- **構成：** 時間帯グループ + タスク名 + 3 ボタン（完了・スキップ・失敗）
- **タスク名：** 動的テキスト（`state$.tasks` より）
- **ボタン配色：** 
  - 完了：`bg-game-accent`
  - スキップ：`bg-cal-skip`
  - 失敗：`bg-cal-fail`
```

### 3. インタラクション

ユーザーアクション・イベント処理・状態遷移。

**例：**

```markdown
## インタラクション

### 「完了」ボタン

1. ユーザーが「完了」を押す
2. 楽観更新で `state$.task_logs['${task_id}-${today}']` のステータスを `'complete'` に変更
3. 画面をリアルタイム再描画
4. バックエンド同期が非同期で実行（オフライン時も待機）

### 別ボタンへの切り替え

同一タスク内で別ボタンを押した場合は、前のステータスをリセットして新ステータスをセット。
```

### 4. 状態

画面の表示状態・エラー状態・ローディング状態・空状態。

**例：**

```markdown
## 状態

### 初期ロード中

- スケルトンローダーを表示
- タスク一覧はグレーアウト（`opacity-50`）

### 同期エラー

- `PendingSyncBadge` が赤背景で「同期失敗」と表示
- ユーザーは再試行ボタンを押すことで即リトライ可能

### 空状態

タスクがない場合は「タスクを追加してください」メッセージを表示。
```

### 5. レスポンシブ

スマートフォン・タブレット・デスクトップ各サイズでの見え方。

**例：**

```markdown
## レスポンシブ

- **モバイル（< 640px）：** 1 カラム、ボタンは横幅 100%（`w-full`）、行間広い
- **タブレット（640px-1024px）：** 1-2 カラム、ボタンサイズ `lg`
- **デスクトップ（> 1024px）：** `max-w-2xl` でセンタリング、レイアウト固定

スマートフォンでの指操作性：タッチターゲットは最小 44×44px 確保。
```

### 6. アクセシビリティ

a11y 対応の詳細（前述「共通スタイル方針」の a11y セクション参照）。

**例：**

```markdown
## アクセシビリティ

- フォーカスリング：すべてのボタンに `focus:ring-2 focus:ring-game-accent`
- ARIA ラベル：「完了」「スキップ」「失敗」ボタンに `aria-pressed` で状態を表示
- キーボード：Tab で全ボタンに到達可能、Enter / Space で実行
- スクリーンリーダー：各タスク項目は `<li role="listitem">` で構造化
```

### 7. 既存スタイル参照

この画面の実装に参照すべき既存ファイル。

**例：**

```markdown
## 既存スタイル参照

- **Tailwind トークン：** `packages/config-tailwind/src/theme.css`
- **既存タスク描画：** `apps/habits/src/features/today/TodayTaskItem.tsx`
- **ステータス管理：** `packages/habit-sync/src/index.ts` の `setTaskLogStatus()`
- **フック：** `apps/habits/src/hooks/useOnlineStatus.ts`
```

---

## 運用

### 新規画面をプロンプト化する手順

1. **ファイル作成：** `docs/design-prompts/<feature-name>.md` を作成（例：`calendar.md`）
2. **7 セクション執筆：** 目的・表示要素・インタラクション・状態・レスポンシブ・a11y・既存参照をすべて記述
3. **プロンプト投入：** Claude Design（または Claude.ai）にファイル全体を投入
4. **出力品質チェック：** レビュー観点（以下）に照らし合わせて確認
5. **フィードバック反映：** 不足部分をプロンプトに追記し再実行（数回のイテレーション想定）
6. **実装へ：** 生成された UI 仕様書 + JSX をプロジェクトに統合

### Claude Design 出力のレビュー観点

生成されたデザイン仕様・コンポーネント実装が以下の全項目を網羅しているか確認する：

#### § 1: 目的セクション対応

- [ ] 画面の機能がプロンプトの「目的」に正確に反映されているか
- [ ] ユースケースが UI フローに組み込まれているか

#### § 2: 表示要素セクション対応

- [ ] ページヘッダー・見出し・テキスト・フォーム・ボタンが漏れなく実装されているか
- [ ] 要素のサイズ・色・配置がプロンプト仕様と一致するか
- [ ] カラートークン（`game-bg` / `game-accent` など）が正確に適用されているか

#### § 3: インタラクションセクション対応

- [ ] ボタン・フォーム・リスト操作のイベントハンドラが実装されているか
- [ ] 楽観更新・非同期同期の流れが反映されているか
- [ ] エラーハンドリング（ネットワークエラー・バリデーション）が含まれているか

#### § 4: 状態セクション対応

- [ ] ローディング状態の表示（スケルトン・spinner）が実装されているか
- [ ] エラー状態（エラーメッセージ・リトライボタン）が実装されているか
- [ ] 空状態（タスク 0 件など）のメッセージが実装されているか

#### § 5: レスポンシブセクション対応

- [ ] スマートフォン / タブレット / デスクトップ各ブレークポイントのレイアウトが記述されているか
- [ ] ボタンサイズ・行間・1/2 カラム切り替えが明示されているか
- [ ] タッチターゲット 44×44px の確保がコメント / 実装に含まれているか

#### § 6: a11y セクション対応

- [ ] `focus:ring-2 focus:ring-game-accent` がすべてのインタラクティブ要素に適用されているか
- [ ] `aria-pressed` / `aria-label` / `role="alert"` などが必要箇所に含まれているか
- [ ] キーボード操作（Tab・Enter・Space・矢印）が実装されているか
- [ ] コントラスト比が WCAG AA 以上になっているか（色チェック）

#### § 7: 既存スタイル参照セクション対応

- [ ] `packages/config-tailwind/` のトークンが実装で使用されているか
- [ ] 既存コンポーネント / フック の参照・再利用が適切か
- [ ] プロジェクト固有の実装パターン（hooks・ユーティリティ）が遵守されているか

### 既存画面の更新手順

1. 対応するプロンプトファイル（例：`today.md`）を編集
2. Claude Design に更新内容を投入
3. 上記のレビュー観点に従ってチェック
4. 差分を実装に反映

---

## 関連ドキュメント

- **全体設計仕様：** `docs/superpowers/specs/2026-05-16-habits-app-design.md`
- **Tailwind 設定：** `packages/config-tailwind/`
- **実装ガイド：** CLAUDE.md の「アーキテクチャ要点」「コード規約」
