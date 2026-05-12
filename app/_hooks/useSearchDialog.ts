"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Module-level pub/sub mirroring useCreateBoardDialog so ⌘K (from
// GlobalShortcuts) and the sidebar Search button can both open the dialog
// without prop-drilling. The dialog is rendered once by <Sidebar>.

const listeners = new Set<(trigger: HTMLElement | null) => void>();

export function openSearchDialog(trigger: HTMLElement | null) {
  for (const l of listeners) l(trigger);
}

export function useSearchDialogHost() {
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
    const trigger = triggerRef.current;
    if (trigger) {
      queueMicrotask(() => trigger.focus({ preventScroll: true }));
    }
  }, []);

  return { open, close };
}
