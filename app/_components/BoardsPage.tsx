"use client";

import type { Board } from "../_data/retro";
import { useStore } from "../_data/store";
import { useSectionCollapsed } from "../_hooks/useSectionCollapsed";
import { openCreateBoardDialog } from "../_hooks/useCreateBoardDialog";
import { BoardCard } from "./BoardCard";
import { Sidebar } from "./Sidebar";
import { Icon } from "./Primitives";

type SectionKey = "starred" | "open" | "closed" | "archived";

type Section = {
  key: SectionKey;
  label: string;
  boards: Board[];
};

function partition(boards: Board[]): Record<SectionKey, Board[]> {
  const out: Record<SectionKey, Board[]> = {
    starred: [],
    open: [],
    closed: [],
    archived: [],
  };
  for (const b of boards) {
    if (b.archivedAt) {
      out.archived.push(b);
      continue;
    }
    if (b.starred) {
      out.starred.push(b);
      continue;
    }
    if (b.state === "closed") {
      out.closed.push(b);
      continue;
    }
    out.open.push(b);
  }
  return out;
}

export function BoardsPage() {
  const { boards } = useStore();

  const onCreateBoard = (e: React.MouseEvent<HTMLButtonElement>) => {
    openCreateBoardDialog(e.currentTarget);
  };

  const groups = partition(boards);
  const totalBoards =
    groups.starred.length + groups.open.length + groups.closed.length + groups.archived.length;

  // Per spec §4: hide Starred / Closed / Archived when empty; keep Open visible
  // even when empty (legitimate edge case after archiving everything).
  const sections: Section[] = [];
  if (groups.starred.length > 0) {
    sections.push({ key: "starred", label: "STARRED", boards: groups.starred });
  }
  sections.push({ key: "open", label: "OPEN", boards: groups.open });
  if (groups.closed.length > 0) {
    sections.push({ key: "closed", label: "CLOSED", boards: groups.closed });
  }
  if (groups.archived.length > 0) {
    sections.push({ key: "archived", label: "ARCHIVED", boards: groups.archived });
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div className="boards-page-head">
            <h1 className="boards-page-title">Boards</h1>
            <div className="boards-page-spacer" />
            <button
              className="btn btn-primary"
              type="button"
              onClick={onCreateBoard}
            >
              <span style={{ color: "currentColor" }}>+</span> Create board
            </button>
          </div>
        </div>

        {totalBoards === 0 ? (
          <div className="board-empty">
            <div className="modal">
              <h2>No boards yet.</h2>
              <p>
                Create one to get started — kanban for ongoing work, retro for a team
                look-back.
              </p>
              <div className="modal-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={onCreateBoard}
                >
                  Create board
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="boards-page">
            {sections.map((section) => (
              <BoardsSection key={section.key} section={section} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BoardsSection({ section }: { section: Section }) {
  // Archived collapses by default; everything else expands.
  const [collapsed, toggle] = useSectionCollapsed(
    section.key,
    section.key === "archived",
  );

  return (
    <section className="board-section">
      <button
        type="button"
        className={"section-title" + (collapsed ? " collapsed" : "")}
        onClick={toggle}
        aria-expanded={!collapsed}
      >
        <span className="section-caret" aria-hidden>
          <Icon name="chevron" size={12} />
        </span>
        <span className="section-label">{section.label}</span>
        <span className="section-count">{section.boards.length}</span>
      </button>

      {!collapsed && (
        section.boards.length === 0 ? (
          <div className="section-empty">Nothing open right now.</div>
        ) : (
          <div className="board-grid">
            {section.boards.map((b) => (
              <BoardCard key={b.id} board={b} />
            ))}
          </div>
        )
      )}
    </section>
  );
}
