import { createRootRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSetupStatus } from "../lib/api.js";
import { authStorage } from "../lib/authStorage.js";

// Cached for the lifetime of the page — avoids a network round-trip on every navigation.
let _setupChecked = false;
let _setupRequired = false;

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (!_setupChecked) {
      try {
        const status = await getSetupStatus();
        _setupRequired = status.setupRequired;
        _setupChecked = true;
      } catch {
        // API unavailable — don't cache, will retry on next navigation
      }
    }

    const path = location.pathname;
    if (_setupRequired && path !== "/setup") {
      throw redirect({ to: "/setup" });
    }
    if (!_setupRequired && path === "/setup") {
      // Setup already done; redirect to login if not authenticated, else home
      throw redirect({ to: authStorage.getToken() ? "/" : "/login" });
    }
  },
  component: () => <Outlet />,
});
