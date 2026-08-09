import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { ApiTokenService } from "../auth/api-token.service.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { AttachmentTicketService } from "./attachment-ticket.service.js";

/**
 * Authenticates an attachment fetch by ticket (`?t=`) or, failing that, the normal
 * Authorization header.
 *
 * Both paths matter: browsers cannot set a header on an `<img>` or a PDF fetch, while the Go
 * CLI and any script hitting the API directly have a bearer token and no way to get a ticket
 * without one anyway.
 */
@Injectable()
export class AttachmentAccessGuard extends JwtAuthGuard {
  constructor(
    apiTokenService: ApiTokenService,
    private readonly tickets: AttachmentTicketService,
  ) {
    super(apiTokenService);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const ticket = req.query["t"];

    if (typeof ticket === "string" && ticket.length > 0) {
      const userId = this.tickets.verify(ticket);
      if (!userId) throw new UnauthorizedException();
      (req as Request & { user: unknown }).user = { id: userId };
      return true;
    }

    return super.canActivate(context);
  }
}
