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
import type { Card as CardType, Column as ColumnType, User } from "../_data/retro";
import { useAddCardRequest } from "../_hooks/useAddCardRequest";

const MAX_TITLE = 60;
const MAX_DESC = 200;

export type ColumnProps = {
  col: ColumnType;
  users: User[];
  /** Signed-in Entra user's id. Empty string before the session resolves;
   *  child components fall back to no "this is your" affordances when empty. */
  currentUserId: string;
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
  /** True when this column is the system-managed Action column (F-23). */
  isActionCol?: boolean;
  onVote: (cardId: string) => void;
  onAdd: (colId: string, body: string) => void;
  onSaveCard: (cardId: string, body: string) => void;
  onArchiveCard: (cardId: string) => void;
  onRenameColumn: (colId: string, title: string) => void;
  /** F-25: persist a column description edit. Empty string clears the desc. */
  onSaveColumnDesc: (colId: string, desc: string) => void;
  onRequestDeleteColumn: (colId: string) => void;
  onAutoEditConsumed?: () => void;
  onCardKeyboardMove?: (
    cardId: string,
    dir: "up" | "down" | "left" | "right",
  ) => void;
  onColumnKeyboardMove?: (colId: string, dir: "left" | "right") => void;
  onOpenCardDetails?: (cardId: string, originEl: HTMLElement | null) => void;
  /** Resolve a source card by id for Action card back-pointers (F-23). */
  findSourceCard?: (sourceCardId: string) => CardType | undefined;
};

export function Column(props: ColumnProps) {
  // Disable column drag while title is being renamed (handled via local state).
  // Also disable DnD reorder for the Action column — it always stays rightmost.
  const [editingTitle, setEditingTitle] = useState(false);
  const sortable = useSortable({
    id: props.col.id,
    data: { type: "column", columnId: props.col.id },
    disabled: !props.dndEnabled || editingTitle || !!props.isActionCol,
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
  // isActionCol and findSourceCard are already on ColumnProps; listed here
  // only as a reminder that they flow through to Card renders below.
};

export const ColumnView = forwardRef<HTMLDivElement, ColumnViewProps>(
  function ColumnView(
    {
      col,
      users,
      currentUserId,
      anonymous,
      focused,
      sortByVotes,
      readOnly,
      discussion,
      canEdit,
      autoEditTitle,
      newIds,
      dndEnabled,
      isActionCol,
      onVote,
      onAdd,
      onSaveCard,
      onArchiveCard,
      onRenameColumn,
      onSaveColumnDesc,
      onRequestDeleteColumn,
      onAutoEditConsumed,
      onCardKeyboardMove,
      onColumnKeyboardMove,
      onOpenCardDetails,
      findSourceCard,
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
    const [titleDraft, setTitleDraft] = useState(col.title);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editingDesc, setEditingDesc] = useState(false);
    const [descDraft, setDescDraft] = useState(col.desc);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const descInputRef = useRef<HTMLInputElement | null>(null);
    const headRef = useRef<HTMLDivElement | null>(null);
    // F-21: column add fade. Drop the class after the keyframe finishes so the
    // node returns to default styling — no lasting effect. Skipped for the
    // <DragOverlay> follower clone because its mount is not a "new column".
    const [isMounting, setIsMounting] = useState(!isFollower);
    useEffect(() => {
      if (!isMounting) return;
      const t = window.setTimeout(() => setIsMounting(false), 260);
      return () => window.clearTimeout(t);
    }, [isMounting]);

    const titleEditable = canEdit && !readOnly && !discussion && !isActionCol;
    const descEditable = titleEditable;

    useEffect(() => {
      if (adding && inputRef.current) inputRef.current.focus();
    }, [adding]);

    // F-19 `c` shortcut: open this column's add-card composer when the
    // global handler targets it. Read-only columns don't render the add
    // button at all so we guard here too — request becomes a no-op.
    useAddCardRequest(col.id, () => {
      if (readOnly) return;
      setAdding(true);
    });

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
      if (editingDesc && descInputRef.current) {
        descInputRef.current.focus();
        descInputRef.current.select();
      }
    }, [editingDesc]);

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

    const beginEditDesc = () => {
      if (!descEditable) return;
      setDescDraft(col.desc);
      setEditingDesc(true);
    };

    const commitEditDesc = () => {
      const trimmed = descDraft.replace(/\s+$/, "").slice(0, MAX_DESC);
      if (trimmed !== col.desc) onSaveColumnDesc(col.id, trimmed);
      setEditingDesc(false);
    };

    const cancelEditDesc = () => {
      setDescDraft(col.desc);
      setEditingDesc(false);
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
          (isFollower ? " drag-follower col" : "") +
          (isMounting ? " col-new" : "") +
          (isActionCol ? " action-col" : "")
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
              {isActionCol ? (
                // Action column: locked identity — only delete is available.
                <button
                  className="btn btn-subtle"
                  style={{ color: "var(--fg4)", fontSize: 11 }}
                  aria-label="Remove Action column"
                  onClick={() => onRequestDeleteColumn(col.id)}
                >
                  Remove column
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>

        {editingDesc ? (
          <input
            ref={descInputRef}
            className="col-desc-input"
            value={descDraft}
            maxLength={MAX_DESC}
            placeholder="Add description…"
            onChange={(e) => setDescDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commitEditDesc}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEditDesc();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEditDesc();
              }
            }}
          />
        ) : col.desc ? (
          <div
            className="col-desc"
            style={descEditable ? { cursor: "text" } : undefined}
            onClick={descEditable ? beginEditDesc : undefined}
          >
            {col.desc}
          </div>
        ) : descEditable ? (
          <div
            className="col-desc empty"
            role="button"
            tabIndex={0}
            onClick={beginEditDesc}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                beginEditDesc();
              }
            }}
          >
            Add description…
          </div>
        ) : null}

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
                  currentUserId={currentUserId}
                  anonymous={anonymous}
                  isTopVoted={focused && sortByVotes && c.id === topId}
                  isNew={newIds.has(c.id)}
                  readOnly={readOnly}
                  dndEnabled={dndEnabled}
                  isActionCol={isActionCol}
                  onVote={onVote}
                  onSave={onSaveCard}
                  onArchive={onArchiveCard}
                  onKeyboardMove={onCardKeyboardMove}
                  onOpenDetails={onOpenCardDetails}
                  findSourceCard={findSourceCard}
                />
              ))
            )}
          </SortableContext>
        </div>
      </div>
    );
  },
);
