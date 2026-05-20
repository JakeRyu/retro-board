"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { storeActions, useStore } from "../_data/store";
import { WORKSPACES, workspaceColor } from "../_data/retro";
import type { Board } from "../_data/retro";
import { initialsFromName, colorFromName } from "../_lib/avatar";
import { Avatar, Icon } from "./Primitives";
import { CreateBoardDialog } from "./CreateBoardDialog";
import { SearchDialog } from "./SearchDialog";
import { GlobalShortcuts } from "./GlobalShortcuts";
import { ShortcutsCheatSheet } from "./ShortcutsCheatSheet";
import { Toast } from "./Toast";
import {
  openCreateBoardDialog,
  useCreateBoardDialogHost,
} from "../_hooks/useCreateBoardDialog";
import {
  openSearchDialog,
  useSearchDialogHost,
} from "../_hooks/useSearchDialog";
import { useIsMac } from "../_hooks/useIsMac";

function cardCount(b: Board): number {
  return b.columns.reduce((n, c) => n + c.cards.length, 0);
}

// A single retro entry in the sidebar list. Closed retros render muted — a
// dimmed label plus a hollow (ring-only) color swatch — so the open work the
// sidebar is mostly used for stays visually dominant.
function SidebarBoardLink({
  board,
  active,
}: {
  board: Board;
  active: boolean;
}) {
  const count = cardCount(board);
  const isClosed = board.state === "closed";
  return (
    <Link
      href={`/boards/${board.id}`}
      className={
        "side-item" + (isClosed ? " closed" : "") + (active ? " active" : "")
      }
    >
      <span
        className="swatch"
        style={
          isClosed
            ? {
                background: "transparent",
                boxShadow: `inset 0 0 0 1.5px ${board.color}`,
              }
            : { background: board.color }
        }
      />
      {board.title}
      <span className="count">{count > 0 ? count : "·"}</span>
    </Link>
  );
}

export function Sidebar() {
  const { boards, activeWorkspaceId } = useStore();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const dialog = useCreateBoardDialogHost();
  const searchDialog = useSearchDialogHost();
  const isMac = useIsMac();

  const activeWorkspace =
    WORKSPACES.find((w) => w.id === activeWorkspaceId) ?? WORKSPACES[0];
  const wsColor = workspaceColor(activeWorkspace.id);
  const wsMark = activeWorkspace.name.charAt(0).toUpperCase();

  const activeBoards = boards.filter(
    (b) => !b.archivedAt && b.workspaceId === activeWorkspace.id,
  );
  // Starred retros first; otherwise stable input order.
  const sorted = activeBoards
    .slice()
    .sort((a, b) => (a.starred !== b.starred ? (a.starred ? -1 : 1) : 0));
  // Closed retros drop to their own group at the bottom. Starred boards stay
  // on top regardless of state — matching the boards-list page's partition,
  // where starred takes precedence over closed.
  const openRetros = sorted.filter((b) => b.starred || b.state !== "closed");
  const closedRetros = sorted.filter(
    (b) => !b.starred && b.state === "closed",
  );

  const boardIdMatch = pathname.match(/^\/boards\/([^/]+)/);
  const activeBoardId = boardIdMatch?.[1];

  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const wsRef = useRef<HTMLDivElement | null>(null);

  // Ensure the store holds the full board list for the active workspace.
  // The sidebar (retro list + "All retros" count) renders on board pages
  // too, but a board page only fetches the single board being viewed
  // (RetroApp → fetchBoardById). Landing on a board URL directly — a
  // refresh or a shared link — would otherwise leave the store holding
  // just that one board and the sidebar showing an incomplete list. The
  // boards-list page also fetches this; the overlap is a harmless GET.
  useEffect(() => {
    void storeActions
      .fetchBoardsForWorkspace(activeWorkspace.id)
      .catch(() => {});
  }, [activeWorkspace.id]);

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
          type="button"
          className="btn btn-subtle"
          style={{ width: "100%", justifyContent: "flex-start", height: 28 }}
          onClick={(e) => openSearchDialog(e.currentTarget)}
        >
          <Icon name="search" size={13} /> Search
          <span style={{ marginLeft: "auto" }} className="kbd">
            {isMac ? "⌘K" : "Ctrl+K"}
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
        {openRetros.map((b) => (
          <SidebarBoardLink
            key={b.id}
            board={b}
            active={b.id === activeBoardId}
          />
        ))}
      </div>

      {closedRetros.length > 0 && (
        <div className="side-section">
          <div className="side-head">Closed</div>
          {closedRetros.map((b) => (
            <SidebarBoardLink
              key={b.id}
              board={b}
              active={b.id === activeBoardId}
            />
          ))}
        </div>
      )}

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
      <SearchDialog open={searchDialog.open} onClose={searchDialog.close} />
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

  // Bootstrap-once read of /api/me on the first authenticated render. The
  // store-side flag guards against duplicate fires across remounts.
  useEffect(() => {
    if (status === "authenticated") {
      void storeActions.fetchUserState();
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="side-item">
        <Avatar user={{ initials: "··", color: "var(--fg4)" }} size={20} />
        <span style={{ fontSize: 13, color: "var(--fg4)" }}>…</span>
        <Icon
          name="logout"
          size={13}
          style={{ marginLeft: "auto", color: "var(--fg4)", opacity: 0.4 }}
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
      <button
        type="button"
        className="sidebar-user-logout"
        title="Sign out"
        aria-label="Sign out"
        onClick={() => signOut({ callbackUrl: "/" })}
        style={{
          marginLeft: "auto",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--fg4)",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <Icon name="logout" size={13} />
      </button>
    </div>
  );
}
