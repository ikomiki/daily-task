import type React from 'react';

export interface PageHeaderProps {
  /** ページタイトル（h1 に表示） */
  title: string;
  /** タイトル下に表示するサブタイトル（省略可） */
  subtitle?: string;
  /** ヘッダー右側に配置するスロット（省略可） */
  right?: React.ReactNode;
}

/** ページ上部のタイトル + オプション subtitle / right スロットを持つヘッダー */
export function PageHeader({ title, subtitle, right }: PageHeaderProps): React.ReactElement {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-game-accent">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-game-fg-muted">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
