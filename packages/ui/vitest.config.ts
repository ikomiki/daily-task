import { mergeConfig } from 'vitest/config';
import base from '@org/config-vitest/react';

// habits アプリ導入前の移行期: src/index.ts のみで本格的なコンポーネントは
// 未配置のためテストファイルがない。実コンポーネント追加までの一時許容。
export default mergeConfig(base, {
  test: { passWithNoTests: true },
});
