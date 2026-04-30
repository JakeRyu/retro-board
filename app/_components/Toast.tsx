"use client";

// F-22 — Global toast host. Renders the single visible toast pill plus an
// optional `Undo` action link. Mounted by <Sidebar>; fired via fireToast() from
// anywhere in the tree (see `app/_hooks/useToast.ts`).

import { useToastHost } from "../_hooks/useToast";

export function Toast() {
  const { toast, dismiss } = useToastHost();

  const onUndo = () => {
    if (!toast?.undo) return;
    toast.undo();
    dismiss();
  };

  return (
    <div className={"toast" + (toast ? " show" : "")} aria-live="polite">
      {toast?.message}
      {toast?.undo && (
        <>
          <span className="toast-sep" aria-hidden>
            ·
          </span>
          <button
            type="button"
            className="toast-undo"
            onClick={onUndo}
            aria-label="Undo"
          >
            Undo
          </button>
        </>
      )}
    </div>
  );
}
