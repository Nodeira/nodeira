/**
 * Gathers the desktop build into out/release/ under stable, version-less names, and
 * produces the portable .zip itself.
 *
 * Three reasons this exists:
 *
 *  1. Permalinks. https://github.com/<owner>/<repo>/releases/latest/download/<asset>
 *     only resolves if the asset filename is byte-identical across releases. Forge names
 *     its output after apps/desktop/package.json's version, so the names churned every
 *     release — and were wrong besides, since semantic-release only bumps the root
 *     manifest, leaving them reading 0.0.1 while the release itself was 1.12.1.
 *
 *  2. The release workflow used to upload `out/make/**` wholesale. On Windows the Squirrel
 *     maker also emits an unpacked `nodeira-<version>-full/lib/net45/` tree — hundreds of
 *     .pak, .dll and locale files that would all have been attached to the release.
 *
 *  3. A guaranteed artifact per platform. The Squirrel maker shells out to bundled .exe
 *     helpers and has failed on GitHub's Windows runners with "The system cannot find the
 *     file specified" while succeeding on local Windows; @electron-forge/maker-zip is no
 *     help because cross-zip's Windows branch calls fs.rmdir(recursive), removed in Node
 *     22. Zipping the packaged directory here depends on neither.
 *
 * Written in Node rather than shell because the release matrix spans ubuntu/macos/windows
 * runners, where `run:` steps get bash on two of them and PowerShell on the third — the
 * same reasoning as scripts/mobile-run.mjs at the repo root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const makeDir = path.join(desktopDir, "out", "make");
const outDir = path.join(desktopDir, "out", "release");

// Each matrix job builds only for its own host, so the runner's own platform/arch is a
// more reliable label than parsing Forge's directory layout.
const suffix = `${process.platform}-${process.arch}`;

/** Installer extensions worth publishing -> stable basename. */
const INSTALLER_NAMES = {
  ".exe": `Nodeira-${suffix}-Setup.exe`,
  ".dmg": `Nodeira-${suffix}.dmg`,
  ".deb": `Nodeira-${suffix}.deb`,
  ".rpm": `Nodeira-${suffix}.rpm`,
};

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip Squirrel's unpacked staging tree — it is full of .exe/.dll noise that would
      // otherwise match the .exe rule above.
      if (entry.name.endsWith("-full")) continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

/** Zips a directory's contents, preserving symlinks (macOS .app bundles rely on them). */
function zipDirectory(sourceDir, destZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destZip);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve(archive.pointer()));
    archive.on("warning", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, path.basename(sourceDir));
    void archive.finalize();
  });
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const collected = [];

// ── Installers produced by Forge makers ──────────────────────────────────────
if (fs.existsSync(makeDir)) {
  for (const file of walk(makeDir)) {
    const base = path.basename(file);
    // Squirrel.Windows' update feed (update.electronjs.org) reads RELEASES and the
    // full nupkg directly off the GitHub release, under their original names — unlike
    // the installers below, these can't be renamed per-platform.
    const isSquirrelUpdatePayload = base === "RELEASES" || path.extname(base) === ".nupkg";
    const target = isSquirrelUpdatePayload ? base : INSTALLER_NAMES[path.extname(file).toLowerCase()];
    if (!target) continue; // .zip from a maker, etc.
    const dest = path.join(outDir, target);
    if (fs.existsSync(dest)) {
      console.warn(`! ${target} already collected; ignoring duplicate ${file}`);
      continue;
    }
    fs.copyFileSync(file, dest);
    collected.push(target);
    console.log(`${path.relative(desktopDir, file)}  ->  out/release/${target}`);
  }
} else {
  console.warn(`No maker output at ${makeDir} — continuing with the portable archive only.`);
}

// ── Portable archive, built from the packaged app directory ──────────────────
const packagedDir = fs
  .readdirSync(path.join(desktopDir, "out"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name.startsWith(`Nodeira-${process.platform}-`))
  .map((e) => path.join(desktopDir, "out", e.name))[0];

if (packagedDir) {
  const zipName = `Nodeira-${suffix}.zip`;
  const bytes = await zipDirectory(packagedDir, path.join(outDir, zipName));
  collected.push(zipName);
  console.log(
    `${path.relative(desktopDir, packagedDir)}  ->  out/release/${zipName} ` +
      `(${(bytes / 1024 / 1024).toFixed(1)} MB)`,
  );
} else {
  console.warn("No packaged app directory found under out/ — skipping the portable archive.");
}

if (collected.length === 0) {
  console.error("No distributable artifacts found — refusing to publish an empty release.");
  process.exit(1);
}

console.log(`\nCollected ${collected.length} artifact(s) for ${suffix}.`);
