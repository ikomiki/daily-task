# @org/game-core

ゲーム基盤ライブラリ。Pixi.js / Zustand / Zod を組み合わせ、
スコア管理・セーブデータ検証・Pixi Application マウントの最小骨格を提供する。

**他の `packages/*` には依存しない**（純粋な基盤として独立）。

## エクスポート

| API | 用途 |
|-----|------|
| `createScoreStore()` | Zustand vanilla store。`{ score, increment, reset }` を持つ |
| `parseSaveData(input)` | Zod で `{ highScore: number, version: 1 }` を `safeParse` |
| `<GameCanvas width height>` | `@pixi/react` の `Application` をマウントするコンポーネント |
| `ScoreState`, `SaveData` | 上記の型 |

## 利用例

```tsx
import { createScoreStore, GameCanvas, parseSaveData } from '@org/game-core';

const store = createScoreStore();
store.getState().increment(); // score: 1

const result = parseSaveData(JSON.parse(localStorage.getItem('save') ?? '{}'));
if (result.success) {
  store.setState({ score: result.data.highScore });
}

<GameCanvas width={640} height={480}>
  {/* Pixi 要素を子として配置 */}
</GameCanvas>;
```

## 開発

```bash
pnpm nx test game-core           # vitest（pixi preset = jsdom + canvas inline）
pnpm nx typecheck game-core      # tsc -p tsconfig.lib.json
pnpm exec biome check packages/game-core
```

## ファイル構成

| ファイル | 内容 |
|---------|------|
| `src/score.ts` / `score.test.ts` | Zustand スコア store |
| `src/save.ts` / `save.test.ts` | Zod セーブデータバリデーター |
| `src/GameCanvas.tsx` | `@pixi/react` Application ラッパー |
| `src/index.ts` | 再エクスポート |

## バージョン管理

セーブデータは `version: z.literal(1)` で固定。
将来のスキーマ変更時は version を上げてマイグレーション境界とする。
