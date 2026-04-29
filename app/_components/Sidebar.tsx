"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "../_data/store";
import type { Board } from "../_data/retro";
import { Avatar, Icon } from "./Primitives";

function cardCount(b: Board): number {
  return b.columns.reduce((n, c) => n + c.cards.length, 0);
}

export function Sidebar() {
  const { boards } = useStore();
  const pathname = usePathname() ?? "/";

  const activeBoards = boards.filter((b) => !b.archivedAt);
  const retros = activeBoards
    .filter((b) => b.type === "retro")
    .slice()
    .sort((a, b) => {
      // Spec §7: starred retros first; otherwise stable input order.
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return 0;
    });

  // Active-state rule (spec §7):
  //   "/"               -> Boards
  //   "/boards/[id]" kanban -> Boards
  //   "/boards/[id]" retro  -> matching retro row, NOT Boards
  const boardIdMatch = pathname.match(/^\/boards\/([^/]+)/);
  const activeBoardId = boardIdMatch?.[1];
  const activeBoard = activeBoardId
    ? boards.find((b) => b.id === activeBoardId)
    : undefined;
  const isRetroRoute = activeBoard?.type === "retro";

  const boardsItemActive = pathname === "/" || (!!activeBoard && !isRetroRoute);

  return (
    <aside className="sidebar">
      <div className="workspace">
        <span className="ws-mark">A</span>
        <span className="ws-name">Atlas</span>
        <Icon
          name="chevron"
          size={14}
          style={{ marginLeft: "auto", color: "var(--fg4)" }}
        />
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
      </div>

      <div className="side-section">
        <div className="side-head">Workspace</div>
        <div className="side-item">
          <Icon name="inbox" size={15} /> Inbox <span className="count">3</span>
        </div>
        <Link
          href="/"
          className={"side-item" + (boardsItemActive ? " active" : "")}
        >
          <Icon name="board" size={15} /> Boards
          <span className="count">{activeBoards.length}</span>
        </Link>
        <div className="side-item">
          <Icon name="cycle" size={15} /> Cycles <span className="count">2</span>
        </div>
      </div>

      <div className="side-section">
        <div className="side-head">Retros</div>
        {retros.map((b) => {
          const isActive = isRetroRoute && b.id === activeBoardId;
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
    </aside>
  );
}
