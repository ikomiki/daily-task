import type React from 'react';

export interface CardProps {
  children: React.ReactNode;
  /** 追加の CSS クラス（省略可） */
  className?: string;
}

/** ボーダー付きカードコンテナ */
export function Card({ children, className }: CardProps): React.ReactElement {
  return (
    <div className={`rounded border border-gray-700 p-3${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
