"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tiny module-level pub/sub so that any component anywhere in the tree can
// open the create-board dialog without prop-drilling. The dialog itself is
// rendered once (by the Sidebar, which is present on every page).
//
// Each opener passes its trigger element so the dialog can return focus on
// close per F-03 spec §6.

const listeners = new Set<(trigger: HTMLElement | null) => void>();

export function openCreateBoardDialog(trigger: HTMLElement | null) {
  for (const l of listeners) l(trigger);
}

// Used by the dialog host (Sidebar). Returns `open` state, `triggerRef` (the
// element that opened the dialog), and `close()` to dismiss.
export function useCreateBoardDialogHost() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handler = (trigger: HTMLElement | null) => {
      triggerRef.current = trigger;
      setOpen(true);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to the trigger after the close transition has run.
    const trigger = triggerRef.current;
    if (trigger) {
      // Microtask-defer so React commits the close before we move focus.
      queueMicrotask(() => trigger.focus({ preventScroll: true }));
    }
  }, []);

  return { open, close };
}
