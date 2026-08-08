import { useEffect, useRef } from "react";
import { acquireYjsContext, releaseYjsContext, type YjsContext } from "./YjsProvider.js";

/**
 * Holds a reference to a note's Yjs context for the lifetime of the calling component.
 *
 * The acquire happens during render because callers need the Y.Doc synchronously to
 * construct the TipTap editor, and the release happens in an effect cleanup. That is an
 * inherently lopsided pairing, so the two guards below matter:
 *
 *  - `held` makes the render-phase acquire idempotent. Without it every re-render would
 *    take another reference and the count would never fall back to zero.
 *  - The effect re-acquires when `held` has been cleared. StrictMode runs an effect's
 *    cleanup and then re-runs the effect *without* re-rendering, so the render-phase
 *    acquire is not repeated and the reference released by that cleanup has to be
 *    retaken here.
 *
 * The cleanup releases the id captured in its own closure rather than whatever `held`
 * currently points at, so a note-to-note navigation releases the old id and not the new.
 */
export function useYjsContext(noteId: string): YjsContext {
  const held = useRef<string | null>(null);
  const ctxRef = useRef<YjsContext | null>(null);

  if (held.current !== noteId) {
    ctxRef.current = acquireYjsContext(noteId);
    held.current = noteId;
  }

  useEffect(() => {
    if (held.current !== noteId) {
      ctxRef.current = acquireYjsContext(noteId);
      held.current = noteId;
    }
    return () => {
      releaseYjsContext(noteId);
      if (held.current === noteId) held.current = null;
    };
  }, [noteId]);

  return ctxRef.current!;
}
