import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { existsSync } from "fs";
import { join } from "path";
import { AppStateModule } from "./app-state/app-state.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DatabaseModule } from "./database/database.module.js";
import { FoldersModule } from "./folders/folders.module.js";
import { NotesModule } from "./notes/notes.module.js";
import { SetupModule } from "./setup/setup.module.js";
import { DocumentBridgeModule } from "./sync/document-bridge.module.js";
import { SyncModule } from "./sync/sync.module.js";
import { UploadModule } from "./upload/upload.module.js";
import { VaultsModule } from "./vaults/vaults.module.js";
import { PluginsModule } from "./plugins/plugins.module.js";
import { CanvasModule } from "./canvas/canvas.module.js";
import { RemindersModule } from "./reminders/reminders.module.js";

const webDistPath = join(process.cwd(), "public");

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Only active when the web build is present (production Docker image).
    // Serves the React SPA and falls back to index.html for unknown routes.
    ...(existsSync(webDistPath)
      ? [
          ServeStaticModule.forRoot({
            rootPath: webDistPath,
            // Don't intercept API, WebSocket, Swagger, or upload paths
            exclude: ["/api/(.*)", "/sync(.*)", "/notifications(.*)", "/docs(.*)", "/uploads(.*)"],
          }),
        ]
      : []),
    AuthModule,
    SetupModule,
    AppStateModule,
    DatabaseModule,
    DocumentBridgeModule,
    FoldersModule,
    NotesModule,
    SyncModule,
    UploadModule,
    VaultsModule,
    PluginsModule,
    CanvasModule,
    RemindersModule,
  ],
})
export class AppModule {}
