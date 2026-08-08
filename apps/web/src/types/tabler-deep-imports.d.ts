/**
 * Types for @tabler/icons-react's per-icon deep imports.
 *
 * The package ships a single declaration file for its barrel and none for the individual
 * icon modules. We import icons one file at a time (see src/lib/iconMap.ts) specifically to
 * avoid that barrel, whose namespace re-export of ~5,900 icons cost a 3.7 MB chunk — so the
 * deep paths need declaring here.
 */
declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { ComponentType, CSSProperties } from "react";

  const Icon: ComponentType<{
    size?: number | string;
    color?: string;
    stroke?: number | string;
    strokeWidth?: number | string;
    className?: string;
    style?: CSSProperties;
  }>;

  export default Icon;
}
