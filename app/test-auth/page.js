"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import NavBar from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAuthPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const isAuthenticated = !!user;

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
        <NavBar />
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/70">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
      <NavBar />
      <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-serif">Auth Test</CardTitle>
              <CardDescription>
                Testing authentication state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/70">Authentication Status:</p>
                  <p className="font-medium">
                    {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
                  </p>
                </div>
                
                {user && (
                  <div>
                    <p className="text-sm text-white/70">User Info:</p>
                    <div className="text-sm space-y-1">
                      <p><strong>Name:</strong> {user.user_metadata?.name || 'N/A'}</p>
                      <p><strong>Email:</strong> {user.email || 'N/A'}</p>
                      <p><strong>Username:</strong> {user.user_metadata?.username || 'N/A'}</p>
                      <p><strong>ID:</strong> {user.id || 'N/A'}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-white/70">User Object:</p>
                  <pre className="text-xs bg-black/20 p-2 rounded overflow-auto">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 