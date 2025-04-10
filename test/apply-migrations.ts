import { beforeEach } from 'vitest'
// Correct import source for the setup file context!
import { env, applyD1Migrations } from 'cloudflare:test'

// Optional: Define types if needed
// declare module 'vitest' {
//     interface ProvidedContext {
//         TEST_MIGRATIONS: unknown
//     }
// }

beforeEach(async () => { // Use beforeEach
    // Check if the TEST_MIGRATIONS binding (from vitest.config.ts) exists in the environment
    if (env.TEST_MIGRATIONS) {
        // Apply migrations to the 'DB' binding (ensure 'DB' matches wrangler.toml/vitest.config.ts)
        // Use the correctly imported applyD1Migrations function
        await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
    } else {
        console.warn("TEST_MIGRATIONS binding not found. Skipping migrations.");
    }
}) 