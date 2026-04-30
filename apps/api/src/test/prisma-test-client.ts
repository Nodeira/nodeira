import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaService } from "../database/prisma.service.js";

export function createTestPrisma(): PrismaClient {
  const databaseUrl = inject("databaseUrl");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function asPrismaService(client: PrismaClient): PrismaService {
  return client as unknown as PrismaService;
}

export async function cleanDatabase(prisma: PrismaClient) {
  await prisma.note.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.vault.deleteMany();
}
