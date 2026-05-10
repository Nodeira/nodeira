import { createRouter, createMemoryHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.js";

export const router = createRouter({
  routeTree,
  // Browser history reads window.location.pathname, which under file:// is the
  // full disk path — no route ever matches. Memory history avoids window.location
  // entirely, so routing works correctly in the packaged Electron app.
  ...(window.electronAPI ? { history: createMemoryHistory({ initialEntries: ["/"] }) } : {}),
  defaultPreload: "intent",
});

// Register router instance for type-safe Link/useNavigate/etc.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
