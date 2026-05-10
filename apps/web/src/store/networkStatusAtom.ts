import { atom } from "jotai";

export type NetworkStatus = "online" | "offline";

export const networkStatusAtom = atom<NetworkStatus>(
  typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online",
);
