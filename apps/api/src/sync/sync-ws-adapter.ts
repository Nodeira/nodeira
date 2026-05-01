import { WsAdapter } from "@nestjs/platform-ws";
import * as http from "http";
import type { Duplex } from "stream";

interface RegisteredWsServer {
  path: string;
  handleUpgrade(
    request: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
    cb: (ws: unknown) => void,
  ): void;
  emit(event: string, ws: unknown, request: http.IncomingMessage): boolean;
}

/**
 * y-websocket clients connect with `${base}/${roomname}`, so a gateway mounted
 * at `/sync` actually sees connections at `/sync/<noteId>`. The default
 * WsAdapter does an exact path match (`pathname === wsServer.path`) and
 * rejects everything else — silently destroying the socket. This subclass
 * accepts both the exact path and any sub-path, which lets Hocuspocus parse
 * the document name from the URL itself.
 */
export class SyncWsAdapter extends WsAdapter {
  protected override ensureHttpServerExists(
    port: number,
    httpServer: http.Server = http.createServer(),
  ): http.Server {
    const httpServers = (this as unknown as { httpServersRegistry: Map<number, http.Server> })
      .httpServersRegistry;
    const existing = httpServers.get(port);
    if (existing) return existing;
    httpServers.set(port, httpServer);

    const wsServers = (this as unknown as { wsServersRegistry: Map<number, RegisteredWsServer[]> })
      .wsServersRegistry;

    httpServer.on("upgrade", (request, socket, head) => {
      try {
        const baseUrl = `ws://${request.headers.host}/`;
        const pathname = new URL(request.url ?? "", baseUrl).pathname;
        const servers = wsServers.get(port) ?? [];
        let delegated = false;
        for (const wsServer of servers) {
          const path = wsServer.path;
          if (pathname === path || pathname.startsWith(`${path}/`)) {
            wsServer.handleUpgrade(request, socket, head, (ws) => {
              wsServer.emit("connection", ws, request);
            });
            delegated = true;
            break;
          }
        }
        if (!delegated) socket.destroy();
      } catch (err) {
        socket.end(`HTTP/1.1 400\r\n${(err as Error).message}`);
      }
    });

    return httpServer;
  }
}
