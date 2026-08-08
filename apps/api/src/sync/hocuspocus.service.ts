import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Server } from "@hocuspocus/server";
import type { IncomingMessage } from "http";
import type { WebSocket } from "ws";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";
import { yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { ApiTokenService } from "../auth/api-token.service.js";
import type { AuthenticatedUser } from "../auth/jwt.strategy.js";
import { NotesService } from "../notes/notes.service.js";

type PmNode = { type: string; content?: PmNode[]; attrs?: Record<string, unknown> };

function extractWikiLinkIds(node: PmNode): string[] {
  const ids: string[] = [];
  if (node.type === "wikiLink" && typeof node.attrs?.noteId === "string") {
    ids.push(node.attrs.noteId);
  }
  for (const child of node.content ?? []) {
    ids.push(...extractWikiLinkIds(child));
  }
  return ids;
}

function extractHashTags(node: PmNode): string[] {
  const tags: string[] = [];
  if (node.type === "hashTag" && typeof node.attrs?.tag === "string") {
    tags.push(node.attrs.tag);
  }
  for (const child of node.content ?? []) {
    tags.push(...extractHashTags(child));
  }
  return tags;
}

interface SyncContext {
  user: AuthenticatedUser;
}

@Injectable()
export class HocuspocusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HocuspocusService.name);
  private server!: ReturnType<typeof Server.configure>;

  constructor(
    private readonly notesService: NotesService,
    private readonly jwtService: JwtService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  onModuleInit() {
    const notesService = this.notesService;
    const jwtService = this.jwtService;
    const apiTokenService = this.apiTokenService;
    const logger = this.logger;

    this.server = Server.configure({
      async onAuthenticate({ token }): Promise<SyncContext> {
        if (!token) throw new UnauthorizedException("Authentication required");

        if (token.startsWith("ndra_")) {
          const result = await apiTokenService.validateToken(token);
          if (!result) throw new UnauthorizedException("Invalid or expired API token");
          return { user: result.user };
        }

        try {
          const payload = jwtService.verify<{ sub: string; email: string; role: string }>(token);
          return {
            user: { id: payload.sub, email: payload.email, name: null, role: payload.role },
          };
        } catch {
          throw new UnauthorizedException("Invalid or expired token");
        }
      },

      async onLoadDocument({ document, documentName, context }) {
        const { user } = context as SyncContext;
        try {
          const note = await notesService.findOne(documentName, user.vaultScope);
          if (note.yjsState) {
            applyUpdate(document as Doc, note.yjsState);
          }
        } catch (err) {
          if (err instanceof NotFoundException) {
            // Do NOT swallow this. Returning here hands the client a blank document that
            // syncs and accepts edits, while every flush is silently dropped by
            // updateYjsState's updateMany (0 rows) — the note does not exist. Rejecting
            // the connection lets the client surface "note not found" instead of quietly
            // eating the user's typing.
            logger.warn(`Rejecting sync connection for unknown note ${documentName}`);
          } else {
            logger.error(`Failed to load Yjs state for ${documentName}`, err as Error);
          }
          throw err;
        }
      },

      async onStoreDocument({ document, documentName }) {
        const state = encodeStateAsUpdate(document as Doc);
        const written = await notesService.updateYjsState(documentName, new Uint8Array(state));
        if (written === 0) {
          // The note was deleted while this connection was still open. Dropping the write
          // is deliberate (it is what stops ghost resurrection), but it is data loss for
          // anything typed after the delete, so make it visible rather than silent.
          logger.warn(`Discarded Yjs flush for deleted note ${documentName}`);
          return;
        }

        try {
          const json = yDocToProsemirrorJSON(document as Doc, "default") as PmNode;
          const linkedIds = [...new Set(extractWikiLinkIds(json))];
          await notesService.syncLinks(documentName, linkedIds);
          const tags = [...new Set(extractHashTags(json))];
          await notesService.syncTags(documentName, tags);
        } catch (err) {
          logger.error(`Failed to sync links for ${documentName}`, err as Error);
        }
      },
    });
  }

  onModuleDestroy() {
    // Guarded because a context that was compiled but never initialised (as in DI tests)
    // still gets its destroy hooks called, and `server` is only assigned in onModuleInit.
    this.server?.destroy();
  }

  handleConnection(connection: WebSocket, request: IncomingMessage) {
    this.server.handleConnection(connection, request);
  }
}
