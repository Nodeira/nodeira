import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service.js";
import { UsersService } from "../users/users.service.js";
import type { CreateAdminDto } from "./dto/create-admin.dto.js";

@Injectable()
export class SetupService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async isSetupRequired(): Promise<boolean> {
    return (await this.usersService.count()) === 0;
  }

  async createAdmin(dto: CreateAdminDto) {
    if (!(await this.isSetupRequired())) {
      throw new ForbiddenException("Setup already complete");
    }
    const user = await this.usersService.create(dto);
    return this.authService.login(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      true,
    );
  }
}
