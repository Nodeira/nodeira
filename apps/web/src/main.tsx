// Mantine v9 requires explicit CSS imports — no CSS-in-JS
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Provider as JotaiProvider } from "jotai";
import { router } from "./router.js";
import { queryClient } from "./lib/queryClient.js";
import { jotaiStore } from "./store/jotaiStore.js";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found in index.html");

createRoot(rootElement).render(
  <StrictMode>
    <JotaiProvider store={jotaiStore}>
      <QueryClientProvider client={queryClient}>
        <MantineProvider defaultColorScheme="auto">
          <Notifications />
          <RouterProvider router={router} />
        </MantineProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </JotaiProvider>
  </StrictMode>,
);
