"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-x-hidden text-white bg-background/80">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/70">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return children;
} 