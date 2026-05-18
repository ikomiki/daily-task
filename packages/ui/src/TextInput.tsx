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
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        {...rest}
      />
      {errorMessage && <AlertText>{errorMessage}</AlertText>}
    </label>
  );
}
