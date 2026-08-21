import { Module } from "@nestjs/common";
import { TrashController } from "./trash.controller.js";
import { TrashPurgeSchedulerService } from "./trash-purge-scheduler.service.js";
import { TrashService } from "./trash.service.js";

@Module({
  controllers: [TrashController],
  providers: [TrashService, TrashPurgeSchedulerService],
  exports: [TrashService],
})
export class TrashModule {}
