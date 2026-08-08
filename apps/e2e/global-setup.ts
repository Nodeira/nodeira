import { seedDocsData } from "./helpers/seed";

const API = process.env["API_BASE_URL"] ?? "http://localhost:3001";
const EMAIL = process.env["E2E_EMAIL"] ?? "e2e@example.com";
const PASSWORD = process.env["E2E_PASSWORD"] ?? "e2e-password-123";

/**
 * Ensures the API is reachable and the e2e account exists, then seeds fixture data.
 *
 * The old health check fetched /api/v1/vaults unauthenticated and treated a non-2xx as
 * "server unreachable". That route is guarded, so once multi-user landed it always
 * returned 401 and the suite failed with a misleading "Run pnpm dev" message. It uses the
 * unauthenticated setup/status endpoint now, and runs first-time setup when the instance
 * is empty so a fresh CI database works with no manual step.
 */
export default async function globalSetup() {
  let status: { setupRequired: boolean };
  try {
    const res = await fetch(`${API}/api/v1/setup/status`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    status = (await res.json()) as { setupRequired: boolean };
  } catch (err) {
    throw new Error(
      `Cannot reach Nodeira API at ${API}.
Run 'pnpm dev' before running e2e tests.
Original: ${String(err)}`,
    );
  }

  if (status.setupRequired) {
    const res = await fetch(`${API}/api/v1/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "E2E" }),
    });
    if (!res.ok) {
      throw new Error(`First-time setup failed with status ${res.status}`);
    }
  }

  await seedDocsData();
}
