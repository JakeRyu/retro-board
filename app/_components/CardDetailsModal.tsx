"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Icon } from "./Primitives";
import type { Card, User } from "../_data/retro";

type CardDetailsModalProps = {
  card: Card;
  users: User[];
  isRetro: boolean;
  anonymous: boolean;
  readOnly: boolean;
  onClose: () => void;
  onSaveTitle: (cardId: string, title: string) => void;
  onVote: (cardId: string) => void;
};

// F-07 SHELL ONLY. Each `.cd-*` slot below is an empty labeled wrapper that
// the listed sub-feature spec will fill in. Do not change the wrapper class
// names — sub-feature CSS hangs off them.
export function CardDetailsModal({
  card,
  users,
  isRetro,
  anonymous,
  readOnly,
  onClose,
  onSaveTitle,
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
              <p className="cd-placeholder">
                Description will be added in F-08.
              </p>
            </section>

            {/* F-09 slot — owned by spec design-F-09.md */}
            <section className="cd-checklist">
              <h3 className="cd-section-label">Checklist</h3>
              <p className="cd-placeholder">
                Checklist will be added in F-09.
              </p>
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
              <p className="cd-placeholder">F-10.</p>
            </section>

            {/* F-11 slot — owned by spec design-F-11.md */}
            <section className="cd-side-labels">
              <h3 className="cd-section-label">Labels</h3>
              <p className="cd-placeholder">F-11.</p>
            </section>

            {/* F-12 slot — owned by spec design-F-12.md */}
            <section className="cd-side-members">
              <h3 className="cd-section-label">Members</h3>
              <p className="cd-placeholder">F-12.</p>
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
