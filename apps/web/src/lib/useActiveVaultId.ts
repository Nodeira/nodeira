import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { getVaults, vaultsKeys } from "./api.js";
import { currentVaultAtom } from "../store/atoms.js";

/**
 * The vault new content should be created in, or null while vaults are still loading.
 *
 * Derived rather than read straight off `currentVaultAtom`: that atom is populated by an
 * effect in AppShell, so it is null on the first render and for a frame afterwards. Every
 * creation path now needs a real vault id — the server rejects a note, folder or canvas
 * without one, because access is decided by vault membership — so falling back to the
 * first vault here closes the window where a create would 400.
 */
export function useActiveVaultId(): string | null {
  const currentVaultId = useAtomValue(currentVaultAtom);
  const { data: vaults = [] } = useQuery({ queryKey: vaultsKeys.all, queryFn: getVaults });
  return currentVaultId ?? vaults[0]?.id ?? null;
}
