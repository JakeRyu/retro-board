"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Board, Card, Column } from "./retro";
import { SEED_BOARD } from "./retro";

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
  boards: [structuredClone(SEED_BOARD)],
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
    const payload: PersistShape = {
      schemaVersion: state.schemaVersion,
      boards: state.boards,
      activeBoardId: state.activeBoardId,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or privacy-mode failure: drop silently. Memory state still works.
  }
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
      state = {
        schemaVersion: SCHEMA_VERSION,
        boards: parsed.boards as Board[],
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

export const storeActions = {
  setActiveBoardId(id: string) {
    if (state.activeBoardId === id) return;
    commit({ ...state, activeBoardId: id });
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

  deleteCard(cardId: string) {
    updateColumns((cols) =>
      cols.map((c) => ({
        ...c,
        cards: c.cards.filter((card) => card.id !== cardId),
      })),
    );
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
