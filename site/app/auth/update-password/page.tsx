import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata = { title: 'Choose a new password | Wallpy' };

export default function UpdatePasswordPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <UpdatePasswordForm />
        </div>
      </div>
    </div>
  );
} 