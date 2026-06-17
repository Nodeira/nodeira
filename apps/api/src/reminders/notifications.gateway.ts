import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from "@nestjs/websockets";
import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import type { ReminderNotification } from "@nodeira/shared-types";
import { ApiTokenService } from "../auth/api-token.service.js";
import type { JwtPayload } from "../auth/jwt.strategy.js";

/**
 * WebSocket gateway mounted at /notifications.
 * Clients connect as: ws://host/notifications?token=<jwt-or-api-token>
 *
 * Pushes reminder notifications to a user's connected web/desktop clients in
 * real time (mobile receives the same notifications via Expo push instead).
 * Authentication mirrors the REST guards: JWT bearer tokens or ndra_ API tokens.
 */
@WebSocketGateway({ path: "/notifications" })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  /** userId -> open sockets for that user (a user may have several tabs/devices). */
  private readonly userSockets = new Map<string, Set<WebSocket>>();
  /** Reverse lookup so we can clean up on disconnect without re-parsing the token. */
  private readonly socketUser = new WeakMap<WebSocket, string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    const userId = await this.authenticate(request);
    if (!userId) {
      client.close(1008, "Unauthorized");
      return;
    }

    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(client);
    this.socketUser.set(client, userId);
  }

  handleDisconnect(client: WebSocket): void {
    const userId = this.socketUser.get(client);
    if (!userId) return;
    const sockets = this.userSockets.get(userId);
    sockets?.delete(client);
    if (sockets && sockets.size === 0) this.userSockets.delete(userId);
    this.socketUser.delete(client);
  }

  /** Push a fired reminder to all of a user's connected web/desktop clients. */
  sendToUser(userId: string, payload: ReminderNotification): void {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return;
    const message = JSON.stringify({ type: "reminder", payload });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  }

  private async authenticate(request: IncomingMessage): Promise<string | null> {
    try {
      const url = new URL(request.url ?? "", `ws://${request.headers.host}/`);
      const token = url.searchParams.get("token");
      if (!token) return null;

      if (token.startsWith("ndra_")) {
        const result = await this.apiTokenService.validateToken(token);
        return result?.user.id ?? null;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      return payload.sub ?? null;
    } catch (err) {
      this.logger.warn(`Rejected notifications WS connection: ${(err as Error).message}`);
      return null;
    }
  }
}
