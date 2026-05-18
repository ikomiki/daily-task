import type React from 'react';
import type { ComponentType } from 'react';

export interface AppNavItem {
  /** リンク先のパス */
  to: string;
  /** ナビゲーション項目のラベル */
  label: string;
}

/** `linkComponent` に渡すコンポーネントが受け取るべき最小限の props */
export interface LinkComponentProps {
  to: string;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

export interface AppNavProps {
  /** ナビゲーション項目の配列 */
  items: ReadonlyArray<AppNavItem>;
  /**
   * リンクコンポーネント。TanStack Router の Link など、
   * `to` / `className` / `children` を受け取る任意のコンポーネントを渡す。
   * @org/ui をルーターに依存させないための注入口。
   */
  linkComponent: ComponentType<LinkComponentProps>;
  /** 現在のパス。アクティブ判定に使用（省略時は '' として扱う） */
  currentPath?: string;
  /** サインアウト処理。省略時はログアウトボタンを表示しない */
  onSignOut?: () => void;
  /** ナビゲーション領域のアクセシビリティラベル */
  'aria-label'?: string;
}

/** アクティブ状態かどうかを判定する純関数 */
export function isNavItemActive(itemTo: string, currentPath: string): boolean {
  if (itemTo === currentPath) {
    return true;
  }
  if (itemTo === '/') {
    return false;
  }
  return currentPath.startsWith(`${itemTo}/`);
}

// アクティブでないリンクのクラス
const linkClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-[13px] text-game-fg-muted transition-colors hover:text-game-fg hover:border-[#4a5364] no-underline';

// アクティブなリンクのクラス
const linkActiveClass =
  'inline-flex items-center gap-1.5 rounded-md border border-game-accent px-2.5 py-1 text-[13px] text-game-fg transition-colors bg-[color-mix(in_oklab,var(--color-game-accent)_8%,transparent)] no-underline';

// サインアウトボタンのクラス
const signOutClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1 text-[13px] text-game-fg-muted transition-colors hover:text-game-fg';

/** アプリ全体のグローバルナビゲーション */
export function AppNav({
  items,
  linkComponent: LinkComponent,
  currentPath,
  onSignOut,
  'aria-label': ariaLabel,
}: AppNavProps): React.ReactElement {
  const path = currentPath ?? '';
  return (
    <nav className="flex flex-wrap items-center gap-1.5 pb-1.5" aria-label={ariaLabel}>
      {items.map((item) => (
        <LinkComponent
          key={item.to}
          to={item.to}
          className={isNavItemActive(item.to, path) ? linkActiveClass : linkClass}
        >
          {item.label}
        </LinkComponent>
      ))}
      {onSignOut && (
        <button type="button" onClick={onSignOut} className={signOutClass}>
          ログアウト
        </button>
      )}
    </nav>
  );
}
