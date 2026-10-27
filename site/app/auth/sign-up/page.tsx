import { Suspense } from 'react';
import MultiStepSignUp from '@/components/auth/multi-step-sign-up';
import AuthShell from '@/components/auth/AuthShell';

export const metadata = { title: 'Sign up | Wallpy', robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell scene="dawn">
      {/* Reads ?redirect via useSearchParams, which needs a Suspense boundary to prerender */}
      <Suspense>
        <MultiStepSignUp />
      </Suspense>
    </AuthShell>
  );
}
