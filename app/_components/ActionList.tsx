"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Primitives";
import type { ActionItem } from "../_data/retro";
import { storeActions } from "../_data/store";

type ActionListProps = {
  boardId: string;
  cardId: string;
  items: ActionItem[];
  readOnly: boolean;
};

export function ActionList({ boardId, cardId, items, readOnly }: ActionListProps) {
  const [draft, setDraft] = useState("");

  const onSubmitDraft = () => {
    const v = draft.trim();
    if (!v) return;
    storeActions.addActionItem(boardId, cardId, v);
    setDraft("");
  };

  return (
    <div className="action-list">
      {items.length > 0 && (
        <div className="action-list-items">
          {items.map((item) => (
            <ActionRow
              key={item.id}
              boardId={boardId}
              cardId={cardId}
              item={item}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="action-list-add">
          <input
            type="text"
            className="action-list-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmitDraft();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setDraft("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Add an action item…"
            aria-label="Add an action item"
          />
        </div>
      )}
    </div>
  );
}

// --- Row ---------------------------------------------------------------------

type ActionRowProps = {
  boardId: string;
  cardId: string;
  item: ActionItem;
  readOnly: boolean;
};

function ActionRow({ boardId, cardId, item, readOnly }: ActionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(item.text);
  }, [item.text, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const startEdit = () => {
    if (readOnly) return;
    setDraft(item.text);
    setEditing(true);
  };

  const commitEdit = () => {
    const v = draft.trim();
    if (!v) {
      setDraft(item.text);
      setEditing(false);
      return;
    }
    if (v !== item.text) {
      storeActions.editActionItem(boardId, cardId, item.id, v);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(item.text);
    setEditing(false);
  };

  const onToggle = () => storeActions.toggleActionItem(boardId, cardId, item.id);
  const onDelete = () => storeActions.deleteActionItem(boardId, cardId, item.id);

  const onRowKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if (readOnly) return;
    if (e.key === "Backspace" || e.key === "Delete") {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === "INPUT") return;
      e.preventDefault();
      onDelete();
    }
  };

  return (
    <div
      className={"action-item" + (item.done ? " done" : "")}
      onKeyDown={onRowKeyDown}
    >
      <input
        type="checkbox"
        className="action-item-checkbox"
        checked={item.done}
        onChange={onToggle}
        disabled={readOnly}
        aria-label={item.text}
      />

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          className="action-item-text-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              e.preventDefault();
              cancelEdit();
            }
          }}
        />
      ) : (
        <span
          className={"action-item-text" + (item.done ? " done" : "")}
          role={readOnly ? undefined : "button"}
          tabIndex={readOnly ? -1 : 0}
          onClick={readOnly ? undefined : startEdit}
          onKeyDown={(e) => {
            if (readOnly) return;
            if (e.key === "Enter") {
              e.preventDefault();
              startEdit();
            }
          }}
        >
          {item.text}
        </span>
      )}

      {!readOnly && !editing && (
        <button
          type="button"
          className="action-item-del"
          onClick={onDelete}
          aria-label="Delete item"
          title="Delete"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}
