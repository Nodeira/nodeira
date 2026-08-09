import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { validateEnv } from "./config/env.validation.js";
import { ServeStaticModule } from "@nestjs/serve-static";
import { existsSync } from "fs";
import { join } from "path";
import { AppStateModule } from "./app-state/app-state.module.js";
import { AttachmentsModule } from "./attachments/attachments.module.js";
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
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Rate limiting. Login and first-run setup had none at all, so both were open to
    // unlimited guessing. Applied globally with a generous default; the auth routes
    // tighten it with their own @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // Only active when the web build is present (production Docker image).
    // Serves the React SPA and falls back to index.html for unknown routes.
    ...(existsSync(webDistPath)
      ? [
          ServeStaticModule.forRoot({
            rootPath: webDistPath,
            // Don't intercept API, WebSocket or Swagger paths.
            // `/uploads` is no longer served at all (attachments moved behind
            // /api/v1/attachments), but it stays excluded so a stale client asking for one
            // gets a 404 rather than 200 index.html dressed up as a PNG.
            exclude: ["/api/(.*)", "/sync(.*)", "/notifications(.*)", "/docs(.*)", "/uploads(.*)"],
          }),
        ]
      : []),
    AuthModule,
    SetupModule,
    AppStateModule,
    AttachmentsModule,
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
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
