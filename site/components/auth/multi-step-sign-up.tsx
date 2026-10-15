"use client";
import type { ComponentProps, FormEvent } from 'react';
import { errorMessage } from '@/lib/utils';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function MultiStepSignUp({ className, ...props }: ComponentProps<'div'>) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Step 1: Basic info
  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, username },
        },
      });
      if (error) throw error;
      setStep(2);
    } catch (err) {
      setError(errorMessage(err, 'Sign up failed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: OTP
  const handleVerifyOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });
      if (error) throw error;
      router.push('/gallery');
    } catch (err) {
      setError(errorMessage(err, 'OTP verification failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 w-full ${className}`} {...props}>
      <Card>
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Join Wallpy</CardTitle>
              <CardDescription className="w-[70%]">
                Create your account to start sharing your dynamic wallpaper creations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="johndoe"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing up...' : 'Sign Up'}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm text-white/70">
                Already have an account?{" "}
                <Link 
                  href="/auth/login" 
                  className="text-white hover:underline transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </>
        )}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Enter OTP</CardTitle>
              <CardDescription className="w-[70%]">
                Enter the code sent to your email to verify your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="otp">OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter the OTP"
                    required
                    value={otp}
                    onChange={e => setOtp(e.target.value)}
                  />
                </div>
                {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify'}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
} 