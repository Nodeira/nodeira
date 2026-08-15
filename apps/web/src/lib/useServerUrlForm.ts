import { useState } from "react";
import "./electronAPI.js";

/** Rejects anything that is not an absolute http(s) URL. */
const ABSOLUTE_HTTP_URL = /^https?:\/\/.+/;

export interface ServerUrlForm {
  url: string;
  setUrl: (value: string) => void;
  /** Validation message, or "" when the field is acceptable so far. */
  error: string;
  /** Stays true after a successful save — see the note on `save`. */
  loading: boolean;
  save: () => Promise<void>;
}

/**
 * State, validation and persistence for "which server am I talking to".
 *
 * The same twenty lines lived in `routes/connect.tsx`, `routes/_authenticated/settings.tsx`
 * and `components/ServerIndicator.tsx`. The three call sites look nothing alike — a full-page
 * form, a settings tab and a popover — so the shared piece is the behaviour, not a component.
 *
 * `loading` is never set back to false, in all three sites, and that is correct rather than a
 * leak: `setServerUrl` persists and then reloads the window, so the component is torn down.
 * Worth stating once here instead of leaving the same dangling flag to be re-derived at each
 * call site.
 */
export function useServerUrlForm(initialUrl = ""): ServerUrlForm {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save(): Promise<void> {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Server URL is required");
      return;
    }
    if (!ABSOLUTE_HTTP_URL.test(trimmed)) {
      setError("Enter a valid URL starting with http:// or https://");
      return;
    }
    setError("");
    setLoading(true);
    await window.electronAPI!.settings.setServerUrl(trimmed);
  }

  return { url, setUrl, error, loading, save };
}
