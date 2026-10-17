import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: 'Reset your password | Wallpy' };

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
} 