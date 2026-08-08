import { Global, Module } from "@nestjs/common";
import { VaultsController } from "./vaults.controller.js";
import { VaultsService } from "./vaults.service.js";
import { VaultAccessService } from "./vault-access.service.js";

/**
 * Global because vault membership is the authorization primitive for notes, folders and
 * canvases, so VaultAccessService is needed by nearly every feature module. Making each of
 * them import VaultsModule invites exactly the silent-undefined failure that JwtAuthGuard
 * hit (see apps/api/src/auth/jwt-auth.guard.spec.ts).
 */
@Global()
@Module({
  controllers: [VaultsController],
  providers: [VaultsService, VaultAccessService],
  exports: [VaultsService, VaultAccessService],
})
export class VaultsModule {}
