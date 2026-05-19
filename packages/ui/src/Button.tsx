import type React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** ボタンのスタイルバリアント（デフォルト: 'secondary'） */
  variant?: 'primary' | 'secondary' | 'destructive';
  /** ボタンのサイズ（デフォルト: 'md'） */
  size?: 'sm' | 'md';
  /** true のとき w-full を適用してブロック表示にする（デフォルト: false） */
  block?: boolean;
}

// 共通クラス（全バリアント共通）
const baseClass =
  'inline-flex items-center justify-center gap-1.5 rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-game-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px';

// バリアントとサイズの組み合わせによるクラス定義
const variantSizeClass: Record<
  NonNullable<ButtonProps['variant']>,
  Record<NonNullable<ButtonProps['size']>, string>
> = {
  primary: {
    md: 'bg-game-accent text-game-bg border-transparent font-semibold px-3.5 py-1.5 text-sm hover:bg-game-accent/90',
    sm: 'bg-game-accent text-game-bg border-transparent font-semibold px-2.5 py-1 text-xs hover:bg-game-accent/90',
  },
  secondary: {
    md: 'border-border-strong bg-transparent text-game-fg px-3.5 py-1.5 text-sm hover:bg-surface-2 hover:border-[#5b657a]',
    sm: 'border-border-strong bg-transparent text-game-fg px-2.5 py-1 text-xs hover:bg-surface-2 hover:border-[#5b657a]',
  },
  destructive: {
    md: 'border-cal-fail/60 bg-transparent text-red-300 px-3.5 py-1.5 text-sm hover:bg-cal-fail/10 hover:border-cal-fail/70',
    sm: 'border-cal-fail/60 bg-transparent text-red-300 px-2.5 py-1 text-xs hover:bg-cal-fail/10 hover:border-cal-fail/70',
  },
};

/** 汎用ボタンコンポーネント。variant / size で外観を切り替える */
export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  ...rest
}: ButtonProps): React.ReactElement {
  const variantClass = variantSizeClass[variant][size];
  const blockClass = block ? ' w-full' : '';
  const cls = `${baseClass} ${variantClass}${blockClass}${className ? ` ${className}` : ''}`;
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}
