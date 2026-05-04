import { teardownDocsData } from "./helpers/seed";

export default async function globalTeardown() {
  await teardownDocsData();
}
