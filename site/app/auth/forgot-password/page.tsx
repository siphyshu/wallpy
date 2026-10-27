import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import AuthShell from '@/components/auth/AuthShell';

export const metadata = { title: 'Reset your password | Wallpy', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell scene="night">
          <ForgotPasswordForm />
    </AuthShell>
  );
} 