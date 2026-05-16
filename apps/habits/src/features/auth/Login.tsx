import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { signIn } from '../../lib/auth.js';
import { getAppSupabase } from '../../lib/supabase.js';
import { AuthForm } from './AuthForm.js';

export function Login(): React.ReactElement {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // メール/パスワードで signIn し、成功時は /today へ遷移、失敗時はエラー表示
  const handleSubmit = async (values: { email: string; password: string }): Promise<void> => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await signIn(getAppSupabase(), values.email, values.password);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    navigate({ to: '/today' });
  };

  // exactOptionalPropertyTypes: errorMessage は null のとき prop ごと省略する
  const errorProp = errorMessage !== null ? { errorMessage } : {};

  return (
    <section className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-2xl font-bold text-game-accent">ログイン</h1>
      <AuthForm
        submitLabel="ログイン"
        onSubmit={(values) => {
          void handleSubmit(values);
        }}
        {...errorProp}
        isSubmitting={isSubmitting}
      />
      <p className="text-sm">
        {/* /auth/signup は M3 後続タスクで router に追加される。それまで a タグで仮置き */}
        <a href="/auth/signup" className="text-game-accent underline">
          アカウントをお持ちでない方はこちら（新規登録）
        </a>
      </p>
    </section>
  );
}
