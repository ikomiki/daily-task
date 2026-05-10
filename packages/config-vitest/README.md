# @org/config-vitest

ワークスペース共通の vitest プリセット。

## 提供するプリセット

| import | 用途 |
|--------|------|
| `@org/config-vitest/node` | 純ロジック向け（environment: node） |
| `@org/config-vitest/react` | React 向け（jsdom + testing-library setup） |
| `@org/config-vitest/pixi` | Pixi 向け（jsdom + `pixi.js` を server.deps.inline） |
| `@org/config-vitest/setup` | jsdom 環境の testing-library setup（`@testing-library/jest-dom/vitest`） |

## 使い方

各パッケージの `vitest.config.ts`:

```ts
import base from '@org/config-vitest/react';
export default base;
```

カスタマイズしたい場合は `mergeConfig` で上書きする。

```ts
import { defineConfig, mergeConfig } from 'vitest/config';
import base from '@org/config-vitest/react';

export default mergeConfig(
  base,
  defineConfig({ test: { /* override */ } }),
);
```

## 制約

プリセットファイル間（pixi.ts → react.ts のような）相対 import は **使わない**。
`@nx/vite/plugin` の Node 解決が TS 拡張子を扱えず、プロジェクトグラフ生成で失敗するため、
各プリセットは内容を直接書き下す方針。
