import type { ReactNode } from 'react';

// jsdom 環境用 @pixi/react スタブ。実 WebGL/Canvas 初期化を回避し、children だけ描画する。
export const Application = ({ children }: { children?: ReactNode }) => (
  <div data-testid="pixi-app">{children}</div>
);

export const extend = () => undefined;
