import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";
import { orNotFound } from "../database/prisma-errors.js";
import type { InstallPluginDto } from "./dto/install-plugin.dto.js";

function derivePluginId(source: string): string {
  if (source.startsWith("dev:")) return source.slice(4);
  // "owner/repo@version" → take the repo segment (after last /)
  const atIdx = source.lastIndexOf("@");
  const repoPath = atIdx > 0 ? source.slice(0, atIdx) : source;
  const slashIdx = repoPath.lastIndexOf("/");
  return slashIdx >= 0 ? repoPath.slice(slashIdx + 1) : repoPath;
}

@Injectable()
export class PluginsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plugin.findMany({ orderBy: { installedAt: "asc" } });
  }

  async install(dto: InstallPluginDto) {
    const pluginId = derivePluginId(dto.source);
    return this.prisma.plugin.upsert({
      where: { pluginId },
      update: { source: dto.source, enabled: true },
      create: { pluginId, source: dto.source, enabled: true },
    });
  }

  async setEnabled(pluginId: string, enabled: boolean) {
    return orNotFound(
      this.prisma.plugin.update({ where: { pluginId }, data: { enabled } }),
      `Plugin "${pluginId}" not found`,
    );
  }

  async remove(pluginId: string) {
    return orNotFound(
      this.prisma.plugin.delete({ where: { pluginId } }),
      `Plugin "${pluginId}" not found`,
    );
  }
}
