import { Module } from "@nestjs/common";
import { TrashModule } from "../trash/trash.module.js";
import { FoldersController } from "./folders.controller.js";
import { FoldersService } from "./folders.service.js";

@Module({
  imports: [TrashModule],
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
