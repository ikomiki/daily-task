import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite } from 'pixi.js';
import type { ReactNode } from 'react';

// @pixi/react にPixi要素を登録（v8の必須API）
extend({ Container, Graphics, Sprite });

interface GameCanvasProps {
  width: number;
  height: number;
  children?: ReactNode;
}

// Pixi.js Applicationをマウントする最小コンポーネント。
// アプリ側でこの中にPixi要素を子として配置する。
export const GameCanvas = ({ width, height, children }: GameCanvasProps) => (
  <Application width={width} height={height} background="#0b0d12">
    {children}
  </Application>
);
