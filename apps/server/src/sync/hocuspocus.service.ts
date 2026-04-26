import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server } from "@hocuspocus/server";
import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { NotesService } from "../notes/notes.service.js";

@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private server!: ReturnType<typeof Server.configure>;

  constructor(private readonly notesService: NotesService) {}

  onModuleInit() {
    // Capture service reference for use inside Hocuspocus callbacks
    const notesService = this.notesService;

    this.server = Server.configure({
      /**
       * onLoadDocument: called when the first client connects to a document room.
       * documentName is the note UUID passed in the WebSocket URL path.
       * We load the persisted Yjs binary from PostgreSQL and apply it to the in-memory doc.
       */
      async onLoadDocument({ document, documentName }) {
        try {
          const note = await notesService.findOne(documentName);
          if (note.yjsState) {
            const binary = Buffer.from(note.yjsState, "base64");
            applyUpdate(document as Doc, binary);
          }
        } catch {
          // Note not found — new document, no state to restore
        }
      },

      /**
       * onStoreDocument: called after each change when Hocuspocus decides to persist.
       * We encode the full Yjs document state and write it back to PostgreSQL.
       */
      async onStoreDocument({ document, documentName }) {
        const state = encodeStateAsUpdate(document as Doc);
        const base64State = Buffer.from(state).toString("base64");
        await notesService.upsertYjsState(documentName, base64State);
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
