import type { ComponentType, ReactNode } from 'react';
import type { LinkComponentProps } from './AppNav.js';

export interface TopBarProps {
  /** ホームリンクの遷移先（デフォルト: '/today'） */
  homeHref?: string;
  /** ホームリンクのラベル（デフォルト: 'habits'） */
  homeLabel?: string;
  /** リンクコンポーネント。@org/ui をルーターに依存させないための注入口 */
  linkComponent: ComponentType<LinkComponentProps>;
  /** ヘッダー右側に配置するスロット（省略可） */
  rightSlot?: ReactNode;
}

/** アプリ最上部に固定表示するトップバー */
export function TopBar({
  homeHref = '/today',
  homeLabel = 'habits',
  linkComponent: LinkComp,
  rightSlot,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border-default backdrop-blur-md bg-[color-mix(in_oklab,var(--color-game-bg)_82%,transparent)]">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 py-3">
        <LinkComp
          to={homeHref}
          className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-wide text-game-fg no-underline"
          aria-label="habits ホーム"
        >
          <span
            aria-hidden="true"
            className="relative inline-block h-[18px] w-[18px] rounded-[5px] bg-game-accent after:absolute after:inset-1 after:rounded-[2px] after:bg-game-bg"
          />
          <span>
            {homeLabel}
            <em className="not-italic text-game-accent">.</em>
          </span>
        </LinkComp>
        {rightSlot}
      </div>
    </header>
  );
}
