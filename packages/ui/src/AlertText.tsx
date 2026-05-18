import type React from 'react';

export interface AlertTextProps {
  children: React.ReactNode;
  /** メッセージのトーン（デフォルト: 'error'） */
  tone?: 'error' | 'warning';
}

// トーンごとの設定テーブル
const toneConfig: Record<
  NonNullable<AlertTextProps['tone']>,
  { role: string; className: string }
> = {
  error: { role: 'alert', className: 'text-sm text-red-300' },
  warning: { role: 'status', className: 'text-sm text-yellow-300' },
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
