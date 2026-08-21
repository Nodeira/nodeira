import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { TrashItemTypeParam, TrashService } from "./trash.service.js";

@UseGuards(JwtAuthGuard)
@Controller("trash")
export class TrashController {
  constructor(private readonly trash: TrashService) {}

  @Get()
  list(@Request() req: RequestWithUser, @Query("vaultId") vaultId?: string) {
    return this.trash.list(req.user.id, vaultId, req.user.vaultScope);
  }

  @Post(":type/:id/restore")
  restore(
    @Request() req: RequestWithUser,
    @Param("type", new ParseEnumPipe(TrashItemTypeParam)) type: TrashItemTypeParam,
    @Param("id") id: string,
  ) {
    return this.trash.restore(req.user.id, type, id, req.user.vaultScope);
  }

  @Delete(":type/:id")
  purge(
    @Request() req: RequestWithUser,
    @Param("type", new ParseEnumPipe(TrashItemTypeParam)) type: TrashItemTypeParam,
    @Param("id") id: string,
  ) {
    return this.trash.purge(req.user.id, type, id, req.user.vaultScope);
  }
}
