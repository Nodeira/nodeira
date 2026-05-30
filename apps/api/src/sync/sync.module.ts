import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NotesModule } from "../notes/notes.module.js";
import { HocuspocusService } from "./hocuspocus.service.js";
import { SyncGateway } from "./sync.gateway.js";

@Module({
  imports: [NotesModule, AuthModule],
  providers: [HocuspocusService, SyncGateway],
})
export class SyncModule {}
