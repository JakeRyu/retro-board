// In-memory energy check-in store. Same module-scoped-Map model as
// lib/presence.ts: single App Service instance, so state survives across
// requests and a restart simply wipes the check-in — acceptable for a
// one-off retro moment.
//
// Anonymity model — the two halves are deliberately unjoinable:
//
//   roster  : raw user ids. Answers "who was in the room" (the denominator).
//   ballots : keyed by an HMAC of the user id. Answers "what numbers came in".
//
// Nothing in this module can map a ballot back to a person, and the read API
// exposes no per-ballot data at all. Until `revealed` flips, `snapshot()`
// returns only counts — releasing the running average would let anyone
// watching the 1.5s poll diff the aggregate against a colleague's vote
// landing and recover their number.

import { createHmac } from "node:crypto";

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type EnergyResult = {
  average: number;
  /** average / 5 × 100 — a lone level-1 vote reads as a 20%-charged battery
   *  rather than a flat-empty one. */
  percent: number;
  /** Counts for levels 1–5 at indices 0–4. */
  distribution: number[];
};

export type EnergySnapshot = {
  count: number;
  total: number;
  mine: EnergyLevel | null;
  revealed: boolean;
  result: EnergyResult | null;
};

// Below this, a participant who knows their own number can deduce the
// remainder by elimination, so a reveal would not be anonymous.
export const MIN_REVEAL_VOTES = 3;

type BoardState = {
  ballots: Map<string, EnergyLevel>;
  roster: Map<string, number>;
  revealed: boolean;
};

// Roster entries age out so somebody who previewed the board days before the
// retro stops blocking the full-participation gate forever. Far longer than
// presence's seconds-scale TTL because this answers "who belongs to this
// check-in", not "who is on screen right now" — it has to survive a retro that
// starts late or runs over. Ballots are never pruned: leaving the meeting
// early withdraws you from the denominator, not from the result.
const ROSTER_TTL_MS = 3 * 60 * 60 * 1000;

const store = new Map<string, BoardState>();

function boardState(boardId: string): BoardState {
  let s = store.get(boardId);
  if (!s) {
    s = { ballots: new Map(), roster: new Map(), revealed: false };
    store.set(boardId, s);
  }
  return s;
}

// Pruned on read, like presence — no background sweeper needed.
function pruneRoster(s: BoardState): void {
  const cutoff = Date.now() - ROSTER_TTL_MS;
  for (const [userId, lastSeen] of s.roster) {
    if (lastSeen < cutoff) s.roster.delete(userId);
  }
}

function voterKey(boardId: string, userId: string): string {
  // Board-scoped so the same person is a different key on every retro.
  const salt = process.env.ENERGY_SALT || process.env.AUTH_SECRET || "";
  return createHmac("sha256", salt).update(`${boardId}:${userId}`).digest("hex");
}

export function isEnergyLevel(value: unknown): value is EnergyLevel {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** Roster heartbeat. Refreshed on every board GET, so anyone with the board
 *  open never ages out. */
export function touchRoster(boardId: string, userId: string): void {
  boardState(boardId).roster.set(userId, Date.now());
}

export function vote(
  boardId: string,
  userId: string,
  level: EnergyLevel,
): boolean {
  const s = boardState(boardId);
  if (s.revealed) return false;
  s.roster.set(userId, Date.now());
  s.ballots.set(voterKey(boardId, userId), level);
  return true;
}

export type RevealOutcome = "revealed" | "too-few" | "incomplete";

// Revealing is one-way — there is no un-reveal, because releasing an aggregate,
// taking a further vote and releasing again lets anyone difference the two
// results and recover the late voter's exact number.
//
// The normal path waits for everyone still on the roster. `force` covers the
// gap the TTL can't: someone who opened the board this morning, never voted,
// and isn't coming — the retro shouldn't have to wait three hours for them to
// age out. The anonymity floor applies either way.
export function reveal(boardId: string, force = false): RevealOutcome {
  const s = boardState(boardId);
  pruneRoster(s);
  const count = s.ballots.size;
  if (count < MIN_REVEAL_VOTES) return "too-few";
  if (!force && count < s.roster.size) return "incomplete";
  s.revealed = true;
  return "revealed";
}

export function snapshot(boardId: string, userId: string): EnergySnapshot {
  const s = boardState(boardId);
  pruneRoster(s);
  const count = s.ballots.size;
  return {
    count,
    // A voter who left early ages out of the roster but their ballot stays, so
    // without this the tally could read past 100%.
    total: Math.max(s.roster.size, count),
    mine: s.ballots.get(voterKey(boardId, userId)) ?? null,
    revealed: s.revealed,
    result: s.revealed ? tally(s) : null,
  };
}

function tally(s: BoardState): EnergyResult {
  const distribution = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const level of s.ballots.values()) {
    distribution[level - 1]++;
    sum += level;
  }
  const average = s.ballots.size === 0 ? 0 : sum / s.ballots.size;
  return {
    average,
    percent: Math.round((average / 5) * 100),
    distribution,
  };
}
