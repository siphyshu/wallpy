import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import AuthShell from '@/components/auth/AuthShell';

export const metadata = { title: 'Choose a new password | Wallpy' };

export default function UpdatePasswordPage() {
  return (
    <AuthShell scene="night">
      <UpdatePasswordForm />
    </AuthShell>
  );
}
