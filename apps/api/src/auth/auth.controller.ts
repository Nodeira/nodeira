import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { ApiTokenService } from "./api-token.service.js";
import { AuthService } from "./auth.service.js";
import { CreateTokenDto } from "./dto/create-token.dto.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { LocalAuthGuard } from "./guards/local-auth.guard.js";
import type { AuthenticatedUser } from "./jwt.strategy.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

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

  @Post("tokens")
  @UseGuards(JwtAuthGuard)
  createToken(@Request() req: RequestWithUser, @Body() dto: CreateTokenDto) {
    return this.apiTokenService.create(req.user.id, dto);
  }

  @Get("tokens")
  @UseGuards(JwtAuthGuard)
  listTokens(@Request() req: RequestWithUser) {
    return this.apiTokenService.findAll(req.user.id);
  }

  @Delete("tokens/:id")
  @UseGuards(JwtAuthGuard)
  revokeToken(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.apiTokenService.revoke(id, req.user.id);
  }
}
