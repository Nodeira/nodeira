import { Global, Module } from "@nestjs/common";
import { DocumentBridge } from "./document-bridge.service.js";

/**
 * Global so NotesModule can consume the bridge without importing SyncModule — SyncModule
 * already imports NotesModule, and a direct dependency the other way would be circular.
 */
@Global()
@Module({
  providers: [DocumentBridge],
  exports: [DocumentBridge],
})
export class DocumentBridgeModule {}
