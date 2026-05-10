import { useSyncExternalStore, useRef } from 'react';
import { createScoreStore } from '@org/game-core';

// アプリ内で1つの ScoreStore インスタンスをぶら下げる薄いフック
export const useSampleGame = () => {
  const storeRef = useRef<ReturnType<typeof createScoreStore> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createScoreStore();
  }
  const store = storeRef.current;
  const score = useSyncExternalStore(
    store.subscribe,
    () => store.getState().score,
    () => store.getState().score,
  );
  return {
    score,
    increment: store.getState().increment,
    reset: store.getState().reset,
  };
};
