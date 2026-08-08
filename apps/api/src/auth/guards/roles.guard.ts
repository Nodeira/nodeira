import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import { ROLES_KEY } from "../roles.decorator.js";
import type { RequestWithUser } from "../request-with-user.js";

/**
 * Enforces @Roles(). Instance-wide roles only — access to a specific vault's contents is
 * decided by VaultAccessService, not here.
 *
 * Until now `Role` existed in the schema, `UsersService.create` hardcoded ADMIN, and no
 * guard ever read it, so the whole thing was decorative.
 *
 * Must be listed after JwtAuthGuard in @UseGuards so req.user is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user || !required.includes(user.role as Role)) {
      throw new ForbiddenException(`Requires one of: ${required.join(", ")}`);
    }
    return true;
  }
}
