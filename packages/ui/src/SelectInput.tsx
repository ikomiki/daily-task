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
      <span className="text-sm text-game-fg-muted">{label}</span>
      <select
        className={[
          'block w-full rounded-md border border-border-strong bg-transparent px-3 py-2 text-sm',
          'transition-colors hover:border-[#4d5667] focus:border-game-accent focus:outline-none',
          'appearance-none bg-no-repeat pr-8',
          "bg-[url(\"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D'http%3A//www.w3.org/2000/svg'%20width%3D'12'%20height%3D'12'%20viewBox%3D'0%200%2012%2012'%3E%3Cpath%20fill%3D'none'%20stroke%3D'%23a3a8b6'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%20d%3D'M3%204.5l3%203%203-3'/%3E%3C/svg%3E\")] bg-[right_10px_center]",
        ].join(' ')}
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
