"use client";

import type { Board } from "../_data/retro";

// v1: with no auth, every local user is treated as the owner of every board.
// Structured as a hook so the backend swap is one line — replace the body
// with `return board?.ownerId === currentUserId;` once auth lands.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useIsOwner(_board: Board | undefined): boolean {
  return true;
}
