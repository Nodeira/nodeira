/**
 * Supplies the configuration `validateEnv` demands, before any spec is imported.
 *
 * `ConfigModule.forRoot({ validate })` is an argument to `@Module()`, so validation runs
 * when `app.module.ts` is *imported* — before any test body, and before `createTestApp`
 * gets a chance to set anything. Locally that passed because `apps/api/.env` exists and
 * ConfigModule loads it; CI has no such file, so the suite failed at collection there and
 * nowhere else. Setup files run before spec modules are imported, which is early enough.
 *
 * DATABASE_URL here is only a placeholder to satisfy validation. `createTestApp` replaces
 * it with the Testcontainers URL before Nest constructs PrismaService, which is what
 * actually connects.
 */
process.env["JWT_SECRET"] ||= "test-secret-that-is-long-enough-for-validation";
process.env["DATABASE_URL"] ||= "postgresql://placeholder@127.0.0.1:5432/placeholder";
