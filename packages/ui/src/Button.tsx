import type React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** ボタンのスタイルバリアント（デフォルト: 'secondary'） */
  variant?: 'primary' | 'secondary' | 'destructive';
  /** ボタンのサイズ（デフォルト: 'md'） */
  size?: 'sm' | 'md';
}

// バリアントとサイズの組み合わせによるクラス定義
const variantSizeClass: Record<
  NonNullable<ButtonProps['variant']>,
  Record<NonNullable<ButtonProps['size']>, string>
> = {
  primary: {
    md: 'rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50',
    sm: 'rounded bg-game-accent px-3 py-1 text-sm font-medium text-game-bg disabled:opacity-50',
  },
  secondary: {
    md: 'rounded border border-gray-500 px-3 py-1 text-sm',
    sm: 'rounded border border-gray-500 px-3 py-1 text-sm',
  },
  destructive: {
    md: 'rounded border border-red-500 px-3 py-1 text-sm text-red-400',
    sm: 'rounded border border-red-500 px-3 py-1 text-sm text-red-400',
  },
};

/** 汎用ボタンコンポーネント。variant / size で外観を切り替える */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  ...rest
}: ButtonProps): React.ReactElement {
  const base = variantSizeClass[variant][size];
  const cls = className ? `${base} ${className}` : base;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
