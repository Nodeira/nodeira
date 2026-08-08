import { Injectable, Logger } from "@nestjs/common";
import type { Doc } from "yjs";

/** Mutates a live Yjs document. Receives the Hocuspocus Document, which extends Y.Doc. */
export type DocumentTransaction = (doc: Doc) => void;

/**
 * Structural shape of Hocuspocus's DirectConnection. Declared here rather than imported so
 * this provider stays free of the sync server's types — its whole purpose is to break that
 * dependency. Hocuspocus's Document extends Y.Doc, so a callback typed for Y.Doc accepts it.
 */
interface DirectConnectionLike {
  transact(fn: (doc: Doc) => void, transactionOrigin?: unknown): Promise<void>;
  disconnect(): Promise<void>;
}

type Opener = (documentName: string) => Promise<DirectConnectionLike>;

/**
 * Lets REST handlers mutate a note's Yjs document through the sync server instead of
 * writing yjs_state behind its back.
 *
 * PUT /notes/:id/content used to build a brand-new Y.Doc from Markdown and overwrite the
 * stored state outright. Any editor still connected held the old in-memory document, so
 * its next flush overwrote the import — and because the two state vectors had diverged,
 * the versions could never merge. Routing the write through a Hocuspocus direct
 * connection applies it as an update to the document everyone is already sharing, so
 * connected editors see the change immediately and nothing is clobbered.
 *
 * Exists as a separate provider because SyncModule already imports NotesModule (the sync
 * server reads and writes notes), so NotesService cannot depend on the sync server
 * directly without a circular import. HocuspocusService registers itself here on boot;
 * until it does, callers fall back to writing the database row.
 */
@Injectable()
export class DocumentBridge {
  private readonly logger = new Logger(DocumentBridge.name);
  private opener: Opener | null = null;

  register(opener: Opener) {
    this.opener = opener;
  }

  /**
   * Applies `fn` to the live document. Returns false when the sync server is not
   * available, so the caller can fall back to a direct database write.
   */
  async transact(documentName: string, fn: DocumentTransaction): Promise<boolean> {
    if (!this.opener) return false;

    const connection = await this.opener(documentName);
    try {
      await connection.transact(fn);
      return true;
    } catch (err) {
      this.logger.error(`Direct transaction failed for ${documentName}`, err as Error);
      throw err;
    } finally {
      await connection.disconnect();
    }
  }
}
