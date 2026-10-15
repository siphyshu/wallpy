// Returns `path` only if it is a same-site path, otherwise `fallback`.
// Rejects "https://evil.com", "//evil.com" and "/\evil.com", which would turn a
// post-login redirect into an open redirect.
export function safeRedirectPath(path: string | null | undefined, fallback = '/'): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback;
  }
  return path;
}
