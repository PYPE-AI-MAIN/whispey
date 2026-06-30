import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Cover all src files except infrastructure that can't/shouldn't be unit tested.
      // These exclusions are mirrored in sonar-project.properties sonar.coverage.exclusions
      // so both tools measure exactly the same set of files.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Next.js pages, layouts, API routes (integration/E2E scope)
        'src/app/**',
        // UI components (shadcn boilerplate + product components)
        'src/components/**',
        // React hooks — data fetching, browser APIs, require jsdom
        'src/hooks/**',
        // React state / context
        'src/stores/**',
        'src/contexts/**',
        // Server-only DB repos
        'src/server/**',
        // Config constants — no logic
        'src/config/**',
        // Next.js middleware (Clerk integration)
        'src/middleware.ts',
        // Type-only files
        'src/types/**',
        'src/lib/adapters/types.ts',
        'src/lib/supabase-query-types.ts',
        // Supabase client factories — framework wrappers, not unit testable
        'src/lib/supabase-server.ts',
        'src/lib/supabase-select-auth.ts',
        'src/lib/supabase-select-client.ts',
        // Clerk auth — requires real Clerk context
        'src/lib/auth.ts',
        'src/lib/prod-auth.ts',
        // External service wrappers — Supabase queries, email, GitHub API
        'src/lib/user-data.ts',
        'src/lib/sendInviteEmail.ts',
        'src/lib/webhook-trigger.ts',
        'src/lib/getProjectRoleForApi.ts',
        'src/lib/calculateCost.ts',
        'src/lib/github-prompts.ts',
        // Fumadocs framework loader (6 lines, no logic)
        'src/lib/source.ts',
        // Browser-only utilities
        'src/utils/verifyDistinctConfig.ts',
        // Constants files — no logic to test
        'src/utils/constants.ts',
        'src/utils/campaigns/**',
        // Returns React/Lucide JSX — not testable in Node environment
        'src/utils/spanUtils.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
    env: {
      VAPI_MASTER_KEY: 'test-vapi-master-key-32-chars-long!!',
      WHISPEY_MASTER_KEY: 'test-whispey-master-key-32-chars!',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      OPENAI_API_KEY: 'test-openai-key',
    },
  },
})
