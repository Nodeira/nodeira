import "reflect-metadata"; // MUST be the first import — NestJS DI depends on Reflect API

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SyncWsAdapter } from "./sync/sync-ws-adapter.js";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import helmet from "helmet";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix("api");

  // URI versioning: routes resolve to /api/v1/<path> by default.
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

  // CORS_ORIGIN was documented as "Required" in deployment.md and present in .env.example,
  // yet nothing read it — every instance ran fully open while operators believed otherwise.
  // Honour it when set; fall back to open, which is what a same-origin self-hosted install
  // wants and what local CLI tooling relies on.
  const corsOrigin = process.env["CORS_ORIGIN"];
  app.enableCors(
    corsOrigin ? { origin: corsOrigin.split(",").map((o) => o.trim()), credentials: true } : {},
  );

  // Swagger serves the full API surface, unauthenticated, and its UI needs inline scripts —
  // which is why CSP was disabled globally. Neither belongs in production.
  const exposeSwagger = process.env["NODE_ENV"] !== "production";
  app.use(exposeSwagger ? helmet({ contentSecurityPolicy: false }) : helmet());

  if (exposeSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Nodeira API")
      .setDescription("REST API for Nodeira note management")
      .setVersion(process.env["npm_package_version"] ?? "dev")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = parseInt(process.env["PORT"] ?? "3001", 10);
  await app.listen(port, "0.0.0.0");
  console.log(`Nodeira server running on http://localhost:${port}`);
  if (exposeSwagger) console.log(`Swagger docs:          http://localhost:${port}/docs`);
}

bootstrap();
