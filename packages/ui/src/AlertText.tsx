import type React from 'react';

export interface AlertTextProps {
  children: React.ReactNode;
  /** メッセージのトーン（デフォルト: 'error'） */
  tone?: 'error' | 'warning';
}

// トーンごとの role と色クラスの定義
const toneConfig = {
  error: { role: 'alert' as const, className: 'text-sm text-red-400' },
  warning: { role: 'status' as const, className: 'text-sm text-yellow-400' },
};

/** エラー・警告メッセージを表示するインラインテキストコンポーネント */
export function AlertText({ children, tone = 'error' }: AlertTextProps): React.ReactElement {
  const { role, className } = toneConfig[tone];
  return (
    <p role={role} className={className}>
      {children}
    </p>
  );
}
