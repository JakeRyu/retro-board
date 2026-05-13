// In-memory presence store. Module-scoped Map keyed by boardId; values are
// per-user Entries with `lastSeen` epoch ms. Stale entries (older than
// TTL_MS) are pruned on read, so we don't need a background sweeper.
//
// Persistence model: single App Service instance, so module state survives
// across requests. A restart wipes presence; the next round of polls (1.5s
// for the active board, 5s for /presence) repopulates within seconds.

type Entry = { name: string; lastSeen: number };

const store = new Map<string, Map<string, Entry>>();

// 5s = ~3× the 1.5s board-poll cadence. Wide enough to tolerate one missed
// tick + jitter; narrow enough that a user who closes the tab disappears
// within a turn.
const TTL_MS = 5_000;

export type PresenceUser = { id: string; name: string };

export function touch(boardId: string, userId: string, name: string): void {
  let board = store.get(boardId);
  if (!board) {
    board = new Map();
    store.set(boardId, board);
  }
  board.set(userId, { name, lastSeen: Date.now() });
}

export function snapshot(boardId: string): PresenceUser[] {
  const board = store.get(boardId);
  if (!board) return [];
  const cutoff = Date.now() - TTL_MS;
  const result: PresenceUser[] = [];
  for (const [userId, entry] of board) {
    if (entry.lastSeen < cutoff) {
      board.delete(userId);
      continue;
    }
    result.push({ id: userId, name: entry.name });
  }
  if (board.size === 0) store.delete(boardId);
  return result;
}
