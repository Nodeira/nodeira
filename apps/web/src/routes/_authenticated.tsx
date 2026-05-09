import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell.js";
import { authStorage } from "../lib/authStorage.js";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    if (!authStorage.getToken()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
