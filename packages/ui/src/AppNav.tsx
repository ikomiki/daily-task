import type React from 'react';

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
}

export interface AppNavProps {
  /** ナビゲーション項目の配列 */
  items: ReadonlyArray<AppNavItem>;
  /**
   * リンクコンポーネント。TanStack Router の Link など、
   * `to` / `className` / `children` を受け取る任意のコンポーネントを渡す。
   * @org/ui をルーターに依存させないための注入口。
   */
  linkComponent: React.ComponentType<LinkComponentProps>;
  /** サインアウト処理。省略時はログアウトボタンを表示しない */
  onSignOut?: () => void;
  /** ナビゲーション領域のアクセシビリティラベル */
  'aria-label'?: string;
}

/** アプリ全体のグローバルナビゲーション */
export function AppNav({
  items,
  linkComponent: LinkComponent,
  onSignOut,
  'aria-label': ariaLabel,
}: AppNavProps): React.ReactElement {
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label={ariaLabel}>
      {items.map((item) => (
        <LinkComponent
          key={item.to}
          to={item.to}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          {item.label}
        </LinkComponent>
      ))}
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="rounded border border-gray-500 px-3 py-1 text-sm"
        >
          ログアウト
        </button>
      )}
    </nav>
  );
}
