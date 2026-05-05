"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { storeActions, useStore } from "../_data/store";
import { WORKSPACES, workspaceColor } from "../_data/retro";
import type { Board } from "../_data/retro";
import { Avatar, Icon } from "./Primitives";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { ShortcutsCheatSheet } from "./ShortcutsCheatSheet";
import { Toast } from "./Toast";
import {
  openCreateBoardDialog,
  useCreateBoardDialogHost,
} from "../_hooks/useCreateBoardDialog";

function cardCount(b: Board): number {
  return b.columns.reduce((n, c) => n + c.cards.length, 0);
}

export function Sidebar() {
  const { boards, activeWorkspaceId } = useStore();
  const pathname = usePathname() ?? "/";
  const dialog = useCreateBoardDialogHost();

  const activeWorkspace =
    WORKSPACES.find((w) => w.id === activeWorkspaceId) ?? WORKSPACES[0];
  const wsColor = workspaceColor(activeWorkspace.id);
  const wsMark = activeWorkspace.name.charAt(0).toUpperCase();

  const activeBoards = boards.filter(
    (b) => !b.archivedAt && b.workspaceId === activeWorkspace.id,
  );
  const retros = activeBoards
    .slice()
    .sort((a, b) => {
      // Starred retros first; otherwise stable input order.
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return 0;
    });

  const boardIdMatch = pathname.match(/^\/boards\/([^/]+)/);
  const activeBoardId = boardIdMatch?.[1];

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement | null>(null);

  // Click-away + Esc dismiss for the workspace switcher dropdown.
  useEffect(() => {
    if (!wsMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wsRef.current?.contains(e.target as Node)) setWsMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [wsMenuOpen]);

  return (
    <aside className="sidebar">
      <div
        ref={wsRef}
        className={"workspace" + (wsMenuOpen ? " open" : "")}
      >
        <button
          type="button"
          className="workspace-trigger"
          aria-haspopup="menu"
          aria-expanded={wsMenuOpen}
          title="Switch workspace"
          onClick={() => setWsMenuOpen((o) => !o)}
        >
          <span
            className="ws-mark"
            style={{ background: wsColor }}
            aria-hidden
          >
            {wsMark}
          </span>
          <span className="ws-name">{activeWorkspace.name}</span>
          <span className="ws-chevron" aria-hidden>
            <Icon name="chevron" size={14} />
          </span>
        </button>
        {wsMenuOpen && (
          <div
            className="kebab-menu workspace-menu"
            role="menu"
          >
            {WORKSPACES.map((w) => {
              const isActive = w.id === activeWorkspace.id;
              const color = workspaceColor(w.id);
              const mark = w.name.charAt(0).toUpperCase();
              return (
                <button
                  key={w.id}
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    storeActions.setActiveWorkspace(w.id);
                    setWsMenuOpen(false);
                  }}
                >
                  <span
                    className="menu-item-mark"
                    style={{ background: color }}
                    aria-hidden
                  >
                    {mark}
                  </span>
                  <span>{w.name}</span>
                  {isActive && (
                    <span className="menu-item-check" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="side-section">
        <button
          className="btn btn-subtle"
          style={{ width: "100%", justifyContent: "flex-start", height: 28 }}
        >
          <Icon name="search" size={13} /> Search
          <span style={{ marginLeft: "auto" }} className="kbd">
            ⌘K
          </span>
        </button>

        <Link
          href="/"
          className={
            "side-item" + (pathname === "/" ? " active" : "")
          }
          style={{ marginTop: 6 }}
        >
          <Icon name="board" size={15} /> All retros
          <span className="count">{activeBoards.length}</span>
        </Link>
      </div>

      <div className="side-section">
        <div className="side-head">Retros</div>
        <button
          type="button"
          className="side-item side-item-create"
          onClick={(e) => openCreateBoardDialog(e.currentTarget)}
        >
          <span className="side-create-glyph" aria-hidden>
            +
          </span>
          Create retro
        </button>
        {retros.map((b) => {
          const isActive = b.id === activeBoardId;
          const count = cardCount(b);
          return (
            <Link
              key={b.id}
              href={`/boards/${b.id}`}
              className={"side-item" + (isActive ? " active" : "")}
            >
              <span className="swatch" style={{ background: b.color }} />
              {b.title}
              <span className="count">{count > 0 ? count : "·"}</span>
            </Link>
          );
        })}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: 12,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div className="side-item">
          <Avatar user={{ initials: "YO", color: "#5e6ad2" }} size={20} />
          <span style={{ fontSize: 13 }}>You</span>
          <Icon
            name="settings"
            size={13}
            style={{ marginLeft: "auto", color: "var(--fg4)" }}
          />
        </div>
      </div>
      <CreateBoardDialog open={dialog.open} onClose={dialog.close} />
      <ShortcutsCheatSheet />
      <GlobalShortcuts />
      <Toast />
    </aside>
  );
}
