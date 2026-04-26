import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module.js";
import { FoldersModule } from "./folders/folders.module.js";
import { NotesModule } from "./notes/notes.module.js";
import { SyncModule } from "./sync/sync.module.js";
import { UploadModule } from "./upload/upload.module.js";
import { VaultsModule } from "./vaults/vaults.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FoldersModule,
    NotesModule,
    SyncModule,
    UploadModule,
    VaultsModule,
  ],
})
export class AppModule {}
