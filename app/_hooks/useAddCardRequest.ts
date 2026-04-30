"use client";

import { useEffect } from "react";

// Tiny pub/sub used by the F-19 `c` shortcut to nudge a Column into its
// "Add a card" composer state. The shortcut handler in RetroApp resolves
// the first column's id and fires `requestAddCard(colId)`; the matching
// Column subscribes and flips its local `adding` state, which already
// auto-focuses the textarea via the column's existing effect.

const listeners = new Set<(colId: string) => void>();

export function requestAddCard(colId: string) {
  for (const l of listeners) l(colId);
}

export function useAddCardRequest(colId: string, onRequested: () => void) {
  useEffect(() => {
    const handler = (id: string) => {
      if (id === colId) onRequested();
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [colId, onRequested]);
}
