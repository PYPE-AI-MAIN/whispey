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
      include: [
        'src/lib/crypto.ts',
        'src/lib/whispey-crypto.ts',
        'src/lib/response.ts',
        'src/lib/transcriptProcessor.ts',
        'src/lib/utils.ts',
        'src/lib/serviceToken.ts',
        'src/lib/serviceTokenVerifier.ts',
        'src/lib/serviceTokenVerifier.ts',
        'src/lib/pypeApiFetch.ts',
        'src/lib/redactCallLogsTagsForViewer.ts',
        'src/lib/vapi-encryption.ts',
        'src/lib/api-key-management.ts',
        'src/lib/elevenlabs-webhook.ts',
        'src/lib/vapi-data-transformer.ts',
        'src/lib/adapters/retell.adapter.ts',
        'src/utils/variableValidator.ts',
        'src/utils/callLogsUtils.ts',
        'src/utils/cost.ts',
        'src/utils/customTotalExportFilters.ts',
        'src/utils/agentDetection.ts',
        'src/lib/github-prompts.ts',
        'src/lib/supplementalSettings.ts',
        'src/lib/agentVersionHelpers.ts',
        'src/middleware.ts',
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
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
