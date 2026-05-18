import type React from 'react';

export interface CardProps {
  children: React.ReactNode;
  /** 追加の CSS クラス（省略可） */
  className?: string;
  /** カードの外観トーン。surface はボーダー+背景付き、flat は破線ボーダーのみ（デフォルト: 'surface'） */
  tone?: 'surface' | 'flat';
}

// トーンごとのクラス定義
const toneClass: Record<NonNullable<CardProps['tone']>, string> = {
  surface: 'rounded-md border border-border-default bg-surface-1 transition-colors',
  flat: 'rounded-md border border-dashed border-border-default bg-transparent',
};

/** ボーダー付きカードコンテナ */
export function Card({ children, className, tone = 'surface' }: CardProps): React.ReactElement {
  const base = toneClass[tone];
  return <div className={`${base}${className ? ` ${className}` : ''}`}>{children}</div>;
}
