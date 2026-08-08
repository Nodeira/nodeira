import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { RegisterDeviceDto } from "./dto/register-device.dto.js";
import { RemindersService } from "./reminders.service.js";

@UseGuards(JwtAuthGuard)
@Controller("devices")
export class DevicesController {
  constructor(private readonly reminders: RemindersService) {}

  /** Registers this client so it shows up in the user's device list. */
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
