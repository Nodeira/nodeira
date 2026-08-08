import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Covers the refcounting in YjsProvider.
 *
 * The bug this guards against: quick-notes acquired a context per card, in the render
 * body, and never released any — so opening the page left one WebSocket, one Y.Doc and one
 * IndexedDB handle per note alive for the lifetime of the page, surviving navigation and
 * logout. Nothing in the suite would have noticed, because apps/web had no tests at all.
 *
 * The network and storage layers are stubbed: this is about lifecycle bookkeeping, which
 * is where the leak lived.
 */

const destroyed = { ws: 0, idb: 0, doc: 0 };

vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProvider: class {
    destroy() {
      destroyed.ws += 1;
    }
  },
}));

vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    destroy() {
      destroyed.idb += 1;
    }
  },
}));

vi.mock("../lib/authStorage.js", () => ({ authStorage: { getToken: () => "test-token" } }));
vi.mock("../lib/serverConfig.js", () => ({ getSyncWsUrl: () => "ws://localhost/sync" }));

const deletedDatabases: string[] = [];
vi.stubGlobal("indexedDB", { deleteDatabase: (name: string) => deletedDatabases.push(name) });
// The provider branches on window.electronAPI to choose SQLite over IndexedDB.
vi.stubGlobal("window", { electronAPI: undefined, dispatchEvent: () => true });

const {
  acquireYjsContext,
  releaseYjsContext,
  forgetYjsContext,
  destroyAllYjsContexts,
  cachedContextCount,
  idbNameFor,
} = await import("./YjsProvider.js");

beforeEach(() => {
  vi.useFakeTimers();
  destroyed.ws = 0;
  destroyed.idb = 0;
  destroyed.doc = 0;
  deletedDatabases.length = 0;
  destroyAllYjsContexts();
});

afterEach(() => {
  destroyAllYjsContexts();
  vi.useRealTimers();
});

/** Teardown is deferred by DESTROY_GRACE_MS; advance past it. */
function flushGrace() {
  vi.advanceTimersByTime(500);
}

describe("acquire/release refcounting", () => {
  it("hands the same context to every holder of a note", () => {
    const a = acquireYjsContext("note-1");
    const b = acquireYjsContext("note-1");
    expect(a).toBe(b);
    expect(cachedContextCount()).toBe(1);
  });

  it("keeps the context alive while any holder remains", () => {
    acquireYjsContext("note-1");
    acquireYjsContext("note-1");

    releaseYjsContext("note-1");
    flushGrace();

    expect(cachedContextCount()).toBe(1);
    expect(destroyed.ws).toBe(0);
  });

  it("tears down once the last holder releases", () => {
    acquireYjsContext("note-1");
    acquireYjsContext("note-1");
    releaseYjsContext("note-1");
    releaseYjsContext("note-1");
    flushGrace();

    expect(cachedContextCount()).toBe(0);
    expect(destroyed.ws).toBe(1);
    expect(destroyed.idb).toBe(1);
  });

  it("does not leak when many notes are opened and closed, as quick-notes does", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `note-${i}`);
    ids.forEach((id) => acquireYjsContext(id));
    expect(cachedContextCount()).toBe(12);

    ids.forEach((id) => releaseYjsContext(id));
    flushGrace();

    expect(cachedContextCount()).toBe(0);
    expect(destroyed.ws).toBe(12);
  });

  it("reuses the context when re-acquired inside the grace window", () => {
    const first = acquireYjsContext("note-1");
    releaseYjsContext("note-1");

    // Back-and-forth navigation: the pending teardown must be cancelled, not honoured.
    const second = acquireYjsContext("note-1");
    flushGrace();

    expect(second).toBe(first);
    expect(cachedContextCount()).toBe(1);
    expect(destroyed.ws).toBe(0);
  });

  it("ignores a release for a note that was never acquired", () => {
    expect(() => releaseYjsContext("never-seen")).not.toThrow();
    expect(cachedContextCount()).toBe(0);
  });
});

describe("forgetYjsContext", () => {
  it("tears down immediately and drops the note's database", () => {
    acquireYjsContext("note-1");
    acquireYjsContext("note-1"); // two holders — deletion must not wait for them

    forgetYjsContext("note-1");

    expect(cachedContextCount()).toBe(0);
    expect(destroyed.ws).toBe(1);
    expect(deletedDatabases).toEqual([idbNameFor("note-1")]);
  });

  it("is safe for a note with no cached context", () => {
    expect(() => forgetYjsContext("note-x")).not.toThrow();
    expect(deletedDatabases).toEqual([idbNameFor("note-x")]);
  });
});

describe("destroyAllYjsContexts", () => {
  it("tears everything down, as logout requires", () => {
    acquireYjsContext("note-1");
    acquireYjsContext("note-2");
    acquireYjsContext("note-3");

    destroyAllYjsContexts();

    // Providers capture the auth token once at construction, so anything left open after
    // logout stays authenticated as the previous user until a full page reload.
    expect(cachedContextCount()).toBe(0);
    expect(destroyed.ws).toBe(3);
  });

  it("cancels pending teardowns so none fire afterwards", () => {
    acquireYjsContext("note-1");
    releaseYjsContext("note-1");

    destroyAllYjsContexts();
    expect(destroyed.ws).toBe(1);

    flushGrace();
    expect(destroyed.ws).toBe(1);
  });
});
