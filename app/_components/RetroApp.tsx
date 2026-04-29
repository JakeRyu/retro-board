"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { Column, ColumnView } from "./Column";
import { CardView } from "./Card";
import { Sidebar } from "./Sidebar";
import { Avatar, Icon } from "./Primitives";
import type { Board, Card as CardType, Column as ColumnT } from "../_data/retro";
import { USERS } from "../_data/retro";
import { storeActions, useBoard } from "../_data/store";
import { useIsOwner } from "../_hooks/useIsOwner";

export function RetroApp({ boardId }: { boardId: string }) {
  const board = useBoard(boardId);

  useEffect(() => {
    if (board) storeActions.setActiveBoardId(board.id);
  }, [board]);

  if (!board) {
    return <BoardNotFound />;
  }

  return <RetroAppLoaded board={board} />;
}

function BoardNotFound() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="crumbs">
            <Link href="/" className="crumb-link">Boards</Link>
            <span className="crumb-sep">/</span>
            <span style={{ color: "var(--fg4)", fontStyle: "italic" }}>not found</span>
          </div>
        </div>
        <div className="board-empty">
          <div className="modal">
            <h2>Board not found.</h2>
            <p>This board may have been deleted, or the link is out of date.</p>
            <div className="modal-actions">
              <Link href="/" className="btn btn-primary">Back to boards</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type DragKind =
  | { kind: "card"; cardId: string; fromColumnId: string }
  | { kind: "column"; columnId: string };

function findColumnByCardId(columns: ColumnT[], cardId: string): ColumnT | undefined {
  return columns.find((c) => c.cards.some((card) => card.id === cardId));
}

function findCard(columns: ColumnT[], cardId: string): CardType | undefined {
  for (const c of columns) {
    const card = c.cards.find((x) => x.id === cardId);
    if (card) return card;
  }
  return undefined;
}

function RetroAppLoaded({ board }: { board: Board }) {
  const columns = board.columns;
  const closed = board.state === "closed";
  const crumbPrefix = board.type === "retro" ? "Retros" : "Boards";
  const isOwner = useIsOwner(board);

  const [anonymous, setAnonymous] = useState(false);
  const [themeOpen, setThemeOpen] = useState(true);
  const [discussion, setDiscussion] = useState(false);
  const [focusColId, setFocusColId] = useState<string>(columns[0]?.id ?? "");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDeleteColId, setConfirmDeleteColId] = useState<string | null>(null);
  const [autoEditColId, setAutoEditColId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<DragKind | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anonInitialized = useRef(false);
  const boardAreaRef = useRef<HTMLDivElement | null>(null);

  // DnD is gated on board state; closed/discussion fully disable it.
  const dndEnabled = isOwner && !closed && !discussion;

  useEffect(() => {
    if (!columns.length) return;
    if (!columns.some((c) => c.id === focusColId)) {
      setFocusColId(columns[0].id);
    }
  }, [columns, focusColId]);

  const fireToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const onVote = (cardId: string) => {
    storeActions.toggleVote(cardId);
  };

  const onAdd = (colId: string, body: string) => {
    const id = storeActions.addCard(colId, body);
    setNewIds((s) => new Set([...s, id]));
    setTimeout(() => {
      setNewIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 600);
  };

  const onSaveCard = (cardId: string, body: string) => {
    storeActions.saveCard(cardId, body);
    fireToast("Card updated.");
  };

  const onDeleteCard = (cardId: string) => {
    if (!confirm("Delete this card? Everyone in the room will see it disappear.")) return;
    storeActions.deleteCard(cardId);
    fireToast("Card deleted.");
  };

  const onAddColumn = () => {
    const id = storeActions.addColumn(board.id);
    setAutoEditColId(id);
    setTimeout(() => {
      const area = boardAreaRef.current;
      if (!area) return;
      area.scrollTo({ left: area.scrollWidth, behavior: "smooth" });
    }, 0);
  };

  const onRenameColumn = (colId: string, title: string) => {
    storeActions.renameColumn(board.id, colId, title);
  };

  const onRequestDeleteColumn = (colId: string) => {
    const target = columns.find((c) => c.id === colId);
    if (!target) return;
    if (target.cards.length === 0) {
      performDeleteColumn(colId);
      return;
    }
    setConfirmDeleteColId(colId);
  };

  const performDeleteColumn = (colId: string) => {
    if (focusColId === colId) {
      const idx = columns.findIndex((c) => c.id === colId);
      const next = columns[idx + 1] ?? columns[idx - 1];
      setFocusColId(next?.id ?? "");
    }
    storeActions.deleteColumn(board.id, colId);
    setConfirmDeleteColId(null);
  };

  const confirmDeleteTarget = confirmDeleteColId
    ? columns.find((c) => c.id === confirmDeleteColId) ?? null
    : null;

  const colIdx = columns.findIndex((c) => c.id === focusColId);
  const focusedCol = columns[colIdx];
  const isFirst = colIdx === 0;
  const isLast = colIdx === columns.length - 1;

  const enterDiscussion = () => {
    setDiscussion(true);
    if (columns[0]) setFocusColId(columns[0].id);
    setThemeOpen(false);
  };
  const exitDiscussion = useCallback(() => setDiscussion(false), []);
  const next = useCallback(() => {
    if (!isLast) setFocusColId(columns[colIdx + 1].id);
  }, [isLast, columns, colIdx]);
  const prev = useCallback(() => {
    if (!isFirst) setFocusColId(columns[colIdx - 1].id);
  }, [isFirst, columns, colIdx]);

  const closeBoard = () => {
    storeActions.setBoardState("closed");
    setConfirmClose(false);
    setDiscussion(false);
    fireToast("Board closed. Cards stay readable.");
  };

  useEffect(() => {
    if (!anonInitialized.current) {
      anonInitialized.current = true;
      return;
    }
    fireToast(
      anonymous
        ? "Anonymous mode is on — authors are hidden for everyone."
        : "Anonymous mode is off — authors are visible again."
    );
  }, [anonymous, fireToast]);

  useEffect(() => {
    if (!discussion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") exitDiscussion();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discussion, next, prev, exitDiscussion]);

  // ---- DnD wiring ----------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const announce = useCallback((msg: string) => {
    setLiveMessage(msg);
  }, []);

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as { type?: string } | undefined;
    if (data?.type === "column") {
      setDragging({ kind: "column", columnId: String(e.active.id) });
      return;
    }
    // Default: treat as card.
    const cardId = String(e.active.id);
    const fromCol = findColumnByCardId(columns, cardId);
    if (!fromCol) return;
    setDragging({ kind: "card", cardId, fromColumnId: fromCol.id });
  };

  // Live cross-column move during drag so the dropped slot reflects the cursor.
  const onDragOver = (e: DragOverEvent) => {
    if (!dragging || dragging.kind !== "card") return;
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const overData = e.over?.data.current as { type?: string } | undefined;
    const activeCardId = dragging.cardId;
    const fromCol = findColumnByCardId(columns, activeCardId);
    if (!fromCol) return;

    let targetColId: string | null = null;
    let targetIndex = 0;

    if (overData?.type === "column") {
      targetColId = overId;
      const targetCol = columns.find((c) => c.id === targetColId);
      targetIndex = targetCol ? targetCol.cards.length : 0;
    } else {
      // Hovering another card → place into that card's column at its index.
      const overCol = findColumnByCardId(columns, overId);
      if (!overCol) return;
      targetColId = overCol.id;
      targetIndex = overCol.cards.findIndex((c) => c.id === overId);
      if (targetIndex < 0) targetIndex = overCol.cards.length;
    }

    if (!targetColId) return;
    if (targetColId === fromCol.id) return; // same-column reorder happens on drop
    storeActions.moveCard(
      board.id,
      activeCardId,
      fromCol.id,
      targetColId,
      targetIndex,
    );
  };

  const onDragEnd = (e: DragEndEvent) => {
    const drag = dragging;
    setDragging(null);
    if (!drag) return;

    if (drag.kind === "column") {
      const overId = e.over?.id ? String(e.over.id) : null;
      if (!overId || overId === drag.columnId) return;
      const toIdx = columns.findIndex((c) => c.id === overId);
      if (toIdx < 0) return;
      storeActions.reorderColumn(board.id, drag.columnId, toIdx);
      announce(`Moved column to position ${toIdx + 1} of ${columns.length}.`);
      return;
    }

    // Card drop. After onDragOver, the card already lives in the target column.
    const cardId = drag.cardId;
    const currentCol = findColumnByCardId(columns, cardId);
    if (!currentCol) return;

    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const overData = e.over?.data.current as { type?: string } | undefined;

    let targetColId = currentCol.id;
    let targetIndex = currentCol.cards.findIndex((c) => c.id === cardId);

    if (overData?.type === "column") {
      targetColId = overId;
      const targetCol = columns.find((c) => c.id === targetColId);
      targetIndex = targetCol ? targetCol.cards.length : 0;
    } else if (overId !== cardId) {
      const overCol = findColumnByCardId(columns, overId);
      if (overCol) {
        targetColId = overCol.id;
        targetIndex = overCol.cards.findIndex((c) => c.id === overId);
        if (targetIndex < 0) targetIndex = overCol.cards.length;
      }
    }

    storeActions.moveCard(
      board.id,
      cardId,
      currentCol.id,
      targetColId,
      targetIndex,
    );
    const targetCol = columns.find((c) => c.id === targetColId);
    if (targetCol) {
      announce(
        `Dropped in ${targetCol.title}, position ${targetIndex + 1} of ${
          targetCol.cards.length
        }.`,
      );
    }
  };

  const onDragCancel = () => {
    setDragging(null);
    announce("Move cancelled.");
  };

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  // ---- Keyboard reorder ---------------------------------------------------
  const handleCardKeyboardMove = (
    cardId: string,
    dir: "up" | "down" | "left" | "right",
  ) => {
    if (!dndEnabled) return;
    const fromCol = findColumnByCardId(columns, cardId);
    if (!fromCol) return;
    const fromIdx = fromCol.cards.findIndex((c) => c.id === cardId);
    if (fromIdx < 0) return;

    if (dir === "up" || dir === "down") {
      const target = dir === "up" ? fromIdx - 1 : fromIdx + 1;
      if (target < 0) {
        announce("Already at top.");
        return;
      }
      if (target >= fromCol.cards.length) {
        announce("Already at bottom.");
        return;
      }
      storeActions.moveCard(board.id, cardId, fromCol.id, fromCol.id, target);
      announce(dir === "up" ? "Moved up." : "Moved down.");
      return;
    }

    // Cross-column.
    const colIndex = columns.findIndex((c) => c.id === fromCol.id);
    const targetColIndex = dir === "left" ? colIndex - 1 : colIndex + 1;
    if (targetColIndex < 0 || targetColIndex >= columns.length) {
      announce(`No column to the ${dir}.`);
      return;
    }
    const targetCol = columns[targetColIndex];
    const newIndex = Math.min(fromIdx, targetCol.cards.length);
    storeActions.moveCard(board.id, cardId, fromCol.id, targetCol.id, newIndex);
    announce(
      `Moved to ${targetCol.title}, position ${newIndex + 1} of ${
        targetCol.cards.length + 1
      }.`,
    );
  };

  const handleColumnKeyboardMove = (colId: string, dir: "left" | "right") => {
    if (!dndEnabled) return;
    const fromIdx = columns.findIndex((c) => c.id === colId);
    if (fromIdx < 0) return;
    const targetIdx = dir === "left" ? fromIdx - 1 : fromIdx + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) {
      announce(`No column to the ${dir}.`);
      return;
    }
    storeActions.reorderColumn(board.id, colId, targetIdx);
    announce(`Moved column to position ${targetIdx + 1} of ${columns.length}.`);
  };

  // Render the drag-overlay clone for the active drag.
  const renderOverlay = () => {
    if (!dragging) return null;
    if (dragging.kind === "card") {
      const card = findCard(columns, dragging.cardId);
      if (!card) return null;
      return (
        <CardView
          card={card}
          users={USERS}
          anonymous={anonymous}
          isTopVoted={false}
          isNew={false}
          readOnly={closed}
          dndEnabled={false}
          isFollower
          onVote={() => {}}
          onSave={() => {}}
          onDelete={() => {}}
        />
      );
    }
    const col = columns.find((c) => c.id === dragging.columnId);
    if (!col) return null;
    return (
      <ColumnView
        col={col}
        users={USERS}
        anonymous={anonymous}
        focused={false}
        sortByVotes={false}
        readOnly={closed}
        discussion={discussion}
        canEdit={false}
        autoEditTitle={false}
        newIds={newIds}
        dndEnabled={false}
        editingTitle={false}
        setEditingTitle={() => {}}
        isFollower
        onVote={() => {}}
        onAdd={() => {}}
        onSaveCard={() => {}}
        onDeleteCard={() => {}}
        onRenameColumn={() => {}}
        onRequestDeleteColumn={() => {}}
      />
    );
  };

  return (
    <div
      className="app"
      data-discussion={discussion}
      data-readonly={closed}
    >
      <Sidebar />

      <div className="main">
        {/* ---- top bar ---- */}
        <div className="topbar">
          <div className="crumbs">
            <Link href="/" className="crumb-link">{crumbPrefix}</Link>
            <span className="crumb-sep">/</span>
            <input
              className="board-title-input"
              value={board.title}
              onChange={(e) => storeActions.setBoardTitle(e.target.value)}
              disabled={closed}
            />
            <span className={"state-pill " + (closed ? "closed" : "open")}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: closed ? "var(--fg4)" : "var(--status-emerald)",
                }}
              />
              {closed ? "closed · read-only" : "open"}
            </span>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div className="presence">
              {USERS.slice(0, 5).map((u) => (
                <Avatar key={u.id} user={u} size={22} />
              ))}
              <span className="more">+2</span>
            </div>

            {!closed && (
              <button
                className="anon-toggle"
                data-on={anonymous}
                onClick={() => setAnonymous((a) => !a)}
                title="Hide author names across the board"
              >
                <span className="switch"></span>
                <span>Anonymous</span>
              </button>
            )}

            {!closed && !discussion && (
              <button className="btn btn-primary" onClick={enterDiscussion}>
                <Icon name="arrow" size={13} /> Start discussion
              </button>
            )}

            {!closed && (
              <button className="btn btn-ghost" onClick={() => setConfirmClose(true)}>
                Close board
              </button>
            )}
          </div>
        </div>

        {/* ---- discussion bar ---- */}
        {discussion && focusedCol && (
          <div className="discussion-bar">
            <div className="now">
              <span className="label">Now discussing</span>
              <span className="col-name">{focusedCol.title}</span>
              <span className="progress">
                {columns.map((c, i) => (
                  <span
                    key={c.id}
                    className={
                      "pip " +
                      (i === colIdx ? "active" : i < colIdx ? "done" : "")
                    }
                  />
                ))}
              </span>
            </div>
            <div className="nav">
              <span className="meta">
                {focusedCol.cards.length}{" "}
                {focusedCol.cards.length === 1 ? "card" : "cards"} · sorted by votes
              </span>
              <button
                className="btn btn-ghost"
                onClick={prev}
                disabled={isFirst}
                style={isFirst ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                ← previous
              </button>
              {isLast ? (
                <button className="btn btn-primary" onClick={exitDiscussion}>
                  Finish discussion
                </button>
              ) : (
                <button className="btn btn-primary" onClick={next}>
                  Next column →
                </button>
              )}
              <button
                className="btn btn-subtle"
                onClick={exitDiscussion}
                title="Exit discussion (Esc)"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        {/* ---- anonymous banner ---- */}
        {anonymous && !closed && (
          <div className="anon-banner">
            <Icon name="user" size={13} />
            Anonymous mode — authors are hidden for everyone in this board.
          </div>
        )}

        {/* ---- theme bar ---- */}
        {!discussion && (
          <div className={"theme-bar" + (themeOpen ? "" : " collapsed")}>
            <span className="label">Theme</span>
            <div className="body">{board.theme}</div>
            <button className="collapse" onClick={() => setThemeOpen((o) => !o)}>
              {themeOpen ? "collapse" : "expand"}
            </button>
          </div>
        )}

        {/* ---- empty-board hint (≥1 col, all cols empty) ---- */}
        {columns.length > 0 &&
          columns.every((c) => c.cards.length === 0) &&
          !discussion && (
            <div className="empty-board-hint">
              No cards yet. Be the first — what&apos;s on your mind?
            </div>
          )}

        {/* ---- board area ---- */}
        {columns.length === 0 ? (
          <div className="empty-zero-cols">
            <p>This board has no columns yet. Add one to get started.</p>
            {!closed && !discussion && isOwner && (
              <button className="btn btn-primary" onClick={onAddColumn}>
                <Icon name="plus" size={12} /> Add column
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            modifiers={
              dragging?.kind === "column" ? [restrictToHorizontalAxis] : undefined
            }
          >
            <div className="board-area" ref={boardAreaRef}>
              <SortableContext
                items={columnIds}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((col) => (
                  <Column
                    key={col.id}
                    col={col}
                    users={USERS}
                    anonymous={anonymous}
                    focused={discussion && col.id === focusColId}
                    sortByVotes={discussion && col.id === focusColId}
                    readOnly={closed}
                    discussion={discussion}
                    canEdit={isOwner}
                    autoEditTitle={autoEditColId === col.id}
                    newIds={newIds}
                    dndEnabled={dndEnabled}
                    onVote={onVote}
                    onAdd={onAdd}
                    onSaveCard={onSaveCard}
                    onDeleteCard={onDeleteCard}
                    onRenameColumn={onRenameColumn}
                    onRequestDeleteColumn={onRequestDeleteColumn}
                    onAutoEditConsumed={() => setAutoEditColId(null)}
                    onCardKeyboardMove={handleCardKeyboardMove}
                    onColumnKeyboardMove={handleColumnKeyboardMove}
                  />
                ))}
              </SortableContext>
              {!closed && !discussion && isOwner && (
                <button className="add-col" onClick={onAddColumn}>
                  <Icon name="plus" size={12} /> Add column
                </button>
              )}
            </div>
            <DragOverlay>{renderOverlay()}</DragOverlay>
          </DndContext>
        )}
      </div>

      {/* close-board confirm */}
      <div
        className={"modal-overlay" + (confirmClose ? " open" : "")}
        onClick={() => setConfirmClose(false)}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Close this retro?</h2>
          <p>
            Cards stay readable. Voting and editing will be turned off. You can reopen the board
            later from the boards list.
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmClose(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={closeBoard}>
              Close board
            </button>
          </div>
        </div>
      </div>

      {/* delete-column confirm (non-empty only) */}
      <div
        className={"modal-overlay" + (confirmDeleteTarget ? " open" : "")}
        onClick={() => setConfirmDeleteColId(null)}
      >
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Delete this column?</h2>
          <p>
            {confirmDeleteTarget
              ? `This column has ${confirmDeleteTarget.cards.length} ${
                  confirmDeleteTarget.cards.length === 1 ? "card" : "cards"
                }. Delete the column and all its cards?`
              : ""}
          </p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmDeleteColId(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => confirmDeleteTarget && performDeleteColumn(confirmDeleteTarget.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* aria-live announcer for keyboard / drag movement */}
      <div className="dnd-live" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* toast */}
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
