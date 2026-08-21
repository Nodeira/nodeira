import { Module } from "@nestjs/common";
import { TrashModule } from "../trash/trash.module.js";
import { CanvasController } from "./canvas.controller.js";
import { CanvasService } from "./canvas.service.js";

@Module({
  imports: [TrashModule],
  controllers: [CanvasController],
  providers: [CanvasService],
  exports: [CanvasService],
})
export class CanvasModule {}
