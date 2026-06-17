import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { RegisterDeviceDto } from "./dto/register-device.dto.js";
import { RemindersService } from "./reminders.service.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller("devices")
export class DevicesController {
  constructor(private readonly reminders: RemindersService) {}

  /** Register or refresh a push token / WS client for the current user. */
  @Post()
  register(@Request() req: RequestWithUser, @Body() dto: RegisterDeviceDto) {
    return this.reminders.registerDevice(req.user.id, dto);
  }

  @Get()
  list(@Request() req: RequestWithUser) {
    return this.reminders.listDevices(req.user.id);
  }

  @Delete(":id")
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.reminders.removeDevice(req.user.id, id);
  }
}
