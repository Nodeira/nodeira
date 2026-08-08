import { ForbiddenException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
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
    try {
      return (await this.usersService.count()) === 0;
    } catch {
      // DB not yet migrated — treat as setup required
      return true;
    }
  }

  async createAdmin(dto: CreateAdminDto) {
    if (!(await this.isSetupRequired())) {
      throw new ForbiddenException("Setup already complete");
    }
    // First account is the instance admin; UsersService defaults everyone else to USER.
    const user = await this.usersService.create({ ...dto, role: Role.ADMIN });
    return this.authService.login(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      true,
    );
  }
}
