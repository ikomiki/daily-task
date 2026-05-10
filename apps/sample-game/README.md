# @org/sample-game

`packages/{game-core,ui,audio}` と共有設定をすべて消費する検証用ゲームアプリ。

TAP ボタンを押すとスコアが +1 され、効果音が鳴る最小ゲーム。
共有ライブラリ全体の導線（Pixi 統合・Zustand state・Zod バリデーション・Tailwind UI・howler 効果音）を1画面で確認する目的。

## 起動

```bash
pnpm nx serve sample-game        # http://localhost:5173
pnpm nx build sample-game        # production build
pnpm nx test sample-game         # vitest（jsdom + @pixi/react は vite alias でモック）
pnpm nx e2e sample-game          # Playwright（CI環境推奨、ローカルは memory/ 参照）
```

## 構成

| ファイル | 役割 |
|---------|------|
| `src/main.tsx` | React のマウント |
| `src/App.tsx` | HUD + GameCanvas + TAPボタンを束ねる画面 |
| `src/useSampleGame.ts` | `createScoreStore` を `useSyncExternalStore` で React にバインド |
| `src/__mocks__/pixi-react.tsx` | vitest 専用の `@pixi/react` スタブ |
| `vite.config.ts` | `process.env.VITEST` 時のみ alias で `@pixi/react` をスタブに差替 |
| `e2e/sample-game.spec.ts` | TAP→スコア+1 のシナリオ |

## 仕様

- React 19 を `<StrictMode>` で起動
- `<GameCanvas width={640} height={480} />` で Pixi Application をマウント
- `<ScoreHud />` でスコア表示（Tailwind 装飾、`role="status"` でアクセシブル）
- TAP ボタンでスコア +1 + 効果音再生（`/se/click.mp3` は空のスタブ）
- `useSyncExternalStore` で 1 ゲーム = 1 ScoreStore を保持

## 既知の挙動

- jsdom 環境では Pixi の Canvas がモックされるため、`@pixi/react` は描画しない
- 効果音は実ファイルが空でも `howler` はエラーにならない
- E2E のローカル実行は **Node v24** で動作確認済み（v26 系では `playwright install chromium` のダウンロードが停止する。詳細: `memory/2026-05-10-playwright-chromium-install-stuck.md`）
