import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { CreateReminderDto } from "./dto/create-reminder.dto.js";
import { SnoozeReminderDto } from "./dto/snooze-reminder.dto.js";
import { UpdateReminderDto } from "./dto/update-reminder.dto.js";
import { RemindersService } from "./reminders.service.js";

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@UseGuards(JwtAuthGuard)
@Controller("reminders")
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateReminderDto) {
    return this.reminders.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser, @Query("status") status?: string) {
    return this.reminders.findAll(req.user.id, status);
  }

  @Get(":id")
  findOne(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.reminders.findOne(req.user.id, id);
  }

  @Patch(":id")
  update(@Request() req: RequestWithUser, @Param("id") id: string, @Body() dto: UpdateReminderDto) {
    return this.reminders.update(req.user.id, id, dto);
  }

  @Post(":id/snooze")
  snooze(@Request() req: RequestWithUser, @Param("id") id: string, @Body() dto: SnoozeReminderDto) {
    return this.reminders.snooze(req.user.id, id, dto.until);
  }

  @Post(":id/dismiss")
  dismiss(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.reminders.dismiss(req.user.id, id);
  }

  @Delete(":id")
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.reminders.remove(req.user.id, id);
  }
}
