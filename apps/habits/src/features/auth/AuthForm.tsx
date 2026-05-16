import { type FormEvent, useState } from 'react';

export interface AuthFormProps {
  submitLabel: string;
  onSubmit: (values: { email: string; password: string }) => void;
  errorMessage?: string;
  isSubmitting?: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// メールアドレスとパスワードのバリデーション
function validate(email: string, password: string): string | null {
  if (email.trim() === '') {
    return 'メールアドレスを入力してください。';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'メールアドレスの形式が正しくありません。';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは ${MIN_PASSWORD_LENGTH} 文字以上で入力してください。`;
  }
  return null;
}

export function AuthForm({
  submitLabel,
  onSubmit,
  errorMessage,
  isSubmitting = false,
}: AuthFormProps): React.ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const error = validate(email, password);
    if (error !== null) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    onSubmit({ email, password });
  };

  // クライアントバリデーションエラーを優先し、なければサーバー由来エラーを表示
  const displayError = validationError ?? errorMessage ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <label className="block space-y-1">
        <span className="text-sm font-medium">メールアドレス</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="block w-full rounded border border-gray-500 bg-transparent px-3 py-2"
        />
      </label>
      {displayError !== null && (
        <p role="alert" className="text-sm text-red-400">
          {displayError}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-game-accent px-4 py-2 font-medium text-game-bg disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
