// Environment variables, read once and checked. A missing variable fails with
// its name instead of surfacing later as an opaque 500.
//
// NEXT_PUBLIC_* values must be referenced literally (process.env.NEXT_PUBLIC_X)
// so Next.js can inline them into browser bundles.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name} (see site/README.md)`);
  return value;
}

export const publicEnv = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  filesBaseUrl: (process.env.NEXT_PUBLIC_FILES_BASE_URL || '/api/dev-files').replace(/\/$/, ''),
};

/** Server-only secrets. Functions, so importing this module never throws in the browser. */
export const serverEnv = {
  serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  r2Endpoint: () => required('R2_ENDPOINT', process.env.R2_ENDPOINT),
  r2AccessKeyId: () => required('R2_ACCESS_KEY_ID', process.env.R2_ACCESS_KEY_ID),
  r2SecretAccessKey: () => required('R2_SECRET_ACCESS_KEY', process.env.R2_SECRET_ACCESS_KEY),
  downloadHashSecret: () => required('DOWNLOAD_HASH_SECRET', process.env.DOWNLOAD_HASH_SECRET),
};
