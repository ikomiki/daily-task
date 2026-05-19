import type React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  /** ページ幅。'normal' は max-w-2xl、'narrow' は max-w-md（デフォルト: 'normal'） */
  width?: 'narrow' | 'normal';
}

// 幅バリアントごとのクラス定義
const widthClass: Record<NonNullable<PageContainerProps['width']>, string> = {
  normal: 'mx-auto w-full max-w-2xl px-6 pb-20 pt-6 space-y-6 page-fade',
  narrow: 'mx-auto w-full max-w-md px-6 pb-20 pt-6 space-y-6 page-fade',
};

/** ページコンテンツを中央寄せ・パディング付きでラップする共通コンテナ */
export function PageContainer({
  children,
  width = 'normal',
}: PageContainerProps): React.ReactElement {
  return <div className={widthClass[width]}>{children}</div>;
}
