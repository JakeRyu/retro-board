"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "../_data/retro";
import { storeActions } from "../_data/store";
import { dueDateStatus, formatDueDate } from "../_lib/dueDateStatus";

// ---------------------------------------------------------------------------
// DueDatePill — card preview chip in `.card-foot > .vote-row`
// ---------------------------------------------------------------------------

type DueDatePillProps = {
  card: Card;
};

export function DueDatePill({ card }: DueDatePillProps) {
  const status = dueDateStatus(card);
  if (!status) return null;
  if (!card.dueDate) return null;
  const label = formatDueDate(card.dueDate);
  // Tooltip exposes the absolute ISO date plus the resolved status, so power
  // users hovering can see e.g. "2026-05-05 — overdue" without opening the card.
  const title = `${card.dueDate} — ${status}`;
  return (
    <span
      className={"due-pill " + status}
      title={title}
      aria-label={`Due ${label}, ${status}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DueDateField — slotted into `.cd-side-due` in the card details modal
// ---------------------------------------------------------------------------

type DueDateFieldProps = {
  boardId: string;
  cardId: string;
  dueDate: string | undefined;
  dueComplete: boolean;
  readOnly: boolean;
};

export function DueDateField({
  boardId,
  cardId,
  dueDate,
  dueComplete,
  readOnly,
}: DueDateFieldProps) {
  const [editing, setEditing] = useState(false);
  // Local draft mirrors the stored value while the picker is open so Esc can
  // revert without committing. The native input fires onChange with empty
  // string when cleared, which we translate to `undefined` on save.
  const [draft, setDraft] = useState(dueDate ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(dueDate ?? "");
  }, [dueDate, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const startEdit = () => {
    if (readOnly) return;
    setDraft(dueDate ?? "");
    setEditing(true);
  };

  const commit = (value: string) => {
    storeActions.setCardDueDate(boardId, cardId, value || undefined);
    setEditing(false);
  };

  const onClear = () => {
    if (readOnly) return;
    storeActions.setCardDueDate(boardId, cardId, undefined);
    setEditing(false);
  };

  const onToggleComplete = () => {
    if (readOnly) return;
    storeActions.toggleCardDueComplete(boardId, cardId);
  };

  // ---- Read-only rendering ------------------------------------------------
  if (readOnly) {
    if (!dueDate) {
      return <p className="cd-placeholder">No due date.</p>;
    }
    return (
      <div className="due-field">
        <div className={"due-field-row" + (dueComplete ? " complete" : "")}>
          <span className="due-field-label">{formatDueDate(dueDate)}</span>
          {dueComplete && (
            <span className="due-field-complete-badge">Complete</span>
          )}
        </div>
      </div>
    );
  }

  // ---- Empty (editable) ---------------------------------------------------
  if (!dueDate && !editing) {
    return (
      <div className="due-field">
        <button
          type="button"
          className="btn btn-subtle due-add"
          onClick={startEdit}
        >
          Add due date
        </button>
      </div>
    );
  }

  // ---- Editing (picker open) ---------------------------------------------
  if (editing) {
    return (
      <div className="due-field">
        <input
          ref={inputRef}
          type="date"
          className="field-input due-field-input"
          value={draft}
          onChange={(e) => {
            // Native picker fires onChange when the user picks (or clears).
            // Persist immediately so a click anywhere outside doesn't lose
            // their selection.
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              // Revert and exit without committing. Stop propagation so the
              // modal-level Esc handler doesn't also fire and close the modal.
              e.stopPropagation();
              e.preventDefault();
              setDraft(dueDate ?? "");
              setEditing(false);
            }
          }}
          onBlur={() => {
            // Blur without a change keeps the saved value. The onChange path
            // above already committed any picked value.
            setEditing(false);
          }}
          aria-label="Due date"
        />
      </div>
    );
  }

  // ---- Set, not editing ---------------------------------------------------
  return (
    <div className="due-field">
      <div className={"due-field-row" + (dueComplete ? " complete" : "")}>
        <button
          type="button"
          className="due-field-label-btn"
          onClick={startEdit}
          title="Edit due date"
        >
          {formatDueDate(dueDate!)}
        </button>
      </div>
      <div className="due-field-actions">
        <label>
          <input
            type="checkbox"
            checked={dueComplete}
            onChange={onToggleComplete}
            aria-label={dueComplete ? "Mark incomplete" : "Mark complete"}
          />
          <span>{dueComplete ? "Mark incomplete" : "Mark complete"}</span>
        </label>
        <button
          type="button"
          className="btn btn-subtle"
          onClick={startEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-subtle"
          onClick={onClear}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
