"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Board } from "../_data/retro";
import { storeActions } from "../_data/store";
import { Icon } from "./Primitives";
import { formatRelativeTime } from "../_lib/relativeTime";

type Props = {
  board: Board;
};

function cardCount(board: Board): number {
  return board.columns.reduce((n, c) => n + c.cards.length, 0);
}

export function BoardCard({ board }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Click-away to dismiss the kebab menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const closed = board.state === "closed";
  const archived = !!board.archivedAt;
  const dimmed = closed || archived;

  const onStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    storeActions.toggleStar(board.id);
  };

  const onKebab = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((o) => !o);
  };

  const onMenuStar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    storeActions.toggleStar(board.id);
    setMenuOpen(false);
  };

  return (
    <Link
      href={`/boards/${board.id}`}
      className={"board-card" + (dimmed ? " dimmed" : "")}
    >
      <button
        type="button"
        className={"board-card-star" + (board.starred ? " on" : "")}
        onClick={onStarClick}
        aria-label={board.starred ? "Unstar board" : "Star board"}
        aria-pressed={board.starred}
      >
        <Icon
          name="star"
          size={14}
          fill={board.starred ? "currentColor" : "none"}
        />
      </button>

      <div className="board-card-title" title={board.title}>{board.title}</div>

      <div
        className="board-card-stripe"
        style={{ background: board.color }}
        aria-hidden
      />

      <div className="board-card-meta">
        <span className={"state-pill " + board.type}>{board.type}</span>
        <span className="board-card-count">
          · {cardCount(board)} {cardCount(board) === 1 ? "card" : "cards"}
        </span>
      </div>

      {archived ? (
        <span className="state-pill archived board-card-state">archived</span>
      ) : closed ? (
        <span className="state-pill closed board-card-state">closed · read-only</span>
      ) : (
        <div className="board-card-time">
          updated {formatRelativeTime(board.updatedAt)}
        </div>
      )}

      <div className="board-card-kebab-wrap" ref={menuRef}>
        <button
          type="button"
          className="board-card-kebab"
          onClick={onKebab}
          aria-label="Board actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <KebabGlyph />
        </button>
        {menuOpen && (
          <div className="kebab-menu board-card-menu" role="menu">
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={onMenuStar}
            >
              {board.starred ? "Unstar" : "Star"}
            </button>
            <a
              className="menu-item"
              role="menuitem"
              href={`/boards/${board.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
              }}
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}

function KebabGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
