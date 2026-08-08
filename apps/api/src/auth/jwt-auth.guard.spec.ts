import { Test } from "@nestjs/testing";
import type { TestingModule } from "@nestjs/testing";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { inject } from "vitest";
import { AppModule } from "../app.module.js";
import { AppStateModule } from "../app-state/app-state.module.js";
import { CanvasModule } from "../canvas/canvas.module.js";
import { FoldersModule } from "../folders/folders.module.js";
import { NotesModule } from "../notes/notes.module.js";
import { PluginsModule } from "../plugins/plugins.module.js";
import { RemindersModule } from "../reminders/reminders.module.js";
import { UploadModule } from "../upload/upload.module.js";
import { UsersModule } from "../users/users.module.js";
import { VaultsModule } from "../vaults/vaults.module.js";
import { ApiTokenService } from "./api-token.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";

/**
 * Regression test for the API-token feature being silently dead outside AuthModule.
 *
 * JwtAuthGuard injects ApiTokenService, but AuthGuard() is a mixin whose constructor
 * parameter carries @Optional() metadata that reflect-metadata inherits onto the
 * subclass. That suppressed the UnknownDependenciesException Nest would normally throw,
 * so every module that guarded its routes without making ApiTokenService resolvable got
 * `undefined` — and every `Authorization: Bearer ndra_...` request 500'd instead of
 * authenticating. The Go CLI could not talk to notes, vaults or folders at all.
 *
 * These tests build the real DI graph rather than calling `new SomeService(...)`, which
 * is why the existing service specs never caught it.
 */

/** Every module that guards routes with @UseGuards(JwtAuthGuard). */
const GUARDED_MODULES = [
  { name: "AppStateModule", ref: AppStateModule },
  { name: "CanvasModule", ref: CanvasModule },
  { name: "FoldersModule", ref: FoldersModule },
  { name: "NotesModule", ref: NotesModule },
  { name: "PluginsModule", ref: PluginsModule },
  { name: "RemindersModule", ref: RemindersModule },
  { name: "UploadModule", ref: UploadModule },
  { name: "UsersModule", ref: UsersModule },
  { name: "VaultsModule", ref: VaultsModule },
] as const;

let moduleRef: TestingModule;

beforeAll(async () => {
  // PrismaService reads DATABASE_URL in its constructor, which runs during compile().
  process.env["DATABASE_URL"] = inject("databaseUrl");
  process.env["JWT_SECRET"] ??= "test-secret";

  // compile() instantiates providers but does not run onModuleInit, so no migrations,
  // no vault seeding and no reminder scheduler interval.
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
});

afterAll(async () => {
  await moduleRef?.close();
});

describe("JwtAuthGuard dependency injection", () => {
  it.each(GUARDED_MODULES)("resolves ApiTokenService from $name", ({ ref }) => {
    expect(moduleRef.select(ref).get(ApiTokenService)).toBeInstanceOf(ApiTokenService);
  });

  it("fails loudly when ApiTokenService is missing instead of resolving to undefined", () => {
    expect(() => new JwtAuthGuard(undefined as unknown as ApiTokenService)).toThrow(
      /ApiTokenService was not injected/,
    );
  });
});
