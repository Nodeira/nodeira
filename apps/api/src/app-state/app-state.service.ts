import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

export interface AppStateDto {
  openTabs: string[];
  activeNoteId: string | null;
}

@Injectable()
export class AppStateService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AppStateDto> {
    const state = await this.prisma.appState.findUnique({ where: { id: "default" } });
    return {
      openTabs: state?.openTabs ?? [],
      activeNoteId: state?.activeNoteId ?? null,
    };
  }

  async patch(data: Partial<AppStateDto>): Promise<void> {
    await this.prisma.appState.upsert({
      where: { id: "default" },
      update: data,
      create: {
        id: "default",
        openTabs: data.openTabs ?? [],
        activeNoteId: data.activeNoteId ?? null,
      },
    });
  }
}
