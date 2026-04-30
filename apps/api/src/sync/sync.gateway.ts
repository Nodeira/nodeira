import { WebSocketGateway, OnGatewayConnection, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "ws";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { HocuspocusService } from "./hocuspocus.service.js";

/**
 * WebSocket gateway mounted at /sync.
 * Clients connect as: ws://host/sync/<noteId>
 * All protocol handling is delegated to HocuspocusService (y-websocket compatible).
 */
@WebSocketGateway({ path: "/sync" })
export class SyncGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly hocuspocusService: HocuspocusService) {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    this.hocuspocusService.handleConnection(client, request);
  }
}
