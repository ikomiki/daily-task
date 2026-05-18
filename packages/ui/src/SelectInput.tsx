import type React from 'react';
import { AlertText } from './AlertText.js';

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** セレクトのラベル文字列 */
  label: string;
  /** 選択肢の配列。各要素は { value, label } を持つ */
  options: ReadonlyArray<{ value: string; label: string }>;
  /** エラーメッセージ。指定時は select の直後に赤いテキストで表示される */
  errorMessage?: string;
}

/** ラベル付きセレクトインプット */
export function SelectInput({
  label,
  options,
  errorMessage,
  ...rest
}: SelectInputProps): React.ReactElement {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <select
        className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {errorMessage && <AlertText>{errorMessage}</AlertText>}
    </label>
  );
}
