import "reflect-metadata"; // MUST be the first import — NestJS DI depends on Reflect API

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SyncWsAdapter } from "./sync/sync-ws-adapter.js";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // URI versioning: routes resolve to /v1/<path> by default.
  // Individual controllers/handlers can opt into a different version with @Version('2'),
  // or out of versioning entirely with @Version(VERSION_NEUTRAL).
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Ensure uploads directory exists and serve it at /uploads/<filename>
  const uploadsDir = join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: "/uploads" });

  // Use raw WebSocket adapter — y-websocket/Hocuspocus protocol is incompatible with Socket.IO.
  // SyncWsAdapter overrides exact-path matching so the /sync gateway accepts
  // /sync/<noteId> connections (y-websocket appends the room name to the URL).
  app.useWebSocketAdapter(new SyncWsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Nodeira API")
    .setDescription("REST API for Nodeira note management")
    .setVersion("0.1")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = parseInt(process.env["PORT"] ?? "3001", 10);
  await app.listen(port);
  console.log(`Nodeira server running on http://localhost:${port}`);
  console.log(`Swagger docs:          http://localhost:${port}/docs`);
}

bootstrap();
