import { seedDocsData } from "./helpers/seed";

export default async function globalSetup() {
  const API = process.env["API_BASE_URL"] ?? "http://localhost:3001";
  try {
    const res = await fetch(`${API}/api/v1/vaults`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    throw new Error(
      `Cannot reach Nodeira API at ${API}.\nRun 'pnpm dev' before running e2e tests.\nOriginal: ${String(err)}`,
    );
  }
  await seedDocsData();
}
