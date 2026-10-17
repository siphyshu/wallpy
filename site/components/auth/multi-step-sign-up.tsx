"use client";
import type { ComponentProps, FormEvent } from 'react';
import { errorMessage } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeRedirectPath, withRedirect } from '@/lib/safe-redirect';
import { USERNAME_RULE, signUpErrorMessage, usernameProblem } from '@/lib/username';
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
  const [availability, setAvailability] = useState<{ username: string; state: 'available' | 'taken' | 'unknown' } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const redirect = safeRedirectPath(redirectParam, '/gallery');
  const [supabase] = useState(createClient);

  // Check the username as they type (debounced). Profiles are public, so the
  // anon client can look a username up; the trigger still has the final say.
  const usernameError = usernameProblem(username);
  const usernameOk = username.length > 0 && !usernameError;
  useEffect(() => {
    if (!usernameOk) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
      if (!cancelled) setAvailability({ username, state: error ? 'unknown' : data ? 'taken' : 'available' });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [username, usernameOk, supabase]);
  const check = availability?.username === username ? availability.state : 'checking';
  const usernameStatus: { text: string; className: string } = usernameError
    ? { text: usernameError, className: 'text-red-400' }
    : !usernameOk || check === 'unknown'
      ? { text: USERNAME_RULE, className: 'text-white/50' }
      : check === 'checking'
        ? { text: 'Checking…', className: 'text-white/50' }
        : check === 'taken'
          ? { text: 'That username is taken', className: 'text-red-400' }
          : { text: 'Available', className: 'text-green-400' };
  // Only a username known to be unusable blocks the button (the message under
  // the field says why); a failed or unfinished lookup falls back to the
  // friendly submit error.
  const canSubmit = !usernameError && !(usernameOk && check === 'taken');

  // Step 1: Basic info
  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, username },
        },
      });
      if (error) throw error;
      setStep(2);
    } catch (err) {
      setError(signUpErrorMessage(errorMessage(err, 'Sign up failed')));
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
      router.push(redirect);
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
                    maxLength={60}
                    autoComplete="name"
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
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={30}
                    aria-invalid={!!usernameError || check === 'taken'}
                    aria-describedby="username-status"
                    value={username}
                    // The database stores usernames lowercase; show that as they type.
                    onChange={e => setUsername(e.target.value.toLowerCase())}
                  />
                  <p id="username-status" aria-live="polite" className={`text-xs ${usernameStatus.className}`}>
                    {usernameStatus.text}
                  </p>
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
                <Button type="submit" className="w-full" disabled={isLoading || !canSubmit}>
                  {isLoading ? 'Signing up...' : 'Sign Up'}
                </Button>
              </form>
              <div className="mt-6 text-center text-sm text-white/70">
                Already have an account?{" "}
                <Link 
                  href={withRedirect('/auth/login', redirectParam)}
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