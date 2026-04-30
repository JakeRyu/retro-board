"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "./Card";
import { Icon } from "./Primitives";
import type { Column as ColumnType, Label, User } from "../_data/retro";

const MAX_TITLE = 60;

export type ColumnProps = {
  col: ColumnType;
  users: User[];
  /** Board-level label set used to render label stripes on each card preview. */
  labels: Label[];
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
  /** Whether DnD is enabled for cards / column body. */
  dndEnabled: boolean;
  onVote: (cardId: string) => void;
  onAdd: (colId: string, body: string) => void;
  onSaveCard: (cardId: string, body: string) => void;
  onArchiveCard: (cardId: string) => void;
  onRenameColumn: (colId: string, title: string) => void;
  onRequestDeleteColumn: (colId: string) => void;
  onAutoEditConsumed?: () => void;
  onCardKeyboardMove?: (
    cardId: string,
    dir: "up" | "down" | "left" | "right",
  ) => void;
  onColumnKeyboardMove?: (colId: string, dir: "left" | "right") => void;
  onOpenCardDetails?: (cardId: string, originEl: HTMLElement | null) => void;
};

export function Column(props: ColumnProps) {
  // Disable column drag while title is being renamed (handled via local state).
  const [editingTitle, setEditingTitle] = useState(false);
  const sortable = useSortable({
    id: props.col.id,
    data: { type: "column", columnId: props.col.id },
    disabled: !props.dndEnabled || editingTitle,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ColumnView
      ref={setNodeRef}
      {...props}
      isDragging={isDragging}
      editingTitle={editingTitle}
      setEditingTitle={setEditingTitle}
      style={style}
      headAttributes={attributes as unknown as Record<string, unknown>}
      headListeners={listeners as unknown as Record<string, unknown>}
    />
  );
}

type ColumnViewProps = ColumnProps & {
  isDragging?: boolean;
  isFollower?: boolean;
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  style?: React.CSSProperties;
  headAttributes?: Record<string, unknown>;
  headListeners?: Record<string, unknown>;
};

export const ColumnView = forwardRef<HTMLDivElement, ColumnViewProps>(
  function ColumnView(
    {
      col,
      users,
      labels,
      anonymous,
      focused,
      sortByVotes,
      readOnly,
      discussion,
      canEdit,
      autoEditTitle,
      newIds,
      dndEnabled,
      onVote,
      onAdd,
      onSaveCard,
      onArchiveCard,
      onRenameColumn,
      onRequestDeleteColumn,
      onAutoEditConsumed,
      onCardKeyboardMove,
      onColumnKeyboardMove,
      onOpenCardDetails,
      isDragging,
      isFollower,
      editingTitle,
      setEditingTitle,
      style,
      headAttributes,
      headListeners,
    },
    ref,
  ) {
    const [adding, setAdding] = useState(false);
    const [text, setText] = useState("");
    const [descOpen, setDescOpen] = useState(true);
    const [titleDraft, setTitleDraft] = useState(col.title);
    const [menuOpen, setMenuOpen] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const headRef = useRef<HTMLDivElement | null>(null);

    const titleEditable = canEdit && !readOnly && !discussion;

    useEffect(() => {
      if (adding && inputRef.current) inputRef.current.focus();
    }, [adding]);

    useEffect(() => {
      if (autoEditTitle && titleEditable) {
        setTitleDraft(col.title);
        setEditingTitle(true);
        onAutoEditConsumed?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoEditTitle, titleEditable]);

    useEffect(() => {
      if (editingTitle && titleInputRef.current) {
        titleInputRef.current.focus();
        titleInputRef.current.select();
      }
    }, [editingTitle]);

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

    const headTabIndex =
      dndEnabled && !editingTitle && !isFollower ? 0 : -1;
    const onHeadKeyDown = (e: React.KeyboardEvent) => {
      if (editingTitle) return;
      if (!onColumnKeyboardMove) return;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      let dir: "left" | "right" | null = null;
      if (e.key === "ArrowLeft") dir = "left";
      else if (e.key === "ArrowRight") dir = "right";
      if (!dir) return;
      e.preventDefault();
      e.stopPropagation();
      onColumnKeyboardMove(col.id, dir);
    };

    return (
      <div
        ref={ref}
        style={style}
        className={
          "col" +
          (focused ? " focused" : "") +
          (isDragging ? " drag-ghost" : "") +
          (isFollower ? " drag-follower col" : "")
        }
      >
        <div
          className={"col-head" + (isDragging ? " dragging" : "")}
          ref={headRef}
          style={{ position: "relative" }}
          tabIndex={headTabIndex}
          onKeyDown={onHeadKeyDown}
          {...(headAttributes ?? {})}
          {...(headListeners ?? {})}
        >
          <div className="col-title-wrap">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                className="col-title-input"
                value={titleDraft}
                maxLength={MAX_TITLE}
                onChange={(e) => setTitleDraft(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
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
            <div
              className="col-actions"
              onPointerDown={(e) => e.stopPropagation()}
            >
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
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {cards.length === 0 ? (
              <div className="empty-column-hint">Nothing here yet.</div>
            ) : (
              cards.map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  users={users}
                  labels={labels}
                  anonymous={anonymous}
                  isTopVoted={focused && sortByVotes && c.id === topId}
                  isNew={newIds.has(c.id)}
                  readOnly={readOnly}
                  dndEnabled={dndEnabled}
                  onVote={onVote}
                  onSave={onSaveCard}
                  onArchive={onArchiveCard}
                  onKeyboardMove={onCardKeyboardMove}
                  onOpenDetails={onOpenCardDetails}
                />
              ))
            )}
          </SortableContext>
        </div>
      </div>
    );
  },
);
