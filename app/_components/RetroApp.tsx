"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  type DropAnimation,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { Column, ColumnView } from "./Column";
import { CardView } from "./Card";
import { CardDetailsModal } from "./CardDetailsModal";
import { ArchivedItemsPanel } from "./ArchivedItemsPanel";
import {
  BoardSettingsMenu,
  EditThemeModal,
} from "./BoardSettingsMenu";
import { Sidebar } from "./Sidebar";
import { Avatar, Icon } from "./Primitives";
import { useSession } from "next-auth/react";
import type { Board, Card as CardType, Column as ColumnT, Voter } from "../_data/retro";
import { USERS } from "../_data/retro";
import { storeActions, useBoard, useBoardPolling } from "../_data/store";
import { useIsOwner } from "../_hooks/useIsOwner";
import { fireToast } from "../_hooks/useToast";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";
import { requestAddCard } from "../_hooks/useAddCardRequest";
import { isShortcutsCheatSheetOpen } from "./ShortcutsCheatSheet";
import { exportActionItems, exportRetroSummary } from "../_lib/exportRetro";

export function RetroApp({ boardId }: { boardId: string }) {
  const board = useBoard(boardId);
  // F-26-E: distinguish "still fetching for the first time" from "fetched and
  // no such board exists" so we don't flash <BoardNotFound /> while Cosmos
  // is still answering the initial GET.
  const [fetchedOnce, setFetchedOnce] = useState(false);

  useEffect(() => {
    if (board) storeActions.setActiveBoardId(board.id);
  }, [board]);

  useEffect(() => {
    setFetchedOnce(false);
    storeActions
      .fetchBoardById(boardId)
      .catch(() => {})
      .finally(() => setFetchedOnce(true));
  }, [boardId]);

  // Poll every 1.5s while the tab is visible. Polling skips itself whenever
  // a local PUT is pending for this board to avoid clobbering the user's
  // in-flight edits.
  useBoardPolling(boardId);

  if (!board) {
    return fetchedOnce ? <BoardNotFound /> : <BoardLoading />;
  }

  return <RetroAppLoaded board={board} />;
}

function BoardLoading() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="crumbs">
            <Link href="/" className="crumb-link">Retros</Link>
            <span className="crumb-sep">/</span>
            <span style={{ color: "var(--fg4)", fontStyle: "italic" }}>loading…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardNotFound() {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="crumbs">
            <Link href="/" className="crumb-link">Retros</Link>
            <span className="crumb-sep">/</span>
            <span style={{ color: "var(--fg4)", fontStyle: "italic" }}>not found</span>
          </div>
        </div>
        <div className="board-empty">
          <div className="modal">
            <h2>Retro not found.</h2>
            <p>This retro may have been deleted, or the link is out of date.</p>
            <div className="modal-actions">
              <Link href="/" className="btn btn-primary">Back to retros</Link>
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

// F-21: 140ms ease-out drop animation, matching F-06 §8 ("slides into final
// position over 140ms ease-out"). The default dnd-kit drop animation is
// 250ms `ease`, which feels heavy on top of our other 140ms transitions.
const DROP_ANIM: DropAnimation = {
  duration: 140,
  easing: "cubic-bezier(0.18, 0.67, 0.6, 1)",
};

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

// F-14: find an open card across both live columns and the board-level
// archive bucket so the modal can stay open across an archive action and so
// `#card=<id>` deep links to archived cards resolve into the modal in its
// archived-state branch.
function findCardOnBoard(board: Board, cardId: string): CardType | undefined {
  const live = findCard(board.columns, cardId);
  if (live) return live;
  return board.archivedCards.find((c) => c.id === cardId);
}

function RetroAppLoaded({ board }: { board: Board }) {
  const columns = board.columns;
  const closed = board.state === "closed";
  const crumbPrefix = "Retros";
  const isOwner = useIsOwner(board);

  // Signed-in Entra user as a Voter — embedded on every new vote / new card
  // so downstream renderers don't need an out-of-band directory. Initials +
  // color the Sidebar uses are derived inline at render time from `.name`.
  const { data: session } = useSession();
  const currentUser: Voter | null = useMemo(() => {
    const id = session?.user?.id;
    const name = session?.user?.name;
    if (!id || !name) return null;
    return { id, name };
  }, [session?.user?.id, session?.user?.name]);
  const currentUserId = currentUser?.id ?? "";

  const [anonymous, setAnonymous] = useState(false);
  const [themeOpen, setThemeOpen] = useState(true);
  const [discussion, setDiscussion] = useState(false);
  const [focusColId, setFocusColId] = useState<string>(columns[0]?.id ?? "");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmRebuildAction, setConfirmRebuildAction] = useState(false);
  const [confirmDeleteColId, setConfirmDeleteColId] = useState<string | null>(null);
  const [autoEditColId, setAutoEditColId] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<DragKind | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [archivePanelOpen, setArchivePanelOpen] = useState(false);
  // F-14 permanent-delete confirm modal. Holds the id of the card slated for
  // delete-forever; null when the modal is closed. The confirm modal itself
  // only ever fires on cards that already live in board.archivedCards.
  const [confirmDeleteForeverCardId, setConfirmDeleteForeverCardId] = useState<
    string | null
  >(null);
  // F-17: board settings sub-surfaces.
  const [editThemeOpen, setEditThemeOpen] = useState(false);
  const [confirmArchiveBoard, setConfirmArchiveBoard] = useState(false);
  const router = useRouter();
  const anonInitialized = useRef(false);
  const boardAreaRef = useRef<HTMLDivElement | null>(null);
  // Element that originated the modal-open click — used to restore focus on
  // close (F-07 PO #2). Cleared once consumed.
  const openOriginRef = useRef<HTMLElement | null>(null);

  // F-21: pointerdown-vs-click guards on every confirm overlay so a text-
  // selection drag that releases over the overlay doesn't dismiss the modal.
  const closeBoardOverlay = useOverlayDismiss(() => setConfirmClose(false));
  const rebuildActionOverlay = useOverlayDismiss(() => {
    setConfirmRebuildAction(false);
    setDiscussion(false);
  });
  const deleteColumnOverlay = useOverlayDismiss(() =>
    setConfirmDeleteColId(null),
  );
  const deleteForeverOverlay = useOverlayDismiss(() =>
    setConfirmDeleteForeverCardId(null),
  );
  const archiveBoardOverlay = useOverlayDismiss(() =>
    setConfirmArchiveBoard(false),
  );

  // DnD is gated on board state; closed/discussion fully disable it.
  const dndEnabled = isOwner && !closed && !discussion;

  useEffect(() => {
    if (!columns.length) return;
    if (!columns.some((c) => c.id === focusColId)) {
      setFocusColId(columns[0].id);
    }
  }, [columns, focusColId]);

  const onVote = (cardId: string) => {
    if (!currentUser) return;
    storeActions.toggleVote(cardId, currentUser);
  };

  const onAdd = (colId: string, body: string) => {
    if (!currentUser) return;
    const id = storeActions.addCard(colId, body, currentUser);
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

  // F-14: live-card kebab and modal-sidebar "Archive card" both call this.
  // No confirm — archive is reversible. Hard delete moved to deleteCardForever
  // (only reachable from the archive panel and the modal sidebar's archived
  // state). F-22 attaches Undo to the toast — `unarchiveCard` already restores
  // every card field via the existing archive bucket, so no extra snapshot.
  const onArchiveCard = (cardId: string) => {
    storeActions.archiveCard(board.id, cardId);
    fireToast("Card archived.", () => {
      storeActions.unarchiveCard(board.id, cardId);
    });
  };

  const onUnarchiveCard = (cardId: string) => {
    storeActions.unarchiveCard(board.id, cardId);
    fireToast("Card unarchived.");
  };

  const onDeleteCardForever = (cardId: string) => {
    storeActions.deleteCardForever(board.id, cardId);
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

  const onSaveColumnDesc = (colId: string, desc: string) => {
    storeActions.setColumnDesc(board.id, colId, desc);
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
    // F-22: snapshot the column object + its index BEFORE deleting so Undo can
    // splice the exact same column (with all its cards) back into place. The
    // store doesn't keep a tombstone — without this snapshot the column object
    // would be gone by the time the user clicks Undo.
    const idx = columns.findIndex((c) => c.id === colId);
    const snapshot = idx >= 0 ? columns[idx] : null;
    if (focusColId === colId) {
      const next = columns[idx + 1] ?? columns[idx - 1];
      setFocusColId(next?.id ?? "");
    }
    storeActions.deleteColumn(board.id, colId);
    setConfirmDeleteColId(null);
    if (snapshot) {
      fireToast("Column deleted.", () => {
        storeActions.insertColumn(board.id, snapshot, idx);
      });
    }
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

  // F-23: gather action items from all live non-Action columns, sorted by
  // column position → vote count desc → item order, and build Action cards.
  const gatherActionCards = useCallback((): import("../_data/retro").Card[] => {
    const liveColumns = columns.filter((c) => c.kind !== "action");
    const result: import("../_data/retro").Card[] = [];
    for (const col of liveColumns) {
      const sorted = [...col.cards].sort(
        (a, b) => b.voters.length - a.voters.length,
      );
      for (const card of sorted) {
        for (const item of card.actionItems ?? []) {
          result.push({
            id: crypto.randomUUID(),
            body: item.text,
            author: currentUser ?? { id: "", name: "" },
            voters: [],
            sourceCardId: card.id,
          });
        }
      }
    }
    return result;
    // currentUser is included so the action items get tagged to whoever
    // hit Finish Discussion.
  }, [columns, currentUser]);

  const performBuildActionColumn = useCallback(() => {
    const actionCards = gatherActionCards();
    storeActions.buildActionColumn(board.id, actionCards);
    setDiscussion(false);
    setConfirmRebuildAction(false);
    // Scroll board area rightward so the Action column is immediately visible.
    setTimeout(() => {
      const area = boardAreaRef.current;
      if (!area) return;
      area.scrollTo({ left: area.scrollWidth, behavior: "smooth" });
    }, 0);
    if (actionCards.length === 0) {
      fireToast("No action items were captured.");
    } else {
      fireToast(`Action column rebuilt — ${actionCards.length} items.`);
    }
  }, [gatherActionCards, board.id]);

  // F-23: called when the facilitator clicks "Finish discussion". If the
  // Action column already has cards a confirm modal is shown first; otherwise
  // the rebuild proceeds immediately.
  const onFinishDiscussion = useCallback(() => {
    const actionCol = columns.find((c) => c.kind === "action");
    const hasExistingCards = (actionCol?.cards.length ?? 0) > 0;
    // When there are no existing Action column cards, also skip the confirm
    // when the new action items list is empty (empty → empty is harmless).
    if (hasExistingCards) {
      setConfirmRebuildAction(true);
    } else {
      performBuildActionColumn();
    }
  }, [columns, performBuildActionColumn]);

  const closeBoard = () => {
    storeActions.setBoardState("closed");
    setConfirmClose(false);
    setDiscussion(false);
    fireToast("Board closed. Cards stay readable.");
  };

  // F-17: archive the board (soft delete) then return to the boards list,
  // where the board now appears in the Archived group from F-02. F-22 adds a
  // toast with Undo — fired before navigation so the global toast host (in the
  // Sidebar, mounted on both pages) renders it on the boards list. Undo clears
  // archivedAt and routes back to this board.
  const archiveBoard = () => {
    const boardId = board.id;
    storeActions.archiveBoard(boardId);
    setConfirmArchiveBoard(false);
    fireToast("Board archived.", () => {
      storeActions.unarchiveBoard(boardId);
      router.push(`/boards/${boardId}`);
    });
    router.push("/");
  };

  const reopenBoard = () => {
    storeActions.reopenBoard(board.id);
    fireToast("Board reopened.");
  };

  const unarchiveBoard = () => {
    storeActions.unarchiveBoard(board.id);
    fireToast("Board unarchived.");
  };

  // F-20: clipboard exports for retro boards. Pure formatters live in
  // _lib/exportRetro; this layer just owns clipboard + toast. Async-clipboard
  // can reject (insecure context, permission, browser refusal); on failure we
  // surface a single conversational toast rather than retrying with legacy
  // execCommand fallbacks.
  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      fireToast(successMsg);
    } catch {
      fireToast("Couldn't copy. Try again?");
    }
  };

  const onCopyActionItems = () => {
    void copyToClipboard(exportActionItems(board), "Action items copied.");
  };

  const onCopyFullSummary = () => {
    void copyToClipboard(exportRetroSummary(board), "Retro summary copied.");
  };

  const saveTheme = (theme: string) => {
    storeActions.setBoardTheme(board.id, theme);
    setEditThemeOpen(false);
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
  }, [anonymous]);

  useEffect(() => {
    if (!discussion) return;
    // Don't bind discussion-mode keys while the card details modal is open —
    // the modal owns Esc and ←/→ might collide with text editing inside it.
    if (openCardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") exitDiscussion();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [discussion, next, prev, exitDiscussion, openCardId]);

  // F-19 board-scoped shortcut: `c` focuses the first column's add-card
  // composer. Suppressed in discussion mode (`c` would be ambiguous when
  // columns are sort-by-votes), in read-only/closed boards (no add
  // affordance), and when the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (t.isContentEditable) return;
      }
      if (isShortcutsCheatSheetOpen()) return;
      if (openCardId) return;

      if (e.key === "c" || e.key === "C") {
        if (closed || discussion) return;
        const first = columns[0];
        if (!first) return;
        e.preventDefault();
        requestAddCard(first.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [columns, closed, discussion, openCardId]);

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
    // F-21: pulse the card on cross-column arrival. Same 600ms newIds window
    // the addCard flow uses, so the existing `.card.new` keyframe handles
    // the visuals. Same-column reorder skips the pulse — column didn't change.
    if (drag.fromColumnId !== targetColId) {
      setNewIds((s) => new Set([...s, cardId]));
      setTimeout(() => {
        setNewIds((s) => {
          const n = new Set(s);
          n.delete(cardId);
          return n;
        });
      }, 600);
    }
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

  // ---- Card details modal (F-07) ------------------------------------------
  const openCardModal = useCallback(
    (cardId: string, originEl: HTMLElement | null) => {
      // Look in both live columns and the F-14 archive bucket so a deep link
      // (or a card that just got archived from the panel) still resolves.
      const exists =
        columns.some((c) => c.cards.some((card) => card.id === cardId)) ||
        board.archivedCards.some((c) => c.id === cardId);
      if (!exists) return;
      openOriginRef.current = originEl;
      setOpenCardId(cardId);
      // Replace (not push) so refresh restores the modal but back-button
      // doesn't accumulate a stack of card opens.
      if (typeof window !== "undefined") {
        history.replaceState(null, "", "#card=" + cardId);
      }
    },
    [columns, board.archivedCards],
  );

  const closeCardModal = useCallback(() => {
    setOpenCardId((prev) => (prev ? null : prev));
    // Side effects live OUTSIDE the updater. Under React 19 concurrent
    // rendering the updater can run during render; calling history.replaceState
    // there nudges Next's Router subscription mid-render and trips a
    // "setState in render" warning. Running these here is safe — replaceState
    // to the current URL is a visual no-op, and the focus restore guards on
    // origin existence.
    const origin = openOriginRef.current;
    openOriginRef.current = null;
    if (typeof window !== "undefined") {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    if (
      origin &&
      typeof document !== "undefined" &&
      document.body.contains(origin)
    ) {
      requestAnimationFrame(() => origin.focus());
    }
  }, []);

  // Hash sync: open #card=<id> on mount and react to back/forward navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const applyHash = () => {
      const m = /^#card=(.+)$/.exec(window.location.hash);
      if (!m) {
        if (openCardId) setOpenCardId(null);
        return;
      }
      const id = decodeURIComponent(m[1]);
      const exists =
        columns.some((c) => c.cards.some((card) => card.id === id)) ||
        board.archivedCards.some((c) => c.id === id);
      if (!exists) {
        // Stale or cross-board link: silent no-op, strip the hash so a
        // refresh doesn't re-trigger this branch.
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
        if (openCardId) setOpenCardId(null);
        return;
      }
      setOpenCardId(id);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // Re-run when the column tree shifts so a freshly added card opens via
    // its hash, and so a deleted card's stale hash gets cleared.
  }, [columns, board.archivedCards, openCardId]);

  // If the open card disappears from under us (permanently deleted), clear
  // the hash and close. Archive doesn't count as disappear: the card moves
  // into board.archivedCards and findCardOnBoard still resolves it.
  useEffect(() => {
    if (!openCardId) return;
    const exists =
      columns.some((c) => c.cards.some((card) => card.id === openCardId)) ||
      board.archivedCards.some((c) => c.id === openCardId);
    if (!exists) closeCardModal();
  }, [openCardId, columns, board.archivedCards, closeCardModal]);

  const openCard =
    openCardId ? findCardOnBoard(board, openCardId) ?? null : null;

  // Render the drag-overlay clone for the active drag.
  const renderOverlay = () => {
    if (!dragging) return null;
    if (dragging.kind === "card") {
      const card = findCard(columns, dragging.cardId);
      if (!card) return null;
      const fromCol = findColumnByCardId(columns, dragging.cardId);
      return (
        <CardView
          card={card}
          currentUserId={currentUserId}
          anonymous={anonymous}
          isTopVoted={false}
          isNew={false}
          readOnly={closed}
          dndEnabled={false}
          isActionCol={fromCol?.kind === "action"}
          isFollower
          onVote={() => {}}
          onSave={() => {}}
          onArchive={() => {}}
          findSourceCard={(srcId) => findCardOnBoard(board, srcId)}
        />
      );
    }
    const col = columns.find((c) => c.id === dragging.columnId);
    if (!col) return null;
    return (
      <ColumnView
        col={col}
        currentUserId={currentUserId}
        anonymous={anonymous}
        focused={false}
        sortByVotes={false}
        readOnly={closed}
        discussion={discussion}
        canEdit={false}
        autoEditTitle={false}
        newIds={newIds}
        dndEnabled={false}
        isActionCol={col.kind === "action"}
        editingTitle={false}
        setEditingTitle={() => {}}
        isFollower
        onVote={() => {}}
        onAdd={() => {}}
        onSaveCard={() => {}}
        onArchiveCard={() => {}}
        onRenameColumn={() => {}}
        onSaveColumnDesc={() => {}}
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
            <button
              type="button"
              className={"topbar-star" + (board.starred ? " on" : "")}
              onClick={() => storeActions.toggleStar(board.id)}
              aria-label={board.starred ? "Unstar retro" : "Star retro"}
              aria-pressed={board.starred}
              title={board.starred ? "Unstar retro" : "Star retro"}
            >
              <Icon
                name="star"
                size={14}
                fill={board.starred ? "currentColor" : "none"}
              />
            </button>
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

            {/* F-17: settings menu — owner-gated, hidden in discussion mode
                where the discussion-bar owns the topbar action cluster. */}
            {!discussion && (
              <BoardSettingsMenu
                board={board}
                isOwner={isOwner}
                onEditTheme={() => setEditThemeOpen(true)}
                onOpenArchive={() => setArchivePanelOpen(true)}
                onArchiveBoard={() => setConfirmArchiveBoard(true)}
                onReopenBoard={reopenBoard}
                onUnarchiveBoard={unarchiveBoard}
                onCopyActionItems={onCopyActionItems}
                onCopyFullSummary={onCopyFullSummary}
              />
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
                <button className="btn btn-primary" onClick={onFinishDiscussion}>
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
                              currentUserId={currentUserId}
                    anonymous={anonymous}
                    focused={discussion && col.id === focusColId}
                    sortByVotes={discussion && col.id === focusColId}
                    readOnly={closed}
                    discussion={discussion}
                    canEdit={isOwner}
                    autoEditTitle={autoEditColId === col.id}
                    newIds={newIds}
                    dndEnabled={dndEnabled}
                    isActionCol={col.kind === "action"}
                    onVote={onVote}
                    onAdd={onAdd}
                    onSaveCard={onSaveCard}
                    onArchiveCard={onArchiveCard}
                    onRenameColumn={onRenameColumn}
                    onSaveColumnDesc={onSaveColumnDesc}
                    onRequestDeleteColumn={onRequestDeleteColumn}
                    onAutoEditConsumed={() => setAutoEditColId(null)}
                    onCardKeyboardMove={handleCardKeyboardMove}
                    onColumnKeyboardMove={handleColumnKeyboardMove}
                    onOpenCardDetails={openCardModal}
                    findSourceCard={(srcId) => findCardOnBoard(board, srcId)}
                  />
                ))}
              </SortableContext>
              {!closed && !discussion && isOwner && (
                <button className="add-col" onClick={onAddColumn}>
                  <Icon name="plus" size={12} /> Add column
                </button>
              )}
            </div>
            <DragOverlay dropAnimation={DROP_ANIM}>{renderOverlay()}</DragOverlay>
          </DndContext>
        )}

      </div>

      {/* close-board confirm */}
      <div
        className={"modal-overlay" + (confirmClose ? " open" : "")}
        {...closeBoardOverlay.overlayProps}
      >
        <div className="modal" {...closeBoardOverlay.panelProps}>
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

      {/* F-23: rebuild Action column confirm (shown when existing Action col has cards) */}
      <div
        className={"modal-overlay" + (confirmRebuildAction ? " open" : "")}
        {...rebuildActionOverlay.overlayProps}
      >
        <div className="modal" {...rebuildActionOverlay.panelProps}>
          <h2>Rebuild Action column?</h2>
          <p>The current action items will be replaced. This can&apos;t be undone.</p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              autoFocus
              onClick={() => {
                setConfirmRebuildAction(false);
                exitDiscussion();
              }}
            >
              Cancel
            </button>
            <button className="btn btn-danger" onClick={performBuildActionColumn}>
              Rebuild
            </button>
          </div>
        </div>
      </div>

      {/* delete-column confirm (non-empty only) */}
      <div
        className={"modal-overlay" + (confirmDeleteTarget ? " open" : "")}
        {...deleteColumnOverlay.overlayProps}
      >
        <div className="modal" {...deleteColumnOverlay.panelProps}>
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

      {/* card details modal (F-07 shell) */}
      {openCard && (
        <CardDetailsModal
          card={openCard}
          currentUserId={currentUserId}
          boardId={board.id}
          anonymous={anonymous}
          readOnly={closed}
          isDiscussion={discussion}
          isActionCard={columns.some(
            (c) => c.kind === "action" && c.cards.some((x) => x.id === openCard.id),
          )}
          onClose={closeCardModal}
          onSaveTitle={(cardId, title) => storeActions.saveCard(cardId, title)}
          onSaveDescription={(cardId, description) =>
            storeActions.setCardDescription(board.id, cardId, description)
          }
          onVote={onVote}
          onArchive={onArchiveCard}
          onUnarchive={onUnarchiveCard}
          onRequestDeleteForever={(cardId) =>
            setConfirmDeleteForeverCardId(cardId)
          }
        />
      )}

      {/* F-14 archive panel — temp entry point (View archived link in board
          area below). F-17 will route it from the topbar settings menu. */}
      <ArchivedItemsPanel
        board={board}
        open={archivePanelOpen}
        readOnly={closed}
        onClose={() => setArchivePanelOpen(false)}
        onUnarchive={onUnarchiveCard}
        onRequestDeleteForever={(cardId) =>
          setConfirmDeleteForeverCardId(cardId)
        }
      />

      {/* delete-forever confirm (F-14) — solid red, irreversible */}
      <div
        className={
          "modal-overlay" + (confirmDeleteForeverCardId ? " open" : "")
        }
        {...deleteForeverOverlay.overlayProps}
      >
        <div className="modal" {...deleteForeverOverlay.panelProps}>
          <h2>Delete this card forever?</h2>
          <p>This can&apos;t be undone.</p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmDeleteForeverCardId(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirmDeleteForeverCardId) {
                  onDeleteCardForever(confirmDeleteForeverCardId);
                }
                setConfirmDeleteForeverCardId(null);
              }}
            >
              Delete forever
            </button>
          </div>
        </div>
      </div>

      {/* F-17 edit theme modal */}
      <EditThemeModal
        open={editThemeOpen}
        initialValue={board.theme}
        onCancel={() => setEditThemeOpen(false)}
        onSave={saveTheme}
      />

      {/* F-17 archive-board confirm */}
      <div
        className={"modal-overlay" + (confirmArchiveBoard ? " open" : "")}
        {...archiveBoardOverlay.overlayProps}
      >
        <div className="modal" {...archiveBoardOverlay.panelProps}>
          <h2>Archive this board?</h2>
          <p>
            Archive this board? It moves to the Archived group on your boards
            list. You can unarchive any time.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmArchiveBoard(false)}
            >
              Cancel
            </button>
            <button className="btn btn-danger" onClick={archiveBoard}>
              Archive
            </button>
          </div>
        </div>
      </div>

      {/* aria-live announcer for keyboard / drag movement */}
      <div className="dnd-live" aria-live="polite" role="status">
        {liveMessage}
      </div>

      {/* F-22: toast moved to the global host in <Sidebar> so it survives
          archive-board's `router.push("/")`. Fire via `fireToast(msg, undo?)`. */}
    </div>
  );
}
