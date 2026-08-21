import { useCallback, useEffect, useRef, useState } from "react";

export type UpdateInfo = { version: string; notes: string };

export type DesktopUpdateState =
  | { status: "idle" }
  | { status: "available"; info: UpdateInfo }
  | { status: "downloading"; info: UpdateInfo }
  | { status: "downloaded"; info: UpdateInfo }
  | { status: "error"; message: string };

/**
 * Wires up window.electronAPI.update's event subscriptions and exposes the state machine
 * driving UpdateAvailableModal. No-ops (state stays "idle") outside the desktop app.
 */
export function useDesktopAutoUpdate() {
  const [state, setState] = useState<DesktopUpdateState>({ status: "idle" });
  // Downloading/downloaded need the version shown while available, but onDownloaded fires
  // with no payload — stash the last-known info so it survives into later states.
  const infoRef = useRef<UpdateInfo | null>(null);

  useEffect(() => {
    const api = window.electronAPI?.update;
    if (!api) return;

    const unsubAvailable = api.onAvailable((info) => {
      infoRef.current = info;
      setState({ status: "available", info });
    });
    const unsubNotAvailable = api.onNotAvailable(() => {
      infoRef.current = null;
      setState({ status: "idle" });
    });
    const unsubDownloaded = api.onDownloaded(() => {
      setState({ status: "downloaded", info: infoRef.current ?? { version: "", notes: "" } });
    });
    const unsubError = api.onError((message) => {
      setState({ status: "error", message });
    });

    return () => {
      unsubAvailable();
      unsubNotAvailable();
      unsubDownloaded();
      unsubError();
    };
  }, []);

  const check = useCallback(() => {
    void window.electronAPI?.update.check();
  }, []);

  const upgrade = useCallback(() => {
    setState((prev) =>
      prev.status === "available" ? { status: "downloading", info: prev.info } : prev,
    );
    void window.electronAPI?.update.download();
  }, []);

  const restart = useCallback(() => {
    void window.electronAPI?.update.install();
  }, []);

  const dismiss = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return { state, check, upgrade, restart, dismiss };
}
