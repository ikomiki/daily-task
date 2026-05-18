import type React from 'react';

export interface AlertTextProps {
  children: React.ReactNode;
  /** メッセージのトーン（デフォルト: 'error'） */
  tone?: 'error' | 'warning';
}

/** エラー・警告メッセージを表示するインラインテキストコンポーネント */
export function AlertText({ children, tone = 'error' }: AlertTextProps): React.ReactElement {
  if (tone === 'warning') {
    return (
      <p role="status" className="text-sm text-yellow-300">
        {children}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-red-300">
      {children}
    </p>
  );
}
