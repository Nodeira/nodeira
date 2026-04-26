import { Module } from "@nestjs/common";
import { VaultsController } from "./vaults.controller.js";
import { VaultsService } from "./vaults.service.js";

@Module({
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}
