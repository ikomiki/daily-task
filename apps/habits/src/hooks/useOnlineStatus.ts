import { use$ } from '@legendapp/state/react';
import { online$ } from '@org/habit-sync';

// online$ を React コンポーネントから reactive に購読する。
// 値が変わると use$ により呼び出し元が再レンダリングされる。
export function useOnlineStatus(): boolean {
  return use$(online$);
}
