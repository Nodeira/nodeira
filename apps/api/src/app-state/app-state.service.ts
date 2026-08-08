import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

export interface AppStateDto {
  openTabs: string[];
  activeNoteId: string | null;
}

/**
 * Per-user UI state. This was previously a single global row keyed id="default", so every
 * user shared one set of open tabs and each overwrote the others'.
 */
@Injectable()
export class AppStateService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<AppStateDto> {
    const state = await this.prisma.appState.findUnique({ where: { userId } });
    return {
      openTabs: state?.openTabs ?? [],
      activeNoteId: state?.activeNoteId ?? null,
    };
  }

  async patch(userId: string, data: Partial<AppStateDto>): Promise<void> {
    await this.prisma.appState.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        openTabs: data.openTabs ?? [],
        activeNoteId: data.activeNoteId ?? null,
      },
    });
  }
}
