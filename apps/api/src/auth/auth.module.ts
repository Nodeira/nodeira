import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { UsersModule } from "../users/users.module.js";
import { ApiTokenService } from "./api-token.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtStrategy } from "./jwt.strategy.js";
import { LocalStrategy } from "./local.strategy.js";

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET")!,
        signOptions: { expiresIn: "60m" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ApiTokenService, LocalStrategy, JwtStrategy],
  exports: [AuthService, ApiTokenService, JwtModule],
})
export class AuthModule {}
