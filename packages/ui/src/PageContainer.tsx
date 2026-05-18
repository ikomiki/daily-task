import type React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  /** ページ幅。'normal' は max-w-2xl、'narrow' は max-w-md（デフォルト: 'normal'） */
  width?: 'narrow' | 'normal';
}

// 幅バリアントごとのクラス定義
const widthClass: Record<NonNullable<PageContainerProps['width']>, string> = {
  normal: 'mx-auto max-w-2xl p-6 space-y-6',
  narrow: 'mx-auto max-w-md p-6 space-y-6',
};

/** ページコンテンツを中央寄せ・パディング付きでラップする共通コンテナ */
export function PageContainer({
  children,
  width = 'normal',
}: PageContainerProps): React.ReactElement {
  return <div className={widthClass[width]}>{children}</div>;
}
