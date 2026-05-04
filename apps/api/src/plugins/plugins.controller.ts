import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { PluginsService } from "./plugins.service.js";
import { InstallPluginDto } from "./dto/install-plugin.dto.js";
import { SetEnabledDto } from "./dto/set-enabled.dto.js";

@Controller("plugins")
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  findAll() {
    return this.pluginsService.findAll();
  }

  @Post()
  install(@Body() dto: InstallPluginDto) {
    return this.pluginsService.install(dto);
  }

  @Patch(":pluginId")
  setEnabled(@Param("pluginId") pluginId: string, @Body() dto: SetEnabledDto) {
    return this.pluginsService.setEnabled(pluginId, dto.enabled);
  }

  @Delete(":pluginId")
  remove(@Param("pluginId") pluginId: string) {
    return this.pluginsService.remove(pluginId);
  }
}
