"use client";

import { useEffect, useSyncExternalStore } from "react";
import type {
  Board,
  Card,
  ActionItem,
  Column,
} from "./retro";
import { BOARD_COLORS, DEFAULT_WORKSPACE_ID, WORKSPACES } from "./retro";
import { fireToast } from "../_hooks/useToast";

// Bump when the persisted shape changes in a way that needs migration.
export const SCHEMA_VERSION = 2;
// Debounce window for the server PUT that follows board mutations. Matches
// the prior localStorage debounce so DnD burst-write characteristics are
// unchanged from the user's perspective.
const PUT_DEBOUNCE_MS = 300;

export type StoreState = {
  schemaVersion: number;
  boards: Board[];
  activeBoardId: string;
  // F-24: which workspace's boards the sidebar list and `/` tile view show.
  // Per-board pages route by id and ignore this.
  activeWorkspaceId: string;
};

// F-26-E: empty initial state. The seed boards moved to scripts/seed-cosmos.ts
// (only the server-side seed knows about them). On mount, page-level effects
// fetch from Cosmos and populate the store.
const emptyState = (): StoreState => ({
  schemaVersion: SCHEMA_VERSION,
  boards: [],
  activeBoardId: "",
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
});

// --- pub-sub primitive ---------------------------------------------------
// We keep state in a module-level variable + manual subscribers so the store
// is independent of React lifecycle and SSR-safe.

let state: StoreState = emptyState();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): StoreState {
  return state;
}

// Identical snapshot during SSR and on the first client render — required to
// avoid hydration mismatch when using `useSyncExternalStore`.
function getServerSnapshot(): StoreState {
  return state;
}

// --- server write path (F-26-C) ------------------------------------------
// Per-board Cosmos ETags. Captured on every successful fetch / PUT / POST;
// echoed back as If-Match on PUT. Empty when we've never seen a board from
// the server (legitimate for boards created locally during a Cosmos outage).
const etags = new Map<string, string>();

// Per-board debounce timers + serialization promises. A mutation restarts the
// timer; on fire, the PUT is queued to run AFTER any in-flight PUT for the
// same board completes — so PUTs for one board are always ordered.
const putTimers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlightPuts = new Map<string, Promise<void>>();

function scheduleServerPut(boardId: string) {
  if (typeof window === "undefined") return;
  const existing = putTimers.get(boardId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    putTimers.delete(boardId);
    void serverPut(boardId);
  }, PUT_DEBOUNCE_MS);
  putTimers.set(boardId, timer);
}

async function serverPut(boardId: string): Promise<void> {
  const prev = inFlightPuts.get(boardId);
  const next = (async () => {
    if (prev) await prev.catch(() => {});
    await doServerPut(boardId, false);
  })();
  inFlightPuts.set(boardId, next);
  try {
    await next;
  } finally {
    if (inFlightPuts.get(boardId) === next) inFlightPuts.delete(boardId);
  }
}

async function doServerPut(boardId: string, isRetry: boolean): Promise<void> {
  const board = state.boards.find((b) => b.id === boardId);
  if (!board) return;
  const etag = etags.get(boardId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (etag) headers["If-Match"] = etag;
  let res: Response;
  try {
    res = await fetch(`/api/boards/${encodeURIComponent(boardId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(board),
      cache: "no-store",
    });
  } catch {
    // Network blip — leave the dirty state alone; next mutation will retry.
    return;
  }
  if (res.status === 412) {
    // ETag mismatch: refetch (which replaces local with server) then retry
    // once. After refetch the local state matches the server, so the retry
    // is effectively idempotent and almost always succeeds.
    await storeActions.fetchBoardById(boardId).catch(() => {});
    if (isRetry) {
      fireToast("Your edits were replaced by a newer server version.");
      return;
    }
    return doServerPut(boardId, true);
  }
  if (!res.ok) {
    fireToast("Couldn't save changes to the server.");
    return;
  }
  const data = (await res.json()) as Board & { etag?: string };
  if (data.etag) etags.set(boardId, data.etag);
}

// --- mutations -----------------------------------------------------------

function commit(next: StoreState) {
  state = next;
  emit();
}

function touch(board: Board): Board {
  return { ...board, updatedAt: new Date().toISOString() };
}

function updateActiveBoard(updater: (b: Board) => Board) {
  const idx = state.boards.findIndex((b) => b.id === state.activeBoardId);
  if (idx < 0) return;
  const nextBoard = touch(updater(state.boards[idx]));
  const nextBoards = state.boards.slice();
  nextBoards[idx] = nextBoard;
  commit({ ...state, boards: nextBoards });
  scheduleServerPut(nextBoard.id);
}

function updateColumns(updater: (cols: Column[]) => Column[]) {
  updateActiveBoard((b) => ({ ...b, columns: updater(b.columns) }));
}

function updateBoardById(id: string, updater: (b: Board) => Board) {
  const idx = state.boards.findIndex((b) => b.id === id);
  if (idx < 0) return;
  const nextBoard = touch(updater(state.boards[idx]));
  const nextBoards = state.boards.slice();
  nextBoards[idx] = nextBoard;
  commit({ ...state, boards: nextBoards });
  scheduleServerPut(id);
}

function defaultColumns(): Column[] {
  return [
    {
      id: "c-went-well",
      title: "What went well",
      desc: "Wins worth celebrating.",
      cards: [],
    },
    {
      id: "c-didnt",
      title: "What didn't",
      desc: "Friction worth fixing.",
      cards: [],
    },
    {
      id: "c-try",
      title: "Try next time",
      desc: "Concrete experiments to try.",
      cards: [],
    },
    {
      id: "c-shout",
      title: "Shout-outs",
      desc: "Who deserves a thank-you?",
      cards: [],
    },
  ];
}

export type CreateBoardInput = {
  title: string;
  color: string;
  theme?: string;
};

export const storeActions = {
  setActiveBoardId(id: string) {
    if (state.activeBoardId === id) return;
    commit({ ...state, activeBoardId: id });
  },

  // F-24: switch the active workspace. No-op when the id is unchanged or
  // doesn't match any seeded workspace. Does NOT change activeBoardId — board
  // pages route by id and remain reachable across workspaces.
  setActiveWorkspace(id: string) {
    if (state.activeWorkspaceId === id) return;
    if (!WORKSPACES.some((w) => w.id === id)) return;
    commit({ ...state, activeWorkspaceId: id });
  },

  // Optimistic insert + POST to /api/boards. On failure, rolls back so a
  // phantom board never lingers in memory. Returns the new id; throws when
  // the server rejects the create so the dialog can surface an inline error.
  async createBoard(input: CreateBoardInput): Promise<string> {
    const now = new Date().toISOString();
    const id = "b-" + Date.now().toString(36);
    const color = BOARD_COLORS.includes(input.color as (typeof BOARD_COLORS)[number])
      ? input.color
      : BOARD_COLORS[0];
    const board: Board = {
      id,
      type: "retro",
      workspaceId: state.activeWorkspaceId,
      title: input.title,
      theme: input.theme ?? "",
      created: now.slice(0, 10),
      state: "open",
      createdAt: now,
      updatedAt: now,
      starred: false,
      color,
      columns: defaultColumns(),
      archivedCards: [],
    };
    const prevState = state;
    state = {
      ...state,
      boards: [...state.boards, board],
      activeBoardId: id,
    };
    emit();
    let res: Response;
    try {
      res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
        cache: "no-store",
      });
    } catch (err) {
      state = prevState;
      emit();
      throw err;
    }
    if (!res.ok) {
      state = prevState;
      emit();
      throw new Error(`Create failed: ${res.status}`);
    }
    const created = (await res.json()) as Board & { etag?: string };
    if (created.etag) etags.set(created.id, created.etag);
    return id;
  },

  toggleStar(boardId: string) {
    updateBoardById(boardId, (b) => {
      const next = !b.starred;
      return {
        ...b,
        starred: next,
        starredAt: next ? new Date().toISOString() : undefined,
      };
    });
  },

  setBoardTitle(title: string) {
    updateActiveBoard((b) => ({ ...b, title }));
  },

  setBoardState(s: "open" | "closed") {
    updateActiveBoard((b) => ({ ...b, state: s }));
  },

  // F-17: edit the retro theme prompt from the board settings menu.
  // Trims trailing whitespace; empty is allowed (theme bar collapses cleanly).
  setBoardTheme(boardId: string, theme: string) {
    const next = theme.replace(/\s+$/, "");
    updateBoardById(boardId, (b) => ({ ...b, theme: next }));
  },

  // F-17: soft delete. Stamps archivedAt; the boards-list page groups archived
  // boards into their own collapsed section. Reversible via unarchiveBoard.
  // No-op when the board is already archived so a stale confirm in another
  // tab can't double-stamp.
  archiveBoard(boardId: string) {
    updateBoardById(boardId, (b) =>
      b.archivedAt ? b : { ...b, archivedAt: new Date().toISOString() },
    );
  },

  // F-17: clear the archive stamp. Idempotent: no-op when already unarchived.
  unarchiveBoard(boardId: string) {
    updateBoardById(boardId, (b) =>
      b.archivedAt ? { ...b, archivedAt: undefined } : b,
    );
  },

  // F-17: flip a closed board back to open. Replaces the half-implemented
  // one-way close from the original design. Idempotent.
  reopenBoard(boardId: string) {
    updateBoardById(boardId, (b) =>
      b.state === "open" ? b : { ...b, state: "open" },
    );
  },

  setColumns(cols: Column[]) {
    updateColumns(() => cols);
  },

  toggleVote(cardId: string, voterId: string = "me") {
    updateColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId) return card;
          const has = card.voters.includes(voterId);
          return {
            ...card,
            voters: has
              ? card.voters.filter((v) => v !== voterId)
              : [...card.voters, voterId],
          };
        }),
      })),
    );
  },

  addCard(colId: string, body: string, authorId: string = "me"): string {
    const id = "n" + Date.now();
    const card: Card = { id, body, authorId, voters: [] };
    updateColumns((cols) =>
      cols.map((c) =>
        c.id === colId ? { ...c, cards: [card, ...c.cards] } : c,
      ),
    );
    return id;
  },

  saveCard(cardId: string, body: string) {
    updateColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.id === cardId ? { ...card, body } : card,
        ),
      })),
    );
  },

  // Empty / whitespace-only descriptions are stored as `undefined` so the card
  // preview indicator (F-08) and any future "has description" filter can
  // simply check `card.description`.
  setCardDescription(boardId: string, cardId: string, description: string) {
    const trimmed = description.trim();
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.id === cardId
            ? { ...card, description: trimmed === "" ? undefined : trimmed }
            : card,
        ),
      })),
    }));
  },

  // --- Archive (F-14) ----------------------------------------------------

  // Move a live card out of its column into board.archivedCards. Stamps
  // archivedAt + originColumnId so unarchive can return it. No-op if the card
  // isn't currently live in any column on this board.
  archiveCard(boardId: string, cardId: string) {
    updateBoardById(boardId, (b) => {
      const fromCol = b.columns.find((c) =>
        c.cards.some((card) => card.id === cardId),
      );
      if (!fromCol) return b;
      const card = fromCol.cards.find((c) => c.id === cardId);
      if (!card) return b;
      const archived: Card = {
        ...card,
        archivedAt: new Date().toISOString(),
        originColumnId: fromCol.id,
      };
      return {
        ...b,
        columns: b.columns.map((c) =>
          c.id === fromCol.id
            ? { ...c, cards: c.cards.filter((x) => x.id !== cardId) }
            : c,
        ),
        archivedCards: [...b.archivedCards, archived],
      };
    });
  },

  // Pull a card out of board.archivedCards and reinsert it at the top of its
  // origin column. Falls back to the first column if the origin is gone.
  // No-op if the card isn't archived, or if the board has zero columns.
  unarchiveCard(boardId: string, cardId: string) {
    updateBoardById(boardId, (b) => {
      const card = b.archivedCards.find((c) => c.id === cardId);
      if (!card) return b;
      if (b.columns.length === 0) return b;
      const target =
        b.columns.find((c) => c.id === card.originColumnId) ?? b.columns[0];
      const live: Card = { ...card };
      delete live.archivedAt;
      delete live.originColumnId;
      return {
        ...b,
        columns: b.columns.map((c) =>
          c.id === target.id ? { ...c, cards: [live, ...c.cards] } : c,
        ),
        archivedCards: b.archivedCards.filter((c) => c.id !== cardId),
      };
    });
  },

  // Hard delete from the archive bucket. Archived-only by contract: if the
  // id resolves to a live card in any column, this is a no-op (callers must
  // archive first, then delete forever). Used by the archive panel and the
  // modal sidebar's "Delete forever" action.
  deleteCardForever(boardId: string, cardId: string) {
    updateBoardById(boardId, (b) => {
      const inArchive = b.archivedCards.some((c) => c.id === cardId);
      if (!inArchive) return b;
      return {
        ...b,
        archivedCards: b.archivedCards.filter((c) => c.id !== cardId),
      };
    });
  },

  addColumn(boardId: string, title: string = "New column"): string {
    const id = "col-" + Date.now().toString(36);
    const column: Column = { id, title, desc: "", cards: [] };
    updateBoardById(boardId, (b) => {
      const cols = b.columns.slice();
      // If the rightmost column is the Action column, insert the new prompt
      // column before it so the Action column always stays rightmost.
      const last = cols[cols.length - 1];
      if (last?.kind === "action") {
        cols.splice(cols.length - 1, 0, column);
      } else {
        cols.push(column);
      }
      return { ...b, columns: cols };
    });
    return id;
  },

  renameColumn(boardId: string, columnId: string, title: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
  },

  // F-25: edit a column's description. Trims trailing whitespace and slices
  // to 200 chars defensively. Empty string is allowed — that's how the user
  // clears desc back to the placeholder state.
  setColumnDesc(boardId: string, columnId: string, desc: string) {
    const trimmed = desc.replace(/\s+$/, "").slice(0, 200);
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) =>
        c.id === columnId ? { ...c, desc: trimmed } : c,
      ),
    }));
  },

  deleteColumn(boardId: string, columnId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.filter((c) => c.id !== columnId),
    }));
  },

  // F-23: create or replace the Action column. If a column with
  // `kind === "action"` already exists, replace its cards array wholesale.
  // Otherwise append a new Action column at the end of board.columns.
  buildActionColumn(boardId: string, actionCards: Card[]) {
    updateBoardById(boardId, (b) => {
      const existingIdx = b.columns.findIndex((c) => c.kind === "action");
      if (existingIdx >= 0) {
        const updated = b.columns.slice();
        updated[existingIdx] = { ...updated[existingIdx], cards: actionCards };
        return { ...b, columns: updated };
      }
      const newCol: Column = {
        id: crypto.randomUUID(),
        kind: "action",
        title: "Action",
        desc: "",
        cards: actionCards,
      };
      return { ...b, columns: [...b.columns, newCol] };
    });
  },

  // F-22: re-insertion helper used by the column-delete Undo. Takes a full
  // Column object (cards and all) and splices it back at `index`, clamped to
  // [0, columns.length] so a delete-then-reorder-then-undo can't crash. No-op
  // if a column with the same id is already present (defensive against a
  // double-undo race).
  insertColumn(boardId: string, column: Column, index: number) {
    updateBoardById(boardId, (b) => {
      if (b.columns.some((c) => c.id === column.id)) return b;
      const next = b.columns.slice();
      const target = Math.max(0, Math.min(index, next.length));
      next.splice(target, 0, column);
      return { ...b, columns: next };
    });
  },

  // Move a card across (or within) columns to an explicit index in the target.
  // No-op when source and destination resolve to the same slot.
  // Cross-column moves are rejected when either the source or target column
  // has kind === "action" — Action cards may only be reordered within their
  // own column, and prompt cards cannot be dragged into the Action column.
  moveCard(
    boardId: string,
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    toIndex: number,
  ) {
    updateBoardById(boardId, (b) => {
      const fromCol = b.columns.find((c) => c.id === fromColumnId);
      if (!fromCol) return b;
      const card = fromCol.cards.find((c) => c.id === cardId);
      if (!card) return b;

      // Reject cross-column moves involving the Action column. Within-column
      // reorder (fromColumnId === toColumnId) is always permitted.
      if (fromColumnId !== toColumnId) {
        const toCol = b.columns.find((c) => c.id === toColumnId);
        if (fromCol.kind === "action" || toCol?.kind === "action") return b;
      }

      // Same-column reorder: splice out, then insert at the (possibly shifted)
      // target index so callers can pass either pre- or post-removal indexes
      // and get the expected visual result.
      if (fromColumnId === toColumnId) {
        const fromIdx = fromCol.cards.findIndex((c) => c.id === cardId);
        if (fromIdx < 0) return b;
        const without = fromCol.cards.slice();
        without.splice(fromIdx, 1);
        const target = Math.max(0, Math.min(toIndex, without.length));
        if (target === fromIdx) return b;
        without.splice(target, 0, card);
        return {
          ...b,
          columns: b.columns.map((c) =>
            c.id === fromColumnId ? { ...c, cards: without } : c,
          ),
        };
      }

      return {
        ...b,
        columns: b.columns.map((c) => {
          if (c.id === fromColumnId) {
            return { ...c, cards: c.cards.filter((x) => x.id !== cardId) };
          }
          if (c.id === toColumnId) {
            const next = c.cards.slice();
            const target = Math.max(0, Math.min(toIndex, next.length));
            next.splice(target, 0, card);
            return { ...c, cards: next };
          }
          return c;
        }),
      };
    });
  },

  // --- Action items (F-09) ---------------------------------------------------

  // Append a new item; returns the generated id so the caller can focus or
  // animate it. Empty/whitespace text is rejected (no-op, returns "").
  addActionItem(boardId: string, cardId: string, text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return "";
    const id = "ai-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000).toString(36);
    const item: ActionItem = { id, text: trimmed, done: false };
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId) return card;
          const next = [...(card.actionItems ?? []), item];
          return { ...card, actionItems: next };
        }),
      })),
    }));
    return id;
  },

  toggleActionItem(boardId: string, cardId: string, itemId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId || !card.actionItems) return card;
          return {
            ...card,
            actionItems: card.actionItems.map((it) =>
              it.id === itemId ? { ...it, done: !it.done } : it,
            ),
          };
        }),
      })),
    }));
  },

  // Trimmed empty text is rejected so the caller's revert path keeps the
  // prior value intact. The component layer also short-circuits, but
  // defending here keeps storage clean.
  editActionItem(boardId: string, cardId: string, itemId: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId || !card.actionItems) return card;
          return {
            ...card,
            actionItems: card.actionItems.map((it) =>
              it.id === itemId ? { ...it, text: trimmed } : it,
            ),
          };
        }),
      })),
    }));
  },

  // Drops the item; if the list empties, drops the field entirely so the
  // persisted shape stays minimal.
  deleteActionItem(boardId: string, cardId: string, itemId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId || !card.actionItems) return card;
          const next = card.actionItems.filter((it) => it.id !== itemId);
          return { ...card, actionItems: next.length ? next : undefined };
        }),
      })),
    }));
  },

  reorderColumn(boardId: string, columnId: string, toIndex: number) {
    updateBoardById(boardId, (b) => {
      const fromIdx = b.columns.findIndex((c) => c.id === columnId);
      if (fromIdx < 0) return b;
      const without = b.columns.slice();
      const [col] = without.splice(fromIdx, 1);
      const target = Math.max(0, Math.min(toIndex, without.length));
      if (target === fromIdx) return b;
      without.splice(target, 0, col);
      return { ...b, columns: without };
    });
  },

  // --- F-26-B/C: server fetches -----------------------------------------
  // These replace local state with the server's view on each mount. They
  // also capture per-board ETags so subsequent PUTs can echo If-Match.

  // Replace boards in `workspaceId` with the server result. Boards from other
  // workspaces are left untouched, so navigating between workspaces never
  // wipes the cached view of the other one. Captures each board's etag so
  // subsequent PUTs carry the right If-Match header.
  async fetchBoardsForWorkspace(workspaceId: string): Promise<void> {
    const res = await fetch(
      `/api/boards?workspaceId=${encodeURIComponent(workspaceId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`GET /api/boards: ${res.status}`);
    const fetched = (await res.json()) as (Board & { etag?: string })[];
    for (const b of fetched) {
      if (b.etag) etags.set(b.id, b.etag);
    }
    const others = state.boards.filter((b) => b.workspaceId !== workspaceId);
    const cleaned = fetched.map(({ etag: _etag, ...rest }) => {
      void _etag;
      return rest as Board;
    });
    commit({ ...state, boards: [...others, ...cleaned] });
  },

  // Replace a single board (by id) with the server result. Falls back to
  // appending when the board is unknown locally so a fresh user lands on a
  // board URL and still sees the data.
  async fetchBoardById(id: string): Promise<void> {
    const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return;
    if (!res.ok) throw new Error(`GET /api/boards/${id}: ${res.status}`);
    const payload = (await res.json()) as Board & { etag?: string };
    if (payload.etag) etags.set(id, payload.etag);
    const { etag: _etag, ...board } = payload;
    void _etag;
    const idx = state.boards.findIndex((b) => b.id === id);
    const nextBoards = state.boards.slice();
    if (idx >= 0) nextBoards[idx] = board as Board;
    else nextBoards.push(board as Board);
    commit({ ...state, boards: nextBoards });
  },

  // --- F-26-D: polling --------------------------------------------------
  // Single-board poll. Cheap when nothing changed (server replies 304 thanks
  // to If-None-Match). Skipped when this client has an unsent or in-flight
  // write for the same board so polling doesn't clobber the user's edits
  // before their own PUT lands.
  async pollBoardById(id: string): Promise<void> {
    if (putTimers.has(id) || inFlightPuts.has(id)) return;
    const etag = etags.get(id);
    const headers: Record<string, string> = {};
    if (etag) headers["If-None-Match"] = etag;
    let res: Response;
    try {
      res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
    } catch {
      return; // transient network issue — next tick retries
    }
    if (res.status === 304 || res.status === 404) return;
    if (!res.ok) return;
    const payload = (await res.json()) as Board & { etag?: string };
    if (payload.etag) etags.set(id, payload.etag);
    const { etag: _etag, ...board } = payload;
    void _etag;
    const idx = state.boards.findIndex((b) => b.id === id);
    const nextBoards = state.boards.slice();
    if (idx >= 0) nextBoards[idx] = board as Board;
    else nextBoards.push(board as Board);
    commit({ ...state, boards: nextBoards });
  },

  // List poll. Cheap path: full list refetch every tick (list-level ETag
  // would need a server-side aggregate; not worth it for 5–20 boards).
  // Re-uses fetchBoardsForWorkspace but swallows errors silently.
  async pollBoardsForWorkspace(workspaceId: string): Promise<void> {
    await storeActions.fetchBoardsForWorkspace(workspaceId).catch(() => {});
  },
};

// --- React hooks ---------------------------------------------------------

export function useStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Returns the board with this id, or undefined if no such board exists.
// Used by per-board routes so they can render a "not found" panel.
export function useBoard(id: string): Board | undefined {
  const s = useStore();
  if (!id) return undefined;
  return s.boards.find((b) => b.id === id);
}

// F-26-D: visibility-gated polling. Both hooks bail out of each tick when
// the tab is hidden — background tabs don't burn requests.
const BOARD_POLL_MS = 1500;
const LIST_POLL_MS = 2000;

function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useBoardPolling(boardId: string | undefined): void {
  useEffect(() => {
    if (!boardId) return;
    const tick = () => {
      if (!isVisible()) return;
      void storeActions.pollBoardById(boardId);
    };
    const handle = window.setInterval(tick, BOARD_POLL_MS);
    return () => window.clearInterval(handle);
  }, [boardId]);
}

export function useBoardsListPolling(workspaceId: string | undefined): void {
  useEffect(() => {
    if (!workspaceId) return;
    const tick = () => {
      if (!isVisible()) return;
      void storeActions.pollBoardsForWorkspace(workspaceId);
    };
    const handle = window.setInterval(tick, LIST_POLL_MS);
    return () => window.clearInterval(handle);
  }, [workspaceId]);
}

// Test/dev helper — not used in product code.
export function __resetStoreForTests() {
  state = emptyState();
  etags.clear();
  emit();
}
