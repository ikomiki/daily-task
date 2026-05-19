import type React from 'react';
import { AlertText } from './AlertText.js';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** インプットのラベル文字列 */
  label: string;
  /** バリデーションエラーメッセージ（省略時は非表示） */
  errorMessage?: string;
}

/** ラベル付きテキストインプット。エラーメッセージをオプションで表示する */
export function TextInput({ label, errorMessage, ...rest }: TextInputProps): React.ReactElement {
  const inputClass = [
    'block w-full rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm',
    'transition-colors hover:border-[#4d5667] focus:border-game-accent focus:outline-none',
    'placeholder:text-game-fg-dim',
    errorMessage ? 'focus:border-cal-fail' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className="block space-y-1">
      <span className="text-sm text-game-fg-muted">{label}</span>
      <input className={inputClass} {...rest} />
      {errorMessage && <AlertText>{errorMessage}</AlertText>}
    </label>
  );
}
