import { memo } from "react";
import IconFile from "@tabler/icons-react/dist/esm/icons/IconFile.mjs";
import { ICON_COMPONENTS } from "../lib/iconMap.js";

interface DynamicIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Renders one of the picker's icons by kebab-case name.
 *
 * This used to resolve names at runtime via `await import("@tabler/icons-react")`, cached
 * in a Map and rendered through state. That pulled the entire icon package — a 3.7 MB
 * chunk — and made every icon render asynchronously, flashing the fallback first. The set
 * of names the picker can produce is a fixed list, so a generated lookup covers it with no
 * dynamic import, no state, no effect, and no flash.
 */
export const DynamicIcon = memo(function DynamicIcon({
  name,
  size = 16,
  color,
  style,
}: DynamicIconProps) {
  const Icon = ICON_COMPONENTS[name] ?? IconFile;
  return <Icon size={size} {...(color ? { color } : {})} {...(style ? { style } : {})} />;
});
