/**
 * Fails the process at boot on bad configuration instead of at the first request.
 *
 * JWT_SECRET was read as `config.get<string>("JWT_SECRET")!` in two places. With the value
 * missing, that `!` handed `undefined` to JwtModule, which signed tokens with an undefined
 * secret and misbehaved later, at request time, with no hint as to why.
 */
export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];

  const databaseUrl = raw["DATABASE_URL"];
  if (typeof databaseUrl !== "string" || databaseUrl.length === 0) {
    problems.push("DATABASE_URL is required");
  }

  const jwtSecret = raw["JWT_SECRET"];
  if (typeof jwtSecret !== "string" || jwtSecret.length === 0) {
    problems.push("JWT_SECRET is required (generate one with: openssl rand -hex 32)");
  } else if (jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters");
  } else if (jwtSecret === "change-me-to-a-long-random-secret") {
    // The value shipped in .env.example. Anyone who copied it and never edited it is
    // running with a publicly known signing key.
    problems.push("JWT_SECRET is still the example value from .env.example — change it");
  }

  const port = raw["PORT"];
  if (port !== undefined && Number.isNaN(Number(port))) {
    problems.push(`PORT must be a number, got "${String(port)}"`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  }

  return raw;
}
