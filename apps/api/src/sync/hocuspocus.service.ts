import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Server } from "@hocuspocus/server";
import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { NotesService } from "../notes/notes.service.js";

@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HocuspocusService.name);
  private server!: ReturnType<typeof Server.configure>;

  constructor(private readonly notesService: NotesService) {}

  onModuleInit() {
    const notesService = this.notesService;
    const logger = this.logger;

    this.server = Server.configure({
      async onLoadDocument({ document, documentName }) {
        try {
          const note = await notesService.findOne(documentName);
          if (note.yjsState) {
            applyUpdate(document as Doc, note.yjsState);
          }
        } catch (err) {
          if (err instanceof NotFoundException) return;
          logger.error(`Failed to load Yjs state for ${documentName}`, err as Error);
          throw err;
        }
      },

      async onStoreDocument({ document, documentName }) {
        const state = encodeStateAsUpdate(document as Doc);
        await notesService.upsertYjsState(documentName, new Uint8Array(state));
      },
    });
  }

  onModuleDestroy() {
    this.server.destroy();
  }

  handleConnection(connection: WebSocket, request: IncomingMessage) {
    this.server.handleConnection(connection, request);
  }
}
