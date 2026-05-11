"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { storeActions, useStore } from "../_data/store";
import { BOARD_COLORS, WORKSPACES, workspaceColor } from "../_data/retro";
import type { Board } from "../_data/retro";
import { Avatar, Icon } from "./Primitives";

// Derive a stable 2-letter avatar string from a display name.
//   "Jihyung Ryu" → "JR"   "maya"       → "MA"
//   "Wen"         → "WE"   ""           → "??"
// Single-word names fall back to the first two letters so the avatar circle
// never renders as one centred glyph (looks lopsided next to multi-word peers).
function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Hash the name to a BOARD_COLORS index so the swatch is deterministic across
// renders and sessions. Mirrors workspaceColor()'s formula on purpose — same
// palette keeps the sidebar visually coherent (boards, workspaces, user).
function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h * 31) + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % BOARD_COLORS.length;
  return BOARD_COLORS[idx];
}
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
  const router = useRouter();
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
                    const changed = w.id !== activeWorkspace.id;
                    storeActions.setActiveWorkspace(w.id);
                    setWsMenuOpen(false);
                    // Switching workspace lands the user on All retros so the
                    // new workspace's boards are the immediate context.
                    if (changed && pathname !== "/") router.push("/");
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
        <SidebarUser />
      </div>
      <CreateBoardDialog open={dialog.open} onClose={dialog.close} />
      <ShortcutsCheatSheet />
      <GlobalShortcuts />
      <Toast />
    </aside>
  );
}

// Bottom-of-sidebar identity row. Reads the Entra session and renders the
// user's display name + a derived avatar. Falls back to email-prefix, then
// a neutral "User" / "??" placeholder so the row never breaks layout while
// the session is still loading or arriving without a profile.
function SidebarUser() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="side-item">
        <Avatar user={{ initials: "··", color: "var(--fg4)" }} size={20} />
        <span style={{ fontSize: 13, color: "var(--fg4)" }}>…</span>
        <Icon
          name="settings"
          size={13}
          style={{ marginLeft: "auto", color: "var(--fg4)" }}
        />
      </div>
    );
  }

  const name = session?.user?.name?.trim();
  const emailPrefix = session?.user?.email?.split("@")[0]?.trim();
  const label = name || emailPrefix || "User";
  const initials = name || emailPrefix ? initialsFromName(label) : "??";
  const color = name || emailPrefix ? colorFromName(label) : "var(--fg4)";

  return (
    <div className="side-item">
      <Avatar user={{ initials, color }} size={20} />
      <span style={{ fontSize: 13 }}>{label}</span>
      <Icon
        name="settings"
        size={13}
        style={{ marginLeft: "auto", color: "var(--fg4)" }}
      />
    </div>
  );
}
