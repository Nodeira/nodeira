import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.js";

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

// Register router instance for type-safe Link/useNavigate/etc.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
