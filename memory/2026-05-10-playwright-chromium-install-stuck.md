---
name: playwright install chromium が Node v26 環境で繰り返しスタックする
description: Mac + Node v26.1.0 で `pnpm exec playwright install chromium` のダウンロードが 448K 前後で停止する。Node v24 にダウングレードすると正常完了する
type: project
---

## What

Node v26.1.0 の環境で `pnpm exec playwright install chromium` を実行すると、
ダウンロードが 448K 程度で実質停止する。プロセスは生きているが進捗ゼロ、
最終的に `chromium-1217/chrome-mac-arm64/` 直下に App と一部ファイルだけ
作成され、`Frameworks/` が欠落した状態でインストール完了扱いになる。

`pnpm nx e2e sample-game` 実行時に
`Error: browserType.launch: Target page, context or browser has been closed`
（実体は dlopen で `Google Chrome for Testing Framework` がない）で失敗。

## Why

Node v26.1.0 と playwright の registry oopDownloadBrowserMain.js の組み合わせで
ストリーミングダウンロードが途中停止する模様。Node v24.15.0 では同症状なし。

## Fix（確定）

`.nvmrc` を `v24.15.0` 以下に下げてから `pnpm exec playwright install` を実行する。
完全にダウンロードが終われば（chromium-1217 が ~336M、chromium_headless_shell-1217 が ~189M）
`pnpm nx e2e sample-game` が成功する（5秒前後で 1 test pass）。

playwright config はデフォルトの `devices['Desktop Chrome']` のままでよい
（headless shell が正しく入っていればそのまま動く）。
`channel: 'chromium'` の override は不要。

## Prevention

- 新規セットアップ時は `.nvmrc` に従って Node を切り替えてから playwright install する
  （`source ~/.nvm/nvm.sh && nvm use` を `.envrc` で自動化済み）
- ダウンロード完了確認は `du -sh ~/Library/Caches/ms-playwright/chromium-*` で
  目安サイズ（chromium ~330M / headless-shell ~190M）を確認する
- 進捗が 1MB 未満で止まっているなら Node バージョンを疑う
