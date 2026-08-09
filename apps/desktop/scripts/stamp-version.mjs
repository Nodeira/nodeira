/**
 * Copies the root package.json version into apps/desktop/package.json.
 *
 * Electron Forge stamps artifact filenames, the Windows "Programs & Features" entry, the
 * .deb control file and the macOS bundle version from apps/desktop/package.json. But
 * semantic-release only bumps the ROOT manifest (.releaserc.json lists package.json as its
 * only versioned asset), so the desktop manifest sat at its scaffolded 0.0.1 forever —
 * v1.12.1 shipped assets literally named `Nodeira-0.0.1-arm64.dmg`.
 *
 * The release workflow checks the desktop job out at the release tag, and semantic-release
 * commits the bumped root manifest before creating that tag, so the root version is exactly
 * the release version at this point. Reading it here keeps one source of truth and avoids
 * threading a version string through YAML across bash and PowerShell runners.
 *
 * This intentionally writes to the working tree only — it is a build-time stamp, never
 * committed. Run it before `electron-forge make`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootManifest = path.resolve(desktopDir, "../../package.json");
const desktopManifest = path.join(desktopDir, "package.json");

const { version } = JSON.parse(fs.readFileSync(rootManifest, "utf8"));
if (!version) {
  console.error(`No version field in ${rootManifest}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(desktopManifest, "utf8"));
const previous = manifest.version;
manifest.version = version;
fs.writeFileSync(desktopManifest, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`apps/desktop version: ${previous} -> ${version}`);
