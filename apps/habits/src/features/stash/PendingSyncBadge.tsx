import type React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { usePendingSyncCount } from '../../hooks/usePendingSyncCount.js';

// オフラインまたは pending 件数 >= 1 のとき表示するバッジ。
// 両方の場合は両方を併記する。
export function PendingSyncBadge(): React.ReactElement | null {
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();

  if (online && pending === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      {!online ? <span>● オフライン</span> : null}
      {pending > 0 ? <span>同期前 {pending} 件</span> : null}
    </div>
  );
}
