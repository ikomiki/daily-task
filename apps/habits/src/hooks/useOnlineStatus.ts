import { useValue } from '@legendapp/state/react';
import { online$ } from '@org/habit-sync';

// online$ を React コンポーネントから reactive に購読する。
// 値が変わると useValue により呼び出し元が再レンダリングされる。
export function useOnlineStatus(): boolean {
  return useValue(online$);
}
