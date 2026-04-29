"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import { Icon } from "./Primitives";
import type { Column as ColumnType, User } from "../_data/retro";

const MAX_TITLE = 60;

export type ColumnProps = {
  col: ColumnType;
  users: User[];
  anonymous: boolean;
  focused: boolean;
  sortByVotes: boolean;
  readOnly: boolean;
  /** Discussion mode is in progress — block structural mutations. */
  discussion: boolean;
  /** Owner gate — when false, hide kebab/edit affordances. */
  canEdit: boolean;
  /** Set to the column id when it should mount in rename mode. */
  autoEditTitle: boolean;
  newIds: Set<string>;
  onVote: (cardId: string) => void;
  onAdd: (colId: string, body: string) => void;
  onSaveCard: (cardId: string, body: string) => void;
  onDeleteCard: (cardId: string) => void;
  onRenameColumn: (colId: string, title: string) => void;
  onRequestDeleteColumn: (colId: string) => void;
  onAutoEditConsumed?: () => void;
};

export function Column({
  col,
  users,
  anonymous,
  focused,
  sortByVotes,
  readOnly,
  discussion,
  canEdit,
  autoEditTitle,
  newIds,
  onVote,
  onAdd,
  onSaveCard,
  onDeleteCard,
  onRenameColumn,
  onRequestDeleteColumn,
  onAutoEditConsumed,
}: ColumnProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [descOpen, setDescOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(col.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  const titleEditable = canEdit && !readOnly && !discussion;

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  // Auto-enter rename mode for a freshly-added column.
  useEffect(() => {
    if (autoEditTitle && titleEditable) {
      setTitleDraft(col.title);
      setEditingTitle(true);
      onAutoEditConsumed?.();
    }
    // We only react to autoEditTitle changing; col.title is read defensively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEditTitle, titleEditable]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  // Close kebab on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (headRef.current && !headRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const submit = () => {
    const v = text.trim();
    if (v) onAdd(col.id, v);
    setText("");
    setAdding(false);
  };

  const beginRename = () => {
    if (!titleEditable) return;
    setTitleDraft(col.title);
    setEditingTitle(true);
  };

  const commitRename = () => {
    const trimmed = titleDraft.trim().slice(0, MAX_TITLE);
    if (trimmed && trimmed !== col.title) {
      onRenameColumn(col.id, trimmed);
    }
    // Empty after trim → silent revert (no save).
    setEditingTitle(false);
  };

  const cancelRename = () => {
    setTitleDraft(col.title);
    setEditingTitle(false);
  };

  const cards = sortByVotes
    ? [...col.cards].sort((a, b) => b.voters.length - a.voters.length)
    : col.cards;
  const topId = cards.length && cards[0].voters.length > 0 ? cards[0].id : null;

  return (
    <div className={"col" + (focused ? " focused" : "")}>
      <div className="col-head" ref={headRef} style={{ position: "relative" }}>
        <div className="col-title-wrap">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="col-title-input"
              value={titleDraft}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
            />
          ) : (
            <span
              className="col-title"
              style={titleEditable ? { cursor: "text" } : undefined}
              onClick={titleEditable ? beginRename : undefined}
            >
              {col.title}
            </span>
          )}
          <span className="col-count">{col.cards.length}</span>
        </div>
        {canEdit && !readOnly && !discussion && (
          <div className="col-actions">
            <button
              className="col-icon-btn"
              title="Column settings"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="kebab-menu col-kebab-menu" role="menu">
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    beginRename();
                  }}
                >
                  <Icon name="settings" size={12} /> Rename
                </button>
                <button
                  className="menu-item danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestDeleteColumn(col.id);
                  }}
                >
                  <Icon name="close" size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {descOpen && col.desc && <div className="col-desc">{col.desc}</div>}
      {col.desc && (
        <button className="col-desc-toggle" onClick={() => setDescOpen((o) => !o)}>
          {descOpen ? "hide description" : "show description"}
        </button>
      )}

      {!readOnly &&
        (adding ? (
          <>
            <textarea
              ref={inputRef}
              className="add-card-input"
              placeholder="Type your card…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  setText("");
                  setAdding(false);
                }
              }}
            />
            <div className="add-card-actions">
              <button className="btn btn-primary" onClick={submit}>
                Add card
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setText("");
                  setAdding(false);
                }}
              >
                Cancel
              </button>
              <span className="hint">
                <span className="kbd">↵</span> save · <span className="kbd">esc</span> cancel
              </span>
            </div>
          </>
        ) : (
          <button className="add-card-btn" onClick={() => setAdding(true)}>
            <span className="plus">+</span> Add a card
          </button>
        ))}

      <div className="col-cards">
        {cards.length === 0 ? (
          <div className="empty-column-hint">Nothing here yet.</div>
        ) : (
          cards.map((c) => (
            <Card
              key={c.id}
              card={c}
              users={users}
              anonymous={anonymous}
              isTopVoted={focused && sortByVotes && c.id === topId}
              isNew={newIds.has(c.id)}
              readOnly={readOnly}
              onVote={onVote}
              onSave={onSaveCard}
              onDelete={onDeleteCard}
            />
          ))
        )}
      </div>
    </div>
  );
}
