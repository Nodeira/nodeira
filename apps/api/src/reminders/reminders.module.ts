import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { DevicesController } from "./devices.controller.js";
import { NotificationDispatcherService } from "./notification-dispatcher.service.js";
import { NotificationsGateway } from "./notifications.gateway.js";
import { ReminderSchedulerService } from "./reminder-scheduler.service.js";
import { RemindersController } from "./reminders.controller.js";
import { RemindersService } from "./reminders.service.js";

@Module({
  imports: [AuthModule],
  controllers: [RemindersController, DevicesController],
  providers: [
    RemindersService,
    NotificationsGateway,
    NotificationDispatcherService,
    ReminderSchedulerService,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
