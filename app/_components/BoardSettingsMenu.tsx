"use client";

// F-17 — Board settings popover, mounted in the topbar after `Close board`.
//
// Surfaces a kebab/settings trigger. Clicking opens a small menu of board-level
// actions; each one either flips state (reopen / unarchive), opens a confirm
// (archive board), or opens a sub-modal/panel owned by the parent (edit theme,
// manage labels, archived items). The menu items vary by board type and state
// per the F-17 spec §3.

import { useEffect, useRef, useState } from "react";
import { LabelPicker } from "./Labels";
import type { Board, Label } from "../_data/retro";

type BoardSettingsMenuProps = {
  board: Board;
  /** v1: always true via useIsOwner; the trigger is hidden entirely otherwise. */
  isOwner: boolean;
  onEditTheme: () => void;
  onManageLabels: () => void;
  onOpenArchive: () => void;
  onArchiveBoard: () => void;
  onReopenBoard: () => void;
  onUnarchiveBoard: () => void;
  /** F-20 retro-only exports. Both pass the board through; the parent owns
   *  clipboard + toast wiring so this menu stays presentational. */
  onCopyActionItems?: () => void;
  onCopyFullSummary?: () => void;
};

export function BoardSettingsMenu({
  board,
  isOwner,
  onEditTheme,
  onManageLabels,
  onOpenArchive,
  onArchiveBoard,
  onReopenBoard,
  onUnarchiveBoard,
  onCopyActionItems,
  onCopyFullSummary,
}: BoardSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-away to dismiss — same mousedown pattern as BoardCard's kebab.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isOwner) return null;

  const closed = board.state === "closed";
  const archived = !!board.archivedAt;
  const isRetro = board.type === "retro";
  const archivedCount = board.archivedCards.length;

  // Section visibility per spec §3 / §8.
  const showEditTheme = isRetro && !closed && !archived;
  const showManageLabels = !closed && !archived;
  const showArchiveBoard = !archived;
  const showReopen = closed && !archived;
  const showUnarchive = archived;
  // F-20: retro exports work even on closed / archived boards (read-only
  // doesn't prevent reading) — exporting a finished retro is the whole point.
  const showExports = isRetro && !!onCopyActionItems && !!onCopyFullSummary;
  // Divider sits between the "view" actions and the state-changing actions
  // when at least one of the latter is visible.
  const showDivider = showArchiveBoard || showReopen || showUnarchive;

  const click = (fn: () => void) => () => {
    setOpen(false);
    // Defer one frame so the menu unmounts before any sub-modal opens.
    // Without this, a confirm modal opening in the same tick can fight the
    // click-away listener still attached to the menu.
    requestAnimationFrame(fn);
  };

  return (
    <div className="board-settings-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn-icon board-settings-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Board settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <KebabGlyph />
      </button>
      {open && (
        <div
          className="kebab-menu board-settings-menu"
          role="menu"
        >
          {showEditTheme && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={click(onEditTheme)}
            >
              Edit theme prompt
            </button>
          )}
          {showManageLabels && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={click(onManageLabels)}
            >
              Manage labels
            </button>
          )}
          {showExports && (
            <>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={click(onCopyActionItems!)}
              >
                Copy action items
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={click(onCopyFullSummary!)}
              >
                Copy full retro summary
              </button>
            </>
          )}
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={click(onOpenArchive)}
          >
            Archived items
            <span className="menu-item-count">({archivedCount})</span>
          </button>
          {showDivider && <div className="menu-divider" role="separator" />}
          {showReopen && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={click(onReopenBoard)}
            >
              Reopen board
            </button>
          )}
          {showUnarchive && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={click(onUnarchiveBoard)}
            >
              Unarchive board
            </button>
          )}
          {showArchiveBoard && (
            <button
              type="button"
              className="menu-item danger"
              role="menuitem"
              onClick={click(onArchiveBoard)}
            >
              Archive board
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function KebabGlyph() {
  // Vertical dots — anchors a "more menu" affordance and visually distinguishes
  // it from BoardCard's horizontal kebab (which sits inside a tile, not a topbar).
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// EditThemeModal — small inline modal for editing board.theme
// ---------------------------------------------------------------------------

type EditThemeModalProps = {
  open: boolean;
  initialValue: string;
  onCancel: () => void;
  onSave: (value: string) => void;
};

export function EditThemeModal({
  open,
  initialValue,
  onCancel,
  onSave,
}: EditThemeModalProps) {
  const [draft, setDraft] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pointerStartedOnOverlay = useRef(false);

  // Reset draft each time the modal opens so a stale draft from a previous
  // open doesn't leak in.
  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    // Defer focus a frame so the modal slide-in finishes before scroll-into-view.
    const id = requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartedOnOverlay.current = e.target === e.currentTarget;
  };
  const onPanelPointerDown = () => {
    pointerStartedOnOverlay.current = false;
  };
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!pointerStartedOnOverlay.current) return;
    pointerStartedOnOverlay.current = false;
    onCancel();
  };

  const submit = () => onSave(draft);

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      onPointerDown={onOverlayPointerDown}
      onClick={onOverlayClick}
      aria-hidden={!open}
    >
      <div
        className="modal modal-edit-theme"
        onPointerDown={onPanelPointerDown}
        role="dialog"
        aria-modal="true"
        aria-label="Edit theme prompt"
      >
        <h2>Edit theme prompt</h2>
        <textarea
          ref={textareaRef}
          className="edit-theme-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={5}
          placeholder="What's the focus for this retro?"
        />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ManageLabelsModal — wraps LabelPicker in management mode
// ---------------------------------------------------------------------------

type ManageLabelsModalProps = {
  open: boolean;
  boardId: string;
  labels: Label[];
  onClose: () => void;
};

export function ManageLabelsModal({
  open,
  boardId,
  labels,
  onClose,
}: ManageLabelsModalProps) {
  const pointerStartedOnOverlay = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartedOnOverlay.current = e.target === e.currentTarget;
  };
  const onPanelPointerDown = () => {
    pointerStartedOnOverlay.current = false;
  };
  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!pointerStartedOnOverlay.current) return;
    pointerStartedOnOverlay.current = false;
    onClose();
  };

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      onPointerDown={onOverlayPointerDown}
      onClick={onOverlayClick}
      aria-hidden={!open}
    >
      <div
        className="modal modal-manage-labels"
        onPointerDown={onPanelPointerDown}
        role="dialog"
        aria-modal="true"
        aria-label="Manage labels"
      >
        <h2>Manage labels</h2>
        <LabelPicker
          boardId={boardId}
          cardId=""
          labels={labels}
          cardLabelIds={[]}
          readOnly={false}
          canEdit
          manageOnly
        />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
