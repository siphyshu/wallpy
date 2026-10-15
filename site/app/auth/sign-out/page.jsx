'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignOut() {
  const router = useRouter();

  useEffect(() => {
    createClient().auth.signOut().then(() => router.push('/'));
  }, [router]);

  return null;
}
