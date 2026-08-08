import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { ApiTokenService } from "../api-token.service.js";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly apiTokenService: ApiTokenService) {
    super();
    // AuthGuard() is a mixin whose constructor parameter is marked @Optional(), and
    // reflect-metadata inherits that onto this subclass. So a module that fails to make
    // ApiTokenService resolvable does NOT get an UnknownDependenciesException at boot —
    // it gets `undefined` here and a 500 on the first `Bearer ndra_` request. Assert
    // instead, so the failure surfaces at startup where it belongs.
    if (!apiTokenService) {
      throw new Error(
        "JwtAuthGuard: ApiTokenService was not injected. AuthModule must be resolvable " +
          "from the module using this guard (it is @Global, so importing it in AppModule suffices).",
      );
    }
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
