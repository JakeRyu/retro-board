"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar, Icon } from "./Primitives";
import { Checklist } from "./Checklist";
import { LabelPicker } from "./Labels";
import { MemberPicker } from "./Members";
import { DueDateField } from "./DueDate";
import type { Card, Label, User } from "../_data/retro";

const URL_REGEX = /\bhttps?:\/\/\S+/g;

type CardDetailsModalProps = {
  card: Card;
  users: User[];
  /** Board id — needed by sub-features whose store actions are board-scoped. */
  boardId: string;
  /** Board-level label set. The picker mutates this; the card holds ids only. */
  labels: Label[];
  /** True when the local user owns the board (controls label CRUD affordances). */
  canEdit: boolean;
  isRetro: boolean;
  anonymous: boolean;
  readOnly: boolean;
  onClose: () => void;
  onSaveTitle: (cardId: string, title: string) => void;
  onSaveDescription: (cardId: string, description: string) => void;
  onVote: (cardId: string) => void;
};

// F-07 SHELL ONLY. Each `.cd-*` slot below is an empty labeled wrapper that
// the listed sub-feature spec will fill in. Do not change the wrapper class
// names — sub-feature CSS hangs off them.
export function CardDetailsModal({
  card,
  users,
  boardId,
  labels,
  canEdit,
  isRetro,
  anonymous,
  readOnly,
  onClose,
  onSaveTitle,
  onSaveDescription,
  onVote,
}: CardDetailsModalProps) {
  const [titleDraft, setTitleDraft] = useState(card.body);
  // Tracks where pointerdown landed so an in-modal text-selection drag that
  // releases over the overlay does not close the modal.
  const pointerStartedOnOverlay = useRef(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync local draft when the card changes underneath us (e.g. another
  // edit path mutates body while modal is open).
  useEffect(() => {
    setTitleDraft(card.body);
  }, [card.body]);

  // Esc closes. Mounted only while the modal is open so we don't fight other
  // window-level keydown handlers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitTitle = () => {
    const v = titleDraft.trim();
    if (!v) {
      // Reject empty: silently revert to the saved value.
      setTitleDraft(card.body);
      return;
    }
    if (v.length > 80) {
      setTitleDraft(card.body);
      return;
    }
    if (v !== card.body) onSaveTitle(card.id, v);
  };

  const onOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartedOnOverlay.current = e.target === e.currentTarget;
  };

  const onModalPointerDown = () => {
    pointerStartedOnOverlay.current = false;
  };

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!pointerStartedOnOverlay.current) return;
    pointerStartedOnOverlay.current = false;
    onClose();
  };

  const voted = card.voters.includes("me");
  const showVoteRow = isRetro && !readOnly;

  return (
    <div
      className="modal-overlay open"
      onPointerDown={onOverlayPointerDown}
      onClick={onOverlayClick}
    >
      <div
        className="modal modal-card-details"
        onPointerDown={onModalPointerDown}
        role="dialog"
        aria-modal="true"
        aria-label="Card details"
      >
        <button
          className="btn-icon cd-close"
          onClick={onClose}
          aria-label="Close card"
          type="button"
        >
          <Icon name="close" size={14} />
        </button>

        <header className="cd-header">
          <input
            ref={titleInputRef}
            className="board-title-input cd-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitTitle();
                titleInputRef.current?.blur();
              }
              if (e.key === "Escape") {
                // Revert local draft, then let the parent Esc handler close.
                setTitleDraft(card.body);
              }
            }}
            disabled={readOnly}
            maxLength={80}
            aria-label="Card title"
          />

          {showVoteRow && (
            <div className="cd-vote-row">
              <Voters voterIds={card.voters} users={users} anonymous={anonymous} />
              <button
                className="vote-btn"
                data-voted={voted}
                onClick={() => onVote(card.id)}
                onPointerDown={(e) => e.stopPropagation()}
                title={voted ? "Click to remove your vote." : "Vote on this card"}
                type="button"
              >
                <span className="arr">▲</span>
                <span>{card.voters.length}</span>
              </button>
            </div>
          )}
        </header>

        <div className="cd-grid">
          <div className="cd-main">
            {/* F-08 slot — owned by spec design-F-08.md */}
            <section className="cd-description">
              <h3 className="cd-section-label">Description</h3>
              <CardDescription
                cardId={card.id}
                description={card.description}
                readOnly={readOnly}
                onSave={onSaveDescription}
              />
            </section>

            {/* F-09 slot — owned by spec design-F-09.md */}
            <section className="cd-checklist">
              <h3 className="cd-section-label">Checklist</h3>
              <Checklist
                boardId={boardId}
                cardId={card.id}
                items={card.checklist ?? []}
                readOnly={readOnly}
              />
            </section>

            {/* F-13 slot — owned by spec design-F-13.md */}
            <section className="cd-comments">
              <h3 className="cd-section-label">Comments</h3>
              <p className="cd-placeholder">
                Comments will be added in F-13.
              </p>
            </section>
          </div>

          <aside className="cd-side">
            {/* F-10 slot — owned by spec design-F-10.md */}
            <section className="cd-side-due">
              <h3 className="cd-section-label">Due date</h3>
              <DueDateField
                boardId={boardId}
                cardId={card.id}
                dueDate={card.dueDate}
                dueComplete={card.dueComplete ?? false}
                readOnly={readOnly}
              />
            </section>

            {/* F-11 slot — owned by spec design-F-11.md */}
            <section className="cd-side-labels">
              <h3 className="cd-section-label">Labels</h3>
              <LabelPicker
                boardId={boardId}
                cardId={card.id}
                labels={labels}
                cardLabelIds={card.labels ?? []}
                readOnly={readOnly}
                canEdit={canEdit}
              />
            </section>

            {/* F-12 slot — owned by spec design-F-12.md */}
            <section className="cd-side-members">
              <h3 className="cd-section-label">Members</h3>
              <MemberPicker
                boardId={boardId}
                cardId={card.id}
                users={users}
                assigneeIds={card.assigneeIds ?? []}
                readOnly={readOnly}
              />
            </section>

            {/* F-14 slot — owned by spec design-F-14.md */}
            <section className="cd-side-archive">
              <h3 className="cd-section-label">Actions</h3>
              <p className="cd-placeholder">Archive will be added in F-14.</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Local copy of the Voters pile — same visual as Card.tsx's voter row, but
// kept private here so the modal doesn't depend on Card's internal exports.
function Voters({
  voterIds,
  users,
  anonymous,
}: {
  voterIds: string[];
  users: User[];
  anonymous: boolean;
}) {
  const max = 6;
  const shown = voterIds.slice(0, max);
  const overflow = voterIds.length - shown.length;
  return (
    <div className="voters">
      {shown.map((id, i) => {
        const u = users.find((x) => x.id === id);
        if (!u) return null;
        if (anonymous) {
          return (
            <span
              key={id + i}
              className="avatar"
              style={{
                background: "var(--surface-08)",
                color: "var(--fg3)",
                fontSize: 8,
              }}
            >
              ?
            </span>
          );
        }
        return <Avatar key={id + i} user={u} size={18} />;
      })}
      {overflow > 0 && <span className="voters-more">+{overflow}</span>}
    </div>
  );
}

// --- F-08 Description --------------------------------------------------------

type CardDescriptionProps = {
  cardId: string;
  description: string | undefined;
  readOnly: boolean;
  onSave: (cardId: string, description: string) => void;
};

function CardDescription({
  cardId,
  description,
  readOnly,
  onSave,
}: CardDescriptionProps) {
  const saved = description ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // If the underlying card description changes from elsewhere while we're not
  // actively editing, mirror it into the local draft so the next edit starts
  // from the latest value.
  useEffect(() => {
    if (!editing) setDraft(saved);
  }, [saved, editing]);

  // Autosize: grow with content up to ~12 rows, then scroll. Runs while
  // editing so the textarea fits the draft on every keystroke.
  useLayoutEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const parsedLine = parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLine) ? parsedLine : 20;
    const padding =
      parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const maxHeight = lineHeight * 12 + padding;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft, editing]);

  const enterEdit = () => {
    if (readOnly) return;
    setDraft(saved);
    setEditing(true);
    // Defer focus so the textarea is mounted; cursor lands at end.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  };

  const commit = () => {
    if (draft.trim() !== saved.trim()) {
      onSave(cardId, draft);
    }
    setEditing(false);
  };

  if (!editing) {
    const isEmpty = saved.trim().length === 0;
    if (isEmpty) {
      return (
        <div
          className={
            "cd-description-render empty" + (readOnly ? " readonly" : "")
          }
          role={readOnly ? undefined : "button"}
          tabIndex={readOnly ? -1 : 0}
          onClick={readOnly ? undefined : enterEdit}
          onKeyDown={(e) => {
            if (readOnly) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              enterEdit();
            }
          }}
        >
          Add a more detailed description…
        </div>
      );
    }
    return (
      <div
        className={
          "cd-description-render" + (readOnly ? " readonly" : "")
        }
        onClick={(e) => {
          if (readOnly) return;
          // Anchor click should follow the link, not enter edit mode.
          const target = e.target as HTMLElement | null;
          if (target && target.closest("a")) return;
          enterEdit();
        }}
      >
        {renderDescription(saved)}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      className="cd-description-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          // Revert and exit; consume so the modal-level Esc doesn't close it.
          e.stopPropagation();
          e.preventDefault();
          setDraft(saved);
          setEditing(false);
          return;
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        }
      }}
      placeholder="Add a more detailed description…"
      disabled={readOnly}
      rows={4}
    />
  );
}

// Render a description body with line breaks preserved (via `white-space:
// pre-wrap` on the wrapper) and any URLs auto-linked. Backlog says no full
// markdown — this is the entire transform.
function renderDescription(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // `URL_REGEX` is module-level with /g; reset before each pass.
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      parts.push(<Fragment key={lastIndex}>{text.slice(lastIndex, start)}</Fragment>);
    }
    parts.push(
      <a
        key={"a-" + start}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>,
    );
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={lastIndex}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}
