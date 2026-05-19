import { Banner } from '@org/ui';
import type React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

// オフライン時のみ表示するバッジ。書き込みが復帰後に同期されることをユーザーに伝える。
export function PendingSyncBadge(): React.ReactElement | null {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return <Banner pulse>オフラインです。書き込みは復帰後に同期されます。</Banner>;
}
