import { useCallback, useState } from 'react';

export type DisplayPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface UseNotificationPermissionResult {
  permission: DisplayPermission;
  request: () => Promise<void>;
}

function readPermission(): DisplayPermission {
  if (typeof globalThis.Notification === 'undefined') {
    return 'unsupported';
  }
  const p = globalThis.Notification.permission;
  if (p === 'granted') {
    return 'granted';
  }
  if (p === 'denied') {
    return 'denied';
  }
  return 'prompt';
}

// Notification.permission を React state として購読する。
// 'default' は UI 表示用に 'prompt' に正規化、未対応環境は 'unsupported'。
// permission は Notification.requestPermission() 経由でしか変わらないため、
// request() 呼び出し時に setState で同期する。
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [permission, setPermission] = useState<DisplayPermission>(() => readPermission());

  const request = useCallback(async (): Promise<void> => {
    if (typeof globalThis.Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    await globalThis.Notification.requestPermission();
    setPermission(readPermission());
  }, []);

  return { permission, request };
}
