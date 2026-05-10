---
name: ローカルでの playwright install chromium が繰り返しスタックする
description: Mac環境で `pnpm exec playwright install chromium` のダウンロードが448K前後で停止し、フレームワークが配置されないままインストール完了扱いとなる
type: project
---

## What

ローカル開発環境で `pnpm exec playwright install chromium` を実行すると、
ダウンロードが 448K 程度で実質停止する。プロセスは生きているが進捗ゼロ、
最終的に `chromium-1217/chrome-mac-arm64/` 直下に App と一部ファイルだけ
作成され、`Frameworks/` が欠落した状態でインストール完了扱いになる。

`pnpm nx e2e sample-game` 実行時に
`Error: browserType.launch: Target page, context or browser has been closed`
（実体は dlopen で `Google Chrome for Testing Framework` がない）で失敗。

## Why（推測）

- 大容量バイナリ（150MB以上）のCDN取得で接続が切れている可能性
- pnpm 11 + Node v26 + macOS の組み合わせ依存
- ダウンロード途中でプロセスを kill すると pnpm 側は exit 0 を返し、
  chromium 自体は incomplete のまま残る

## Fix（未確定）

CI 環境では `pnpm exec playwright install --with-deps chromium` が正常に動作する
（`.github/workflows/ci.yml` で確認済みの想定）ため、ローカルE2Eは別途検証する。

ローカルで再現したら次を試す:
1. `rm -rf ~/Library/Caches/ms-playwright/chromium-*` で完全削除
2. `pnpm exec playwright install chromium --force` で再取得
3. それでもダメなら `npx playwright@latest install chromium` で playwright バイナリを直接実行
4. または手動で chromium for testing のzipを公式から取得して配置

## Prevention

- E2Eのローカル動作は CI とは別問題として扱う
- CI ではアクションが --with-deps で都度新規取得するため影響なし
- ローカル環境で playwright を初めて使うとき、ダウンロード進捗（du -sh）を
  確認してから完了を判断する
