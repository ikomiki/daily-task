import type { ReactNode } from 'react';

export interface BannerProps {
  /** バナーのトーン（デフォルト: 'warning'） */
  tone?: 'warning' | 'info';
  /** true のとき点滅インジケーターを表示（デフォルト: false） */
  pulse?: boolean;
  children: ReactNode;
  role?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
}

/** オフライン状態や同期状態などを通知するバナーコンポーネント */
export function Banner({
  tone = 'warning',
  pulse = false,
  children,
  role = 'status',
  'aria-live': ariaLive = 'polite',
}: BannerProps) {
  const baseClass =
    tone === 'warning'
      ? 'inline-flex items-center gap-2.5 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-300'
      : 'inline-flex items-center gap-2.5 rounded-md border border-game-accent/40 bg-game-accent/8 px-3 py-2 text-sm text-game-accent';
  return (
    <div className={baseClass} role={role} aria-live={ariaLive}>
      {pulse && (
        <span
          aria-hidden="true"
          className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500 animate-pulse-dot"
        />
      )}
      {children}
    </div>
  );
}
