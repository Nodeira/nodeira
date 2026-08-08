/**
 * Regenerates src/lib/iconMap.ts from the ICON_CATEGORIES list in src/lib/icons.ts.
 *
 * Run after adding or removing icons in the picker:
 *   node apps/web/scripts/gen-icon-map.mjs
 *
 * The map exists so DynamicIcon can resolve names without a dynamic import of
 * "@tabler/icons-react" — that barrel namespace-imports all ~5,900 icons, which cost a
 * 3.7 MB chunk. Names with no matching icon file are reported and skipped rather than
 * silently rendering the fallback, which is how thirteen dead entries went unnoticed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsSrc = path.join(webDir, "src/lib/icons.ts");
const outFile = path.join(webDir, "src/lib/iconMap.ts");
const iconDir = path.resolve(webDir, "../../node_modules/@tabler/icons-react/dist/esm/icons");

const toTabler = (kebab) =>
  "Icon" +
  kebab
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

const source = fs.readFileSync(iconsSrc, "utf8");
const names = [...new Set([...source.matchAll(/^\s*"([a-z0-9-]+)",?$/gm)].map((m) => m[1]))].sort();

const resolved = [];
const missing = [];
for (const name of names) {
  (fs.existsSync(path.join(iconDir, `${toTabler(name)}.mjs`)) ? resolved : missing).push(name);
}

if (missing.length > 0) {
  console.warn(`Skipping ${missing.length} name(s) with no icon in the package:`);
  console.warn(`  ${missing.join(", ")}`);
}

const imports = resolved
  .map((n) => `import ${toTabler(n)} from "@tabler/icons-react/dist/esm/icons/${toTabler(n)}.mjs";`)
  .join("\n");
const entries = resolved.map((n) => `  "${n}": ${toTabler(n)},`).join("\n");

fs.writeFileSync(
  outFile,
  `import type { ComponentType, CSSProperties } from "react";
${imports}

/**
 * Every icon the picker can offer, imported one file at a time.
 *
 * GENERATED. Regenerate with \`node scripts/gen-icon-map.mjs\` after editing
 * ICON_CATEGORIES in icons.ts.
 *
 * DynamicIcon previously resolved names at runtime with a dynamic import of
 * "@tabler/icons-react". That barrel begins with a namespace import over
 * ./icons/index.mjs — all ~5,900 icons — so the dynamic import pulled every one of them
 * into a chunk of its own: 3.7 MB, larger than the rest of the application combined, and
 * shipped inside the Android APK too, since the WebView editor bundles apps/web/dist.
 *
 * Deep imports bypass the barrel, so only the icons listed here reach the bundle.
 */
// Matches the ambient declaration in src/types/tabler-deep-imports.d.ts. Narrowing it
// here would make every generated entry fail to assign under exactOptionalPropertyTypes.
export type IconComponent = ComponentType<{
  size?: number | string;
  color?: string;
  stroke?: number | string;
  strokeWidth?: number | string;
  className?: string;
  style?: CSSProperties;
}>;

export const ICON_COMPONENTS: Record<string, IconComponent> = {
${entries}
};
`,
);

console.log(`Wrote ${resolved.length} icons to src/lib/iconMap.ts`);
