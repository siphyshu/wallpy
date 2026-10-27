import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import AuthShell from '@/components/auth/AuthShell';

export const metadata = { title: 'Sign in | Wallpy', robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell scene="dusk">
      {/* LoginForm reads ?redirect via useSearchParams, which needs a Suspense boundary to prerender */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
