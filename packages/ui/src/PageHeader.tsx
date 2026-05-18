import type React from 'react';

export interface PageHeaderProps {
  /** ページタイトル（h1 に表示） */
  title: string;
  /** ヘッダー右側に配置するナビゲーション要素（省略可） */
  nav?: React.ReactNode;
}

/** ページ上部のタイトル + オプション nav スロットを持つヘッダー */
export function PageHeader({ title, nav }: PageHeaderProps): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-game-accent">{title}</h1>
      {nav}
    </div>
  );
}
