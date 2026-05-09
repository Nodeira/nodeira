import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { UsersService } from "../users/users.service.js";
import type { AuthenticatedUser } from "./jwt.strategy.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.password);
    if (!match) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  login(user: AuthenticatedUser, rememberMe?: boolean) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: rememberMe ? "30d" : "60m",
      }),
      user,
    };
  }
}
