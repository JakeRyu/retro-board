"use client";

// F-14 — board-level archive panel.
//
// Mounted from `RetroApp.tsx` via a temporary "View archived (N)" link below
// the board area. F-17 will move this entry point into the board settings
// menu in the topbar; the panel itself stays.
//
// Visual: right-anchored overlay panel sliding in from the right (so a long
// archive list scrolls without rearranging the board layout below).

import { useEffect, useRef } from "react";
import { Icon } from "./Primitives";
import { formatRelativeTime } from "../_lib/relativeTime";
import type { Board, Card } from "../_data/retro";

type ArchivedItemsPanelProps = {
  board: Board;
  open: boolean;
  readOnly: boolean;
  onClose: () => void;
  onUnarchive: (cardId: string) => void;
  onRequestDeleteForever: (cardId: string) => void;
};

export function ArchivedItemsPanel({
  board,
  open,
  readOnly,
  onClose,
  onUnarchive,
  onRequestDeleteForever,
}: ArchivedItemsPanelProps) {
  // Pointerdown-vs-click guard so a text-selection drag inside the panel that
  // releases over the overlay doesn't close the panel — same pattern as F-07.
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

  // Most-recently-archived first. Render order is independent of insertion
  // order so a unarchive/re-archive doesn't shuffle the list mid-session.
  const rows = [...board.archivedCards].sort((a, b) =>
    (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""),
  );

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
      className={
        "modal-overlay archive-panel-overlay" + (open ? " open" : "")
      }
      onPointerDown={onOverlayPointerDown}
      onClick={onOverlayClick}
      aria-hidden={!open}
    >
      <aside
        className="archive-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Archived items"
        onPointerDown={onPanelPointerDown}
      >
        <header className="archive-panel-head">
          <h2>Archived items</h2>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close archived items"
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        {readOnly && (
          <div className="archive-panel-readonly">
            This board is closed — archive is read-only.
          </div>
        )}
        <div className="archive-panel-body">
          {rows.length === 0 ? (
            <p className="archive-empty">Nothing archived yet.</p>
          ) : (
            rows.map((card) => (
              <ArchiveRow
                key={card.id}
                board={board}
                card={card}
                readOnly={readOnly}
                onUnarchive={onUnarchive}
                onRequestDeleteForever={onRequestDeleteForever}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

type ArchiveRowProps = {
  board: Board;
  card: Card;
  readOnly: boolean;
  onUnarchive: (cardId: string) => void;
  onRequestDeleteForever: (cardId: string) => void;
};

function ArchiveRow({
  board,
  card,
  readOnly,
  onUnarchive,
  onRequestDeleteForever,
}: ArchiveRowProps) {
  // Origin column may have been deleted between archive and now; the row sub-
  // line shows "in <deleted column>" in that case so the user still sees the
  // intended destination — the actual unarchive will fall through to the
  // first column (handled by the store action).
  const originCol = board.columns.find((c) => c.id === card.originColumnId);
  const colLabel = originCol ? originCol.title : "deleted column";
  const time = card.archivedAt ? formatRelativeTime(card.archivedAt) : "";
  return (
    <div className="archive-row">
      <div className="archive-row-title" title={card.body}>
        {card.body}
      </div>
      <div className="archive-row-meta">
        in {colLabel}
        {time ? ` · ${time}` : ""}
      </div>
      <div className="archive-row-actions">
        <button
          type="button"
          className="btn-toolbar"
          onClick={() => onUnarchive(card.id)}
          disabled={readOnly}
        >
          Unarchive
        </button>
        <button
          type="button"
          className="btn-toolbar danger-tone"
          onClick={() => onRequestDeleteForever(card.id)}
          disabled={readOnly}
        >
          Delete forever
        </button>
      </div>
    </div>
  );
}
