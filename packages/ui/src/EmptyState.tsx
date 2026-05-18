import type React from 'react';
import type { ReactNode } from 'react';
import { Card } from './Card.js';

export interface EmptyStateProps {
  /** アイコン要素（省略可） */
  icon?: ReactNode;
  /** メインメッセージ */
  title: string;
  /** 補足テキスト（省略可） */
  hint?: string;
}

/** データが空のときに表示するステートコンポーネント */
export function EmptyState({ icon, title, hint }: EmptyStateProps): React.ReactElement {
  return (
    <Card tone="flat" className="text-center px-4 py-8">
      {icon && (
        <div aria-hidden="true" className="mb-2 text-2xl text-game-fg-muted">
          {icon}
        </div>
      )}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-game-fg-muted">{hint}</div>}
    </Card>
  );
}
