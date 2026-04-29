import { type ComponentType, memo, useEffect, useState } from "react";
import { IconFile } from "@tabler/icons-react";
import { toTablerName } from "../lib/icons.js";

interface DynamicIconProps {
  name: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

// Cache of resolved icon components to avoid redundant dynamic imports
const iconCache = new Map<
  string,
  ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
>();

export const DynamicIcon = memo(function DynamicIcon({
  name,
  size = 16,
  color,
  style,
}: DynamicIconProps) {
  const [Icon, setIcon] = useState<ComponentType<{
    size?: number;
    color?: string;
    style?: React.CSSProperties;
  }> | null>(() => iconCache.get(name) ?? null);

  useEffect(() => {
    if (iconCache.has(name)) {
      setIcon(() => iconCache.get(name)!);
      return;
    }
    const componentName = toTablerName(name);
    import("@tabler/icons-react")
      .then((mod) => {
        const Comp = (mod as Record<string, unknown>)[componentName] as
          | ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>
          | undefined;
        if (Comp) {
          iconCache.set(name, Comp);
          setIcon(() => Comp);
        }
      })
      .catch(() => {});
  }, [name]);

  if (!Icon)
    return <IconFile size={size} {...(color ? { color } : {})} {...(style ? { style } : {})} />;
  return <Icon size={size} {...(color ? { color } : {})} {...(style ? { style } : {})} />;
});
