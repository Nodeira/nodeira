import { Body, Controller, Get, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { LocalAuthGuard } from "./guards/local-auth.guard.js";
import type { AuthenticatedUser } from "./jwt.strategy.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @UseGuards(LocalAuthGuard)
  @ApiBody({
    schema: {
      properties: {
        email: { type: "string" },
        password: { type: "string" },
        rememberMe: { type: "boolean" },
      },
    },
  })
  login(@Request() req: RequestWithUser, @Body("rememberMe") rememberMe?: boolean) {
    return this.authService.login(req.user, rememberMe);
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  profile(@Request() req: RequestWithUser): AuthenticatedUser {
    return req.user;
  }
}
