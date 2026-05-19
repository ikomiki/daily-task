import { AlertText, Button, TextInput } from '@org/ui';
import { type FormEvent, useState } from 'react';

export interface AuthFormProps {
  submitLabel: string;
  onSubmit: (values: { email: string; password: string }) => void;
  errorMessage?: string;
  isSubmitting?: boolean;
  passwordAutoComplete?: 'current-password' | 'new-password';
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
  passwordAutoComplete = 'current-password',
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
      <TextInput
        type="email"
        label="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
      />
      <TextInput
        type="password"
        label="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={passwordAutoComplete}
        placeholder="6 文字以上"
      />
      {displayError !== null && <AlertText>{displayError}</AlertText>}
      <Button type="submit" variant="primary" block disabled={isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}
