import { Controller, Get, NotFoundException, Param, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { RequestWithUser } from "../auth/request-with-user.js";
import { AttachmentAccessGuard } from "./attachment-access.guard.js";
import { AttachmentTicketService, TICKET_TTL_MS } from "./attachment-ticket.service.js";
import { ATTACHMENT_FILENAME, contentTypeFor, uploadsDir } from "./uploads-dir.js";

@ApiTags("attachments")
@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly tickets: AttachmentTicketService) {}

  /** Issues the short-lived credential the web client appends to attachment URLs. */
  @Get("ticket")
  @UseGuards(JwtAuthGuard)
  issueTicket(@Req() req: RequestWithUser) {
    return this.tickets.issue(req.user.id);
  }

  /**
   * Serves an uploaded image or PDF.
   *
   * A note page can reference many attachments at once, so the global 300/min throttle would
   * fire on legitimate use; react-pdf alone issues several ranged requests per document.
   */
  @Get(":filename")
  @Throttle({ default: { limit: 1_000, ttl: 60_000 } })
  @UseGuards(AttachmentAccessGuard)
  serve(@Param("filename") filename: string, @Res() res: Response): void {
    if (!ATTACHMENT_FILENAME.test(filename)) throw new NotFoundException();

    res.type(contentTypeFor(filename));
    // The upload route sniffs magic bytes, but the browser must not be free to disagree with
    // the type we declare — that is the difference between an image and a script.
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Safe to cache: the filename is a UUID, so contents never change under it. `private`
    // keeps it out of shared proxies, and the ticket in the query string means the entry
    // falls out of use when the ticket rotates.
    res.setHeader("Cache-Control", `private, max-age=${Math.floor(TICKET_TTL_MS / 1000)}`);

    res.sendFile(filename, { root: uploadsDir(), dotfiles: "deny" }, (err) => {
      // Fires after headers are already sent for a client abort mid-stream, where writing a
      // 404 would throw. A missing file is the only case worth reporting.
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: "Not Found" });
    });
  }
}
