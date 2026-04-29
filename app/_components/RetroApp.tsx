"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Column } from "./Column";
import { Sidebar } from "./Sidebar";
import { Avatar, Icon } from "./Primitives";
import type { Board } from "../_data/retro";
import { USERS } from "../_data/retro";
import { storeActions, useBoard } from "../_data/store";

export function RetroApp({ boardId }: { boardId: string }) {
  const board = useBoard(boardId);

  // Keep the store's active id in sync with the route, so mutation helpers
  // (which target the active board) operate on the board the user is viewing.
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

function RetroAppLoaded({ board }: { board: Board }) {
  const columns = board.columns;
  const closed = board.state === "closed";
  const crumbPrefix = board.type === "retro" ? "Retros" : "Boards";

  const [anonymous, setAnonymous] = useState(false);
  const [themeOpen, setThemeOpen] = useState(true);
  const [discussion, setDiscussion] = useState(false);
  const [focusColId, setFocusColId] = useState<string>(columns[0]?.id ?? "");
  const [confirmClose, setConfirmClose] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anonInitialized = useRef(false);

  // Keep the discussion focus pointer valid if hydration / external mutation
  // changes the column set under us.
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

  // toggle anon → toast (skip first run on mount)
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

  // keyboard nav inside discussion mode
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

  return (
    <div className="app" data-discussion={discussion}>
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
            {/* presence */}
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

        {/* ---- board area ---- */}
        <div className="board-area">
          {columns.map((col) => (
            <Column
              key={col.id}
              col={col}
              users={USERS}
              anonymous={anonymous}
              focused={discussion && col.id === focusColId}
              sortByVotes={discussion && col.id === focusColId}
              readOnly={closed}
              newIds={newIds}
              onVote={onVote}
              onAdd={onAdd}
              onSaveCard={onSaveCard}
              onDeleteCard={onDeleteCard}
            />
          ))}
          {!closed && !discussion && (
            <button className="add-col">
              <Icon name="plus" size={12} /> Add column
            </button>
          )}
        </div>
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
            <button className="btn btn-primary" onClick={closeBoard}>
              Close board
            </button>
          </div>
        </div>
      </div>

      {/* toast */}
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}
