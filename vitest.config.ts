import path from 'node:path'
import { defineWorkersProject, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
// import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config' // Commented out
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineWorkersProject(async () => {
    const migrationsPath = path.join(__dirname, 'drizzle/migrations')
    const migrations = await readD1Migrations(migrationsPath)
    return {
        plugins: [tsconfigPaths()],
        test: {
            include: ['src/**/*.test.ts'],
            // Run migrations before tests
            setupFiles: ['./test/apply-migrations.ts'],
            globals: true,
            poolOptions: {
                workers: {
                    singleWorker: true,
                    miniflare: {
                        compatibilityDate: '2025-02-04', // From wrangler.toml
                        compatibilityFlags: ['nodejs_compat'], // From wrangler.toml
                        // Make D1 binding available in tests
                        d1Databases: ['DB'], // From wrangler.toml
                        // Bind migrations for setup
                        bindings: { TEST_MIGRATIONS: migrations }
                    }
                }
            }
        }
    }
}) 