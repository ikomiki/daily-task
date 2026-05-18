import type React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';

// オフライン時のみ表示するバッジ。集計が古い可能性をユーザーに伝える。
export function PendingSyncBadge(): React.ReactElement | null {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <span>● オフライン — 集計が古い可能性があります</span>
    </div>
  );
}
