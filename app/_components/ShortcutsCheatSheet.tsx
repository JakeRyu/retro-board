"use client";

import { useCallback, useEffect, useState } from "react";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";

// Module-level pub/sub mirrors useCreateBoardDialog: the cheat-sheet host
// mounts once inside <Sidebar>, and any caller (the global shortcut handler)
// fires `openShortcutsCheatSheet()` to show it.
const listeners = new Set<() => void>();

export function openShortcutsCheatSheet() {
  for (const l of listeners) l();
}

export function isShortcutsCheatSheetOpen(): boolean {
  // Read by the global keydown handler so we can suppress every shortcut
  // (other than Esc, which the modal owns) while the sheet is up.
  return openState;
}

let openState = false;

type Row = { keys: string[]; description: string };
type Group = { heading: string; rows: Row[] };

const GROUPS: Group[] = [
  {
    heading: "Global",
    rows: [
      { keys: ["?"], description: "Show this cheat-sheet" },
      { keys: ["b"], description: "Go to boards" },
    ],
  },
  {
    heading: "On a board",
    rows: [
      { keys: ["c"], description: "Add a card to the first column" },
    ],
  },
  {
    heading: "Drag & drop",
    rows: [
      { keys: ["Ctrl", "↑"], description: "Move card up" },
      { keys: ["Ctrl", "↓"], description: "Move card down" },
      { keys: ["Ctrl", "←", "/", "→"], description: "Move card across columns" },
      { keys: ["Ctrl", "⇧", "←", "/", "→"], description: "Move column" },
    ],
  },
  {
    heading: "Discussion mode",
    rows: [
      { keys: ["←", "/", "→"], description: "Previous / next column" },
      { keys: ["Esc"], description: "Exit discussion" },
    ],
  },
  {
    heading: "In a modal",
    rows: [{ keys: ["Esc"], description: "Close" }],
  },
];

export function ShortcutsCheatSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  // Mirror the open state into the module so other modules (the global
  // shortcut handler in particular) can read it synchronously.
  useEffect(() => {
    openState = open;
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  // F-21: pointerdown-vs-click guard (text-selection drags ending on the
  // overlay must not dismiss the sheet).
  const overlay = useOverlayDismiss(close);

  // Esc to close. The modal-overlay click handler covers overlay clicks.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      {...overlay.overlayProps}
    >
      <div
        className="modal modal-cheat-sheet"
        {...overlay.panelProps}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <h2>Keyboard shortcuts</h2>
        <div className="cheat-sheet">
          {GROUPS.map((g) => (
            <div key={g.heading}>
              <div className="cheat-group-heading">{g.heading}</div>
              {g.rows.map((row, i) => (
                <div key={i} className="cheat-row">
                  <span className="cheat-key">
                    {row.keys.map((k, j) =>
                      k === "/" ? (
                        <span key={j} style={{ color: "var(--fg4)" }}>/</span>
                      ) : (
                        <span key={j} className="kbd">{k}</span>
                      ),
                    )}
                  </span>
                  <span>{row.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
