"use client";

import { useEffect, useRef, useState } from "react";
import { BOARD_COLORS, BOARD_COLOR_NAMES } from "../_data/retro";
import type { Label } from "../_data/retro";
import { storeActions } from "../_data/store";

const MAX_VISIBLE_STRIPES = 5;
const NAME_MAX = 30;

// Tooltip text for an unnamed label — uses the swatch color name so it's still
// identifiable. Falls back to "Unnamed" if the color isn't in the palette
// (shouldn't happen, but render code stays safe).
function labelTooltip(label: Label): string {
  if (label.name && label.name.trim()) return label.name;
  const colorName = BOARD_COLOR_NAMES[label.color];
  return colorName ? `Unnamed (${colorName})` : "Unnamed";
}

// ---------------------------------------------------------------------------
// LabelStripes — card preview row above .card-body
// ---------------------------------------------------------------------------

type LabelStripesProps = {
  labels: Label[];
  cardLabelIds: string[] | undefined;
};

export function LabelStripes({ labels, cardLabelIds }: LabelStripesProps) {
  if (!cardLabelIds || cardLabelIds.length === 0) return null;
  // Resolve in card.labels order; silently drop any ids that no longer exist
  // on the board (e.g. label was deleted but card still references it).
  const resolved = cardLabelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));
  if (resolved.length === 0) return null;
  const visible = resolved.slice(0, MAX_VISIBLE_STRIPES);
  const overflow = resolved.length - visible.length;
  return (
    <div className="label-stripes" aria-label="Labels">
      {visible.map((label) => (
        <span
          key={label.id}
          className="label-stripe"
          style={{ background: label.color }}
          title={labelTooltip(label)}
        />
      ))}
      {overflow > 0 && (
        <span className="label-stripes-more">+{overflow}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LabelPicker — slotted into .cd-side-labels in CardDetailsModal
// ---------------------------------------------------------------------------

type LabelPickerProps = {
  boardId: string;
  /** Card id is unused in management-only mode; pass an empty string then. */
  cardId: string;
  labels: Label[];
  cardLabelIds: string[];
  readOnly: boolean;
  canEdit: boolean;
  /** F-17: hide the per-card checkbox column so the picker reads as a label
   *  management surface (board settings → Manage labels) rather than a
   *  card-level toggle. Rename / add / delete behavior is otherwise identical. */
  manageOnly?: boolean;
};

export function LabelPicker({
  boardId,
  cardId,
  labels,
  cardLabelIds,
  readOnly,
  canEdit,
  manageOnly = false,
}: LabelPickerProps) {
  const [creating, setCreating] = useState(false);

  const empty = labels.length === 0;

  return (
    <div className={"label-picker" + (manageOnly ? " manage-only" : "")}>
      {empty && (
        <p className="label-empty">No labels yet. Create one.</p>
      )}

      {labels.map((label) => (
        <LabelRow
          key={label.id}
          boardId={boardId}
          cardId={cardId}
          label={label}
          checked={cardLabelIds.includes(label.id)}
          readOnly={readOnly}
          canEdit={canEdit}
          manageOnly={manageOnly}
        />
      ))}

      {!readOnly && canEdit && !creating && (
        <button
          type="button"
          className="label-create"
          onClick={() => setCreating(true)}
        >
          + Create a new label
        </button>
      )}

      {!readOnly && canEdit && creating && (
        <LabelCreateForm
          boardId={boardId}
          onDone={() => setCreating(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LabelRow
// ---------------------------------------------------------------------------

type LabelRowProps = {
  boardId: string;
  cardId: string;
  label: Label;
  checked: boolean;
  readOnly: boolean;
  canEdit: boolean;
  manageOnly: boolean;
};

function LabelRow({
  boardId,
  cardId,
  label,
  checked,
  readOnly,
  canEdit,
  manageOnly,
}: LabelRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(label.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mirror external label.name updates while not actively editing.
  useEffect(() => {
    if (!editing) setDraft(label.name);
  }, [label.name, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const onToggle = () => {
    if (readOnly) return;
    // Management-only mode (F-17) hides the checkbox altogether, but defense
    // in depth: if there's no card, there's nothing to toggle.
    if (manageOnly || !cardId) return;
    storeActions.toggleCardLabel(boardId, cardId, label.id);
  };

  const startEdit = () => {
    if (readOnly || !canEdit) return;
    setDraft(label.name);
    setEditing(true);
  };

  const commitEdit = () => {
    const next = draft.trim();
    if (next !== label.name) {
      storeActions.updateLabel(boardId, label.id, { name: next });
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(label.name);
    setEditing(false);
  };

  const requestDelete = () => {
    if (readOnly || !canEdit) return;
    setConfirming(true);
  };

  const performDelete = () => {
    storeActions.deleteLabel(boardId, label.id);
    // Component will unmount with the row; no further cleanup needed.
  };

  const cancelDelete = () => setConfirming(false);

  if (confirming) {
    return (
      <div className="label-row confirming">
        <span
          className="label-swatch"
          style={{ background: label.color }}
          aria-hidden
        />
        <span className="label-confirm-text">Delete this label?</span>
        <div className="label-confirm-actions">
          <button
            type="button"
            className="btn btn-subtle label-confirm-yes"
            onClick={performDelete}
          >
            Yes
          </button>
          <button
            type="button"
            className="btn btn-subtle"
            onClick={cancelDelete}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const hasName = label.name && label.name.trim().length > 0;

  return (
    <label
      className={"label-row" + (editing ? " editing" : "")}
    >
      <input
        type="checkbox"
        className="label-checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={onToggle}
        aria-label={hasName ? `Toggle ${label.name}` : "Toggle unnamed label"}
      />
      <span
        className="label-swatch"
        style={{ background: label.color }}
        aria-hidden
      />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="label-name-input"
          value={draft}
          maxLength={NAME_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.preventDefault()}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelEdit();
            }
          }}
          placeholder="Add a name…"
        />
      ) : (
        <span
          className={"label-name" + (hasName ? "" : " empty")}
          onClick={(e) => {
            if (readOnly || !canEdit) return;
            // Don't toggle the checkbox when clicking the name to enter edit.
            e.preventDefault();
            startEdit();
          }}
        >
          {hasName ? label.name : "Untitled"}
        </span>
      )}
      {!readOnly && canEdit && !editing && (
        <span className="label-actions">
          <button
            type="button"
            className="label-delete-btn"
            onClick={(e) => {
              e.preventDefault();
              requestDelete();
            }}
            title="Delete label"
            aria-label="Delete label"
          >
            ×
          </button>
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// LabelCreateForm
// ---------------------------------------------------------------------------

type LabelCreateFormProps = {
  boardId: string;
  onDone: () => void;
};

function LabelCreateForm({ boardId, onDone }: LabelCreateFormProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    storeActions.addLabel(boardId, name, color);
    onDone();
  };

  return (
    <div className="label-create-form">
      <input
        ref={inputRef}
        type="text"
        className="label-name-input"
        value={name}
        maxLength={NAME_MAX}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
        placeholder="Add a name…"
      />
      <div className="label-create-swatches" role="radiogroup" aria-label="Label color">
        {BOARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="label-create-swatch"
            data-selected={color === c}
            style={{ background: c }}
            onClick={() => setColor(c)}
            aria-label={BOARD_COLOR_NAMES[c] ?? c}
            aria-checked={color === c}
            role="radio"
          />
        ))}
      </div>
      <div className="label-create-actions">
        <button type="button" className="btn btn-primary" onClick={submit}>
          Create
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}
