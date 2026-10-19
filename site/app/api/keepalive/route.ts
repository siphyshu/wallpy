import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/**
 * Supabase's free plan pauses a project after about a week without requests.
 * Vercel Cron calls this once a day (vercel.json) with one cheap public read.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 401 });
  }
  const supabase = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
  const { error } = await supabase.from('packs').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
