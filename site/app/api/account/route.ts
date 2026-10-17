import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deletePrefix } from '@/lib/r2';

/**
 * Delete the signed-in user's account. delete_my_account() works from the
 * session's user id (never from the body): it removes the auth user, profile,
 * favourites and unpublished packs, and published packs unless they're kept
 * (then they stay up, credited to "deleted user"). Then the avatar/cover files
 * go from R2 and the session is ended. Pack images are shared by hash and stay.
 *
 * Body: { username, keepPublished }  ->  { ok: true }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.keepPublished !== 'boolean') {
    return NextResponse.json({ error: 'Choose what happens to your published packs.' }, { status: 400 });
  }
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
  if (!profile || typeof body.username !== 'string' || body.username.trim().toLowerCase() !== profile.username) {
    return NextResponse.json({ error: 'Type your username to confirm.' }, { status: 400 });
  }

  const { error } = await supabase.rpc('delete_my_account', { p_keep_published: body.keepPublished });
  if (error) {
    console.error('delete_my_account:', error);
    return NextResponse.json({ error: 'Could not delete your account.' }, { status: 500 });
  }
  try {
    await deletePrefix(`profiles/${user.id}/`);
  } catch (e) {
    // The account is gone either way; orphaned images are unreachable from the site.
    console.error('delete account images:', e);
  }
  // The auth user no longer exists; drop the session cookies.
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
