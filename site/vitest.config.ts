import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // 'server-only' throws outside React Server Components; tests run in plain Node.
      'server-only': fileURLToPath(new URL('./tests/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // .env.local when present (enables the R2 integration test); placeholders
    // otherwise so modules that read lib/env load in CI.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      ...loadEnv(mode, process.cwd(), ''),
    },
  },
}));
