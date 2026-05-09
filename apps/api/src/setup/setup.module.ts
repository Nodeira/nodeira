import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { UsersModule } from "../users/users.module.js";
import { SetupController } from "./setup.controller.js";
import { SetupService } from "./setup.service.js";

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}
