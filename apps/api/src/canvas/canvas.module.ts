import { Module } from "@nestjs/common";
import { CanvasController } from "./canvas.controller.js";
import { CanvasService } from "./canvas.service.js";

@Module({
  controllers: [CanvasController],
  providers: [CanvasService],
  exports: [CanvasService],
})
export class CanvasModule {}
