# @org/audio

howler.js + use-sound を薄くラップした React フック集。
SE/BGM の呼び出し方をプロジェクト全体で統一する目的。

## エクスポート

| API | 用途 |
|-----|------|
| `useGameSound(src, volume?)` | `{ play, stop }` を返す。`use-sound` のインスタンスをラップ |

## 利用例

```tsx
import { useGameSound } from '@org/audio';

const { play, stop } = useGameSound('/se/click.mp3', 0.5);
<button onClick={play}>tap</button>;
```

## 開発

```bash
pnpm nx test audio               # vitest（jsdom、use-sound は vi.mock）
pnpm nx typecheck audio
```

## テスト戦略

実音声は鳴らさない。`vi.mock('use-sound', ...)` でフックの戻り値だけ検証する。
本物の音声が鳴ることは sample-game の Playwright で間接的に確認する想定。
