import Link from 'next/link';
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AuthShell from '@/components/auth/AuthShell';

export const metadata = { title: 'Check your email | Wallpy' };

export default function SignUpSuccessPage() {
  return (
    <AuthShell scene="dawn">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-serif">Check Your Email</CardTitle>
              <CardDescription>
                We&apos;ve sent you a confirmation link to verify your email address.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-white/70 mb-6">
                Please check your email and click the verification link to complete your registration.
              </p>
              <div className="space-y-3">
                <Link href="/auth/login" className={buttonVariants({ className: "w-full" })}>
                  Back to Sign In
                </Link>
                <Link href="/" className={buttonVariants({ variant: "secondary", className: "w-full" })}>
                  Go to Homepage
                </Link>
              </div>
            </CardContent>
          </Card>
    </AuthShell>
  );
} 