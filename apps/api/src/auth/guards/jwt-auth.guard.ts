import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { ApiTokenService } from "../api-token.service.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly apiTokenService: ApiTokenService) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers["authorization"];

    if (authHeader?.startsWith("Bearer ndra_")) {
      const raw = authHeader.slice(7);
      const result = await this.apiTokenService.validateToken(raw);
      if (!result) throw new UnauthorizedException();
      (req as Request & { user: unknown }).user = result.user;
      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
