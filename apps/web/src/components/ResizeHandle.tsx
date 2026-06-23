import { useRef, useState } from "react";

interface ResizeHandleProps {
  width: number;
  setWidth: (w: number) => void;
  /** Which panel this handle resizes — determines edge placement and drag direction. */
  panel: "navbar" | "aside";
  min?: number;
  max?: number;
  /** Distance from the top of the viewport (header height). */
  top?: number;
}

/**
 * A thin fixed-position vertical strip sitting on the inner edge of the navbar/aside.
 * Dragging it left/right resizes the panel via [setWidth] (clamped to [min, max]).
 */
export function ResizeHandle({
  width,
  setWidth,
  panel,
  min = 200,
  max = 560,
  top = 48,
}: ResizeHandleProps) {
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    drag.current = { x: e.clientX, w: width };
    setActive(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMove = (ev: PointerEvent) => {
      if (!drag.current) return;
      const dx = ev.clientX - drag.current.x;
      // navbar grows when dragging right; aside grows when dragging left.
      const next = panel === "navbar" ? drag.current.w + dx : drag.current.w - dx;
      setWidth(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => {
      drag.current = null;
      setActive(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => !drag.current && setActive(false)}
      title="Drag to resize"
      style={{
        position: "fixed",
        top,
        bottom: 0,
        [panel === "navbar" ? "left" : "right"]: width - 3,
        width: 6,
        cursor: "col-resize",
        zIndex: 250,
        touchAction: "none",
        background: active ? "var(--mantine-primary-color-filled)" : "transparent",
        opacity: active ? 0.5 : 1,
        transition: "background 120ms ease",
      }}
    />
  );
}
