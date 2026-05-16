import { observable } from '@legendapp/state';

// オンライン状態の observable。
// アプリ起動時に startOnlineWatcher() を 1 度だけ呼ぶ想定。
// SSR / node 環境で navigator が無い場合は常に true として扱う（保守的に同期可能と仮定）。
export const online$ = observable<boolean>(true);

// window / navigator が無い環境（SSR / 純 Node）では何もしないでフォールバック。
function hasBrowserGlobals(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
}

export function startOnlineWatcher(): () => void {
  if (!hasBrowserGlobals()) {
    return () => {};
  }
  // 初期値を navigator.onLine に同期
  online$.set(navigator.onLine);

  const onOnline = (): void => {
    online$.set(true);
  };
  const onOffline = (): void => {
    online$.set(false);
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
