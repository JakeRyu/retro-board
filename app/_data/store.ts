"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Board, BoardType, Card, Column, Label } from "./retro";
import { BOARD_COLORS, SEED_BOARD, SEED_BOARDS, defaultLabels } from "./retro";

// Bump when the persisted shape changes in a way that needs migration.
export const SCHEMA_VERSION = 1;
const STORAGE_KEY = "retro-board:v1";
const WRITE_DEBOUNCE_MS = 300;

export type StoreState = {
  schemaVersion: number;
  boards: Board[];
  activeBoardId: string;
};

type PersistShape = {
  schemaVersion: number;
  boards: Board[];
  activeBoardId: string;
};

const seedState = (): StoreState => ({
  schemaVersion: SCHEMA_VERSION,
  // Deep clone the seed so mutations never write back into the module-level
  // constant — that would corrupt the seed for any subsequent fresh boot.
  boards: SEED_BOARDS.map((b) => structuredClone(b)),
  activeBoardId: SEED_BOARD.id,
});

// --- pub-sub primitive ---------------------------------------------------
// We keep state in a module-level variable + manual subscribers so the store
// is independent of React lifecycle and SSR-safe (no localStorage at import).

let state: StoreState = seedState();
let hydrated = false;
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

// --- persistence ---------------------------------------------------------

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWrite() {
  if (typeof window === "undefined") return;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flush, WRITE_DEBOUNCE_MS);
}

function flush() {
  if (typeof window === "undefined") return;
  writeTimer = null;
  try {
    writeNow();
  } catch {
    // Quota or privacy-mode failure: drop silently. Memory state still works.
  }
}

// Synchronous write that surfaces failures. Used by mutations whose UI must
// know about a storage-full error (e.g. create-board dialog).
function writeNow() {
  if (typeof window === "undefined") return;
  const payload: PersistShape = {
    schemaVersion: state.schemaVersion,
    boards: state.boards,
    activeBoardId: state.activeBoardId,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

// Backfill fields added after a board was first persisted. Runs on every
// hydrate so boards in old localStorage payloads pick up new defaults.
function migrateBoard(b: Board): Board {
  if (!Array.isArray(b.labels)) {
    return { ...b, labels: defaultLabels() };
  }
  return b;
}

function hydrateFromStorage() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // First launch: persist the seed so future loads skip the seed branch.
      flush();
      return;
    }
    const parsed = JSON.parse(raw) as Partial<PersistShape>;
    if (
      parsed &&
      typeof parsed.schemaVersion === "number" &&
      Array.isArray(parsed.boards) &&
      parsed.boards.length > 0 &&
      typeof parsed.activeBoardId === "string"
    ) {
      // Future migrations will branch on parsed.schemaVersion here.
      const migrated = (parsed.boards as Board[]).map(migrateBoard);
      state = {
        schemaVersion: SCHEMA_VERSION,
        boards: migrated,
        activeBoardId: parsed.activeBoardId,
      };
      emit();
    }
  } catch {
    // Corrupt payload — fall through to in-memory seed.
  }
}

// --- mutations -----------------------------------------------------------

function commit(next: StoreState) {
  state = next;
  emit();
  scheduleWrite();
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
}

function defaultColumnsFor(type: BoardType): Column[] {
  if (type === "retro") {
    return [
      { id: "c-went-well", title: "What went well", desc: "", cards: [] },
      { id: "c-didnt", title: "What didn't", desc: "", cards: [] },
      { id: "c-try", title: "Try next time", desc: "", cards: [] },
      { id: "c-shout", title: "Shout-outs", desc: "", cards: [] },
    ];
  }
  return [
    { id: "c-todo", title: "To do", desc: "", cards: [] },
    { id: "c-doing", title: "In progress", desc: "", cards: [] },
    { id: "c-done", title: "Done", desc: "", cards: [] },
  ];
}

export type CreateBoardInput = {
  title: string;
  type: BoardType;
  color: string;
  theme?: string;
};

export const storeActions = {
  setActiveBoardId(id: string) {
    if (state.activeBoardId === id) return;
    commit({ ...state, activeBoardId: id });
  },

  // Persists synchronously and rethrows on storage failure so the caller
  // (the create-board dialog) can show an inline error.
  createBoard(input: CreateBoardInput): string {
    const now = new Date().toISOString();
    const id = "b-" + Date.now().toString(36);
    const color = BOARD_COLORS.includes(input.color as (typeof BOARD_COLORS)[number])
      ? input.color
      : BOARD_COLORS[0];
    const board: Board = {
      id,
      type: input.type,
      title: input.title,
      theme: input.theme ?? "",
      created: now.slice(0, 10),
      state: "open",
      createdAt: now,
      updatedAt: now,
      starred: false,
      color,
      columns: defaultColumnsFor(input.type),
      labels: defaultLabels(),
    };
    const prevState = state;
    state = {
      ...state,
      boards: [...state.boards, board],
      activeBoardId: id,
    };
    emit();
    // Force a synchronous write so storage-full surfaces before navigation.
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }
    try {
      writeNow();
    } catch (err) {
      // Roll back so the failed write doesn't leave a phantom board in memory.
      state = prevState;
      emit();
      throw err;
    }
    return id;
  },

  toggleStar(boardId: string) {
    updateBoardById(boardId, (b) => ({ ...b, starred: !b.starred }));
  },

  setBoardTitle(title: string) {
    updateActiveBoard((b) => ({ ...b, title }));
  },

  setBoardState(s: "open" | "closed") {
    updateActiveBoard((b) => ({ ...b, state: s }));
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

  deleteCard(cardId: string) {
    updateColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.filter((card) => card.id !== cardId),
      })),
    );
  },

  addColumn(boardId: string, title: string = "New column"): string {
    const id = "col-" + Date.now().toString(36);
    const column: Column = { id, title, desc: "", cards: [] };
    updateBoardById(boardId, (b) => ({ ...b, columns: [...b.columns, column] }));
    return id;
  },

  renameColumn(boardId: string, columnId: string, title: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
  },

  deleteColumn(boardId: string, columnId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.filter((c) => c.id !== columnId),
    }));
  },

  // Move a card across (or within) columns to an explicit index in the target.
  // No-op when source and destination resolve to the same slot.
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

  // --- Labels (F-11) ------------------------------------------------------

  addLabel(boardId: string, name: string, color: string): string {
    const id = "lbl-" + Date.now().toString(36);
    const label: Label = { id, name: name.trim(), color };
    updateBoardById(boardId, (b) => ({ ...b, labels: [...b.labels, label] }));
    return id;
  },

  updateLabel(boardId: string, labelId: string, patch: Partial<Omit<Label, "id">>) {
    updateBoardById(boardId, (b) => ({
      ...b,
      labels: b.labels.map((l) =>
        l.id === labelId
          ? {
              ...l,
              ...patch,
              // Trim a name patch the same way addLabel does so storage stays clean.
              ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            }
          : l,
      ),
    }));
  },

  // Drops the label and sweeps every card.labels array on the board so we
  // never leave dangling label ids behind. Render code also defensively
  // filters unknown ids, but cleaning at the source keeps storage tidy.
  deleteLabel(boardId: string, labelId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      labels: b.labels.filter((l) => l.id !== labelId),
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) =>
          card.labels && card.labels.includes(labelId)
            ? { ...card, labels: card.labels.filter((id) => id !== labelId) }
            : card,
        ),
      })),
    }));
  },

  toggleCardLabel(boardId: string, cardId: string, labelId: string) {
    updateBoardById(boardId, (b) => ({
      ...b,
      columns: b.columns.map((c) => ({
        ...c,
        cards: c.cards.map((card) => {
          if (card.id !== cardId) return card;
          const current = card.labels ?? [];
          const has = current.includes(labelId);
          const next = has
            ? current.filter((id) => id !== labelId)
            : [...current, labelId];
          // Drop the field entirely when empty so persisted shape stays minimal.
          return { ...card, labels: next.length ? next : undefined };
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
};

// --- React hooks ---------------------------------------------------------

export function useStore(): StoreState {
  // Trigger one-shot hydrate on mount (client only).
  const hydrateRef = useRef(false);
  const [, force] = useState(0);
  useEffect(() => {
    if (hydrateRef.current) return;
    hydrateRef.current = true;
    hydrateFromStorage();
    force((n) => n + 1);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useActiveBoard(): Board {
  const s = useStore();
  const board = s.boards.find((b) => b.id === s.activeBoardId);
  // Active id always points at a real board because seed initialises it and
  // mutations preserve the invariant. Fall back defensively for the very edge
  // case of a corrupt persisted payload.
  return board ?? s.boards[0] ?? SEED_BOARD;
}

// Returns the board with this id, or undefined if no such board exists.
// Used by per-board routes so they can render a "not found" panel.
export function useBoard(id: string): Board | undefined {
  const s = useStore();
  if (!id) return undefined;
  return s.boards.find((b) => b.id === id);
}

// Test/dev helper — not used in product code.
export function __resetStoreForTests() {
  state = seedState();
  hydrated = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  emit();
}
