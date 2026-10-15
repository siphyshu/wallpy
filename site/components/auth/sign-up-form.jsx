"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SignUpForm({ className, ...props }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const supabase = createClient();

    if (password !== repeatPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username,
          },
        },
      });
      if (error) {
        setError(error.message || "An error occurred");
      } else {
        router.push("/auth/sign-up-success");
      }
    } catch (error) {
      setError(error.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className}`} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-serif">Join Wallpy</CardTitle>
          <CardDescription className="w-[70%]">
            Create your account to start sharing your dynamic wallpaper creations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setUsername(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">Confirm Password</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </div>
            <div className="mt-6 text-center text-sm text-white/70">
              Already have an account?{" "}
              <Link 
                href="/auth/login" 
                className="text-white hover:underline transition-colors"
              >
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 