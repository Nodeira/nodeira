import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { CanvasService } from "./canvas.service.js";
import { CreateCanvasDto } from "./dto/create-canvas.dto.js";
import { UpdateCanvasDto } from "./dto/update-canvas.dto.js";

@ApiTags("canvases")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("canvases")
export class CanvasController {
  constructor(private readonly canvasService: CanvasService) {}

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query("vaultId") vaultId?: string,
    @Query("q") q?: string,
  ) {
    return this.canvasService.findAll(req.user.id, vaultId, req.user.vaultScope, q);
  }

  @Post()
  create(@Request() req: RequestWithUser, @Body() dto: CreateCanvasDto) {
    return this.canvasService.create(req.user.id, dto, req.user.vaultScope);
  }

  // Must be before :id to avoid "preview" being matched as an id
  @Post("preview")
  @HttpCode(200)
  fetchPreview(@Body("url") url: string) {
    return this.canvasService.fetchUrlPreview(url);
  }

  @Get(":id")
  findOne(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.canvasService.findOne(req.user.id, id, req.user.vaultScope);
  }

  @Patch(":id")
  update(@Request() req: RequestWithUser, @Param("id") id: string, @Body() dto: UpdateCanvasDto) {
    return this.canvasService.update(req.user.id, id, dto, req.user.vaultScope);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Request() req: RequestWithUser, @Param("id") id: string) {
    return this.canvasService.remove(req.user.id, id, req.user.vaultScope);
  }
}
