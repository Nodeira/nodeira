import "reflect-metadata"; // MUST be the first import — NestJS DI depends on Reflect API

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SyncWsAdapter } from "./sync/sync-ws-adapter.js";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { existsSync, mkdirSync } from "fs";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { uploadsDir } from "./attachments/uploads-dir.js";

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

  // Ensure the uploads directory exists. It is NOT served statically: every uploaded image
  // and PDF used to be fetchable at /uploads/<uuid> with no credential at all, the UUID being
  // the only thing standing between an attachment and the open internet. Reads now go through
  // /api/v1/attachments/<uuid>, which authenticates (see AttachmentsController).
  if (!existsSync(uploadsDir())) mkdirSync(uploadsDir(), { recursive: true });

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
  // helmet's default Cross-Origin-Resource-Policy is "same-origin", which blocks the desktop
  // app (file://) and the Android WebView (https://appassets.androidplatform.net) from loading
  // attachments as <img> subresources — those are legitimately cross-origin clients of this
  // API by design, and the attachment route is already gated behind a short-lived ticket, so
  // relaxing this to "cross-origin" doesn't widen what an attacker could actually fetch.
  const helmetOptions = { crossOriginResourcePolicy: { policy: "cross-origin" as const } };
  app.use(
    exposeSwagger
      ? helmet({ ...helmetOptions, contentSecurityPolicy: false })
      : helmet(helmetOptions),
  );

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
