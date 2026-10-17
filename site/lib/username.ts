// Usernames, as the database enforces them (profiles.username check + unique;
// the handle_new_user trigger lowercases and trims what sign-up sends).

export const USERNAME_RULE = '3–30 characters: lowercase letters, numbers and underscores';

/** What's wrong with a username, or null when it's well formed. */
export function usernameProblem(username: string): string | null {
  if (username.length === 0) return null;
  if (/[^a-z0-9_]/.test(username)) {
    return /\s/.test(username)
      ? 'No spaces: use an underscore instead'
      : 'Only lowercase letters, numbers and underscores';
  }
  if (username.length < 3) return 'At least 3 characters';
  if (username.length > 30) return 'At most 30 characters';
  return null;
}

/** Turns Supabase's sign-up errors into something a person can act on. */
export function signUpErrorMessage(message: string | undefined): string {
  if (!message) return 'Sign up failed';
  // The profile insert (in the signup trigger) failed: in practice a username
  // that's malformed or was taken between the check and the submit.
  if (/database error saving new user/i.test(message)) {
    return 'That username can’t be used (it may have just been taken). Try another one.';
  }
  if (/already registered|already been registered/i.test(message)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  return message;
}
