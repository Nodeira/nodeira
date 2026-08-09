import { Module } from "@nestjs/common";
import { AttachmentsController } from "./attachments.controller.js";
import { AttachmentAccessGuard } from "./attachment-access.guard.js";
import { AttachmentTicketService } from "./attachment-ticket.service.js";

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentTicketService, AttachmentAccessGuard],
})
export class AttachmentsModule {}
