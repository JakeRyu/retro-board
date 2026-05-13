"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, Icon } from "./Primitives";
import type { Card as CardType, RetroCard, Voter } from "../_data/retro";
import { colorFromName, initialsFromName } from "../_lib/avatar";

type VotersProps = {
  voters: Voter[];
  anonymous: boolean;
};

function Voters({ voters, anonymous }: VotersProps) {
  const max = 4;
  const shown = voters.slice(0, max);
  const overflow = voters.length - shown.length;
  return (
    <div className="voters">
      {shown.map((v, i) => {
        if (anonymous) {
          return (
            <span
              key={v.id + i}
              className="avatar"
              style={{ background: "var(--surface-08)", color: "var(--fg3)", fontSize: 8 }}
            >
              ?
            </span>
          );
        }
        return (
          <Avatar
            key={v.id + i}
            user={{ initials: initialsFromName(v.name), color: colorFromName(v.name) }}
            size={16}
          />
        );
      })}
      {overflow > 0 && <span className="voters-more">+{overflow}</span>}
    </div>
  );
}

type VoteButtonProps = {
  count: number;
  voted: boolean;
  onClick: () => void;
};

function VoteButton({ count, voted, onClick }: VoteButtonProps) {
  return (
    <button
      className="vote-btn"
      data-voted={voted}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      title={voted ? "Click to remove your vote." : "Vote on this card"}
    >
      <span className="arr">▲</span>
      <span>{count}</span>
    </button>
  );
}

export type CardProps = {
  card: RetroCard;
  /** Signed-in Entra user's id. Used to decide isMine + vote-toggled state.
   *  Empty string while session is still resolving — falls back to "not me". */
  currentUserId: string;
  anonymous: boolean;
  isTopVoted: boolean;
  isNew: boolean;
  readOnly: boolean;
  /** Whether DnD is active for this card. */
  dndEnabled: boolean;
  /** True when this card lives in the Action column (F-23). Hides vote UI. */
  isActionCol?: boolean;
  onVote: (cardId: string) => void;
  onSave: (cardId: string, body: string) => void;
  /** Soft-archive (F-14). Replaces the previous hard `onDelete`; "Delete
   *  forever" lives only in the archive panel and modal sidebar. */
  onArchive: (cardId: string) => void;
  /** Card-level keyboard reorder handlers (Ctrl/Cmd + Arrow). */
  onKeyboardMove?: (
    cardId: string,
    dir: "up" | "down" | "left" | "right",
  ) => void;
  /** Open the card details modal. The originating element is passed so
   *  the modal can restore focus to it on close (F-07 PO #2). */
  onOpenDetails?: (cardId: string, originEl: HTMLElement | null) => void;
  /** Resolve a source card by id for the "From:" back-pointer (F-23). */
  findSourceCard?: (sourceCardId: string) => CardType | undefined;
};

// Visual-only card body — used both inline (via Sortable) and by the DragOverlay
// follower clone. Keep wrapper-free so callers control positioning.
type CardViewProps = {
  card: RetroCard;
  currentUserId: string;
  anonymous: boolean;
  isTopVoted: boolean;
  isNew: boolean;
  readOnly: boolean;
  isDragging?: boolean;
  isFollower?: boolean;
  dndEnabled: boolean;
  /** True when this card lives in the Action column (F-23). Hides vote UI. */
  isActionCol?: boolean;
  onVote: (cardId: string) => void;
  onSave: (cardId: string, body: string) => void;
  onArchive: (cardId: string) => void;
  onKeyboardMove?: (
    cardId: string,
    dir: "up" | "down" | "left" | "right",
  ) => void;
  onOpenDetails?: (cardId: string, originEl: HTMLElement | null) => void;
  /** Resolve a source card by id for the "From:" back-pointer (F-23). */
  findSourceCard?: (sourceCardId: string) => CardType | undefined;
  // dnd-kit attributes/listeners are spread by the wrapper, not here.
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
  style?: React.CSSProperties;
};

export const CardView = forwardRef<HTMLDivElement, CardViewProps>(function CardView(
  {
    card,
    currentUserId,
    anonymous,
    isTopVoted,
    isNew,
    readOnly,
    isDragging,
    isFollower,
    dndEnabled,
    isActionCol,
    onVote,
    onSave,
    onArchive,
    onKeyboardMove,
    onOpenDetails,
    findSourceCard,
    attributes,
    listeners,
    style,
  },
  ref,
) {
  const author = card.author;
  const isMine = !!currentUserId && author.id === currentUserId && !readOnly;
  const voted = !!currentUserId && card.voters.some((v) => v.id === currentUserId);
  const hasDescription = !!card.description && card.description.trim().length > 0;
  const hasActionItems = (card.actionItems?.length ?? 0) > 0;

  // F-23: resolve the source card for Action card back-pointers.
  const sourceCard =
    card.sourceCardId && findSourceCard
      ? findSourceCard(card.sourceCardId)
      : undefined;
  const sourceResolvable = card.sourceCardId !== undefined && sourceCard !== undefined;
  const sourceTruncated =
    sourceCard
      ? sourceCard.body.length > 50
        ? sourceCard.body.slice(0, 50) + "…"
        : sourceCard.body
      : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.body);
  const localRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Hand the merged ref out to dnd-kit while keeping a local ref for menu logic.
  const setRef = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (localRef.current && !localRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const submitEdit = () => {
    const v = draft.trim();
    if (v && v !== card.body) onSave(card.id, v);
    setEditing(false);
  };

  // F-21: 180ms height + opacity collapse before the actual archive runs.
  // We freeze the live offsetHeight onto inline `max-height` first so the
  // transition has a real starting value; without that step the element
  // collapses from `max-height: none` to 0 with no interpolation. Reduced-
  // motion bypasses the wait via a CSS rule that zeros transitions.
  const collapseAndArchive = () => {
    const node = localRef.current;
    if (!node || isFollower) {
      onArchive(card.id);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onArchive(card.id);
      return;
    }
    node.style.maxHeight = node.offsetHeight + "px";
    // Force a layout read so the next frame starts from the captured height.
    void node.offsetHeight;
    requestAnimationFrame(() => {
      node.classList.add("archiving");
      window.setTimeout(() => onArchive(card.id), 180);
    });
  };

  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    if (!onKeyboardMove) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    // Shift+Ctrl/Cmd+Arrow is reserved for column reorder; let it bubble.
    if (e.shiftKey) return;
    let dir: "up" | "down" | "left" | "right" | null = null;
    if (e.key === "ArrowUp") dir = "up";
    else if (e.key === "ArrowDown") dir = "down";
    else if (e.key === "ArrowLeft") dir = "left";
    else if (e.key === "ArrowRight") dir = "right";
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    onKeyboardMove(card.id, dir);
  };

  // Click-to-open the details modal. dnd-kit's 6px activation distance means
  // a real drag suppresses this synthetic click for free; we just need to
  // ignore clicks that originated on the controls inside the card body.
  const onCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpenDetails) return;
    if (editing) return;
    if (isFollower) return;
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest(".kebab-trigger, .kebab-menu, .vote-btn, .card-edit-input")
    ) {
      return;
    }
    onOpenDetails(card.id, localRef.current);
  };

  return (
    <div
      ref={setRef}
      tabIndex={dndEnabled && !editing ? 0 : -1}
      onKeyDown={onCardKeyDown}
      onClick={onCardClick}
      style={style}
      className={
        "card" +
        (isMine ? " mine" : "") +
        (isTopVoted ? " top-voted" : "") +
        (isNew ? " new" : "") +
        (isDragging ? " drag-ghost" : "") +
        (isFollower ? " drag-follower" : "")
      }
      {...(attributes ?? {})}
      {...(listeners ?? {})}
    >
      {isTopVoted && <div className="top-voted-flag">★ top voted</div>}

      {editing ? (
        <textarea
          ref={inputRef}
          className="card-edit-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitEdit();
            }
            if (e.key === "Escape") {
              setDraft(card.body);
              setEditing(false);
            }
          }}
          onBlur={submitEdit}
        />
      ) : (
        // F-21: keyed on `card.body` so a save unmounts the old text node and
        // mounts a fresh one, which re-runs the `body-fade-in` keyframe in CSS.
        <div key={card.body} className="card-body">{card.body}</div>
      )}

      {/* F-23: "From:" back-pointer rendered below body on Action cards. */}
      {card.sourceCardId && (
        sourceResolvable ? (
          <span
            className="action-card-source"
            data-clickable="true"
            title={sourceCard!.body}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onOpenDetails) onOpenDetails(card.sourceCardId!, null);
            }}
          >
            From: {sourceTruncated}
          </span>
        ) : (
          <span className="action-card-source" data-clickable="false">
            From: (original card removed)
          </span>
        )
      )}

      <div className="card-foot">
        {anonymous ? (
          <span className="anon-author">
            <span className="anon-dot">?</span>
            anonymous
          </span>
        ) : (
          <span className="author">
            <Avatar
              user={{
                initials: initialsFromName(author.name),
                color: colorFromName(author.name),
              }}
              size={16}
            />
            <span>{author.name}</span>
          </span>
        )}
        <div className="vote-row">
          {hasDescription && (
            <span
              className="card-desc-indicator"
              aria-label="Has description"
              title="This card has a description"
            >
              <Icon name="description" size={12} />
            </span>
          )}
          {hasActionItems && !isActionCol && (
            <span
              className="card-actions-indicator"
              aria-label="Has action items"
              title="This card has action items"
            >
              <Icon name="actions" size={14} strokeWidth={2} />
            </span>
          )}
          {!isActionCol && (
            <Voters voters={card.voters} anonymous={anonymous} />
          )}
          {!isActionCol && !readOnly && (
            <VoteButton count={card.voters.length} voted={voted} onClick={() => onVote(card.id)} />
          )}
          {!isActionCol && readOnly && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg4)" }}>
              {card.voters.length}▲
            </span>
          )}
        </div>
      </div>

      {isMine && !editing && (
        <>
          <button
            className="kebab-trigger"
            onClick={() => setMenuOpen((o) => !o)}
            onPointerDown={(e) => e.stopPropagation()}
            title="More"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <div className="kebab-menu" onPointerDown={(e) => e.stopPropagation()}>
              <button
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                <Icon name="settings" size={12} /> Edit card
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  collapseAndArchive();
                }}
              >
                <Icon name="inbox" size={12} /> Archive
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export function Card({
  card,
  currentUserId,
  anonymous,
  isTopVoted,
  isNew,
  readOnly,
  dndEnabled,
  isActionCol,
  onVote,
  onSave,
  onArchive,
  onKeyboardMove,
  onOpenDetails,
  findSourceCard,
}: CardProps) {
  const sortable = useSortable({
    id: card.id,
    data: { type: "card", cardId: card.id },
    disabled: !dndEnabled,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <CardView
      ref={setNodeRef}
      card={card}
      currentUserId={currentUserId}
      anonymous={anonymous}
      isTopVoted={isTopVoted}
      isNew={isNew}
      readOnly={readOnly}
      dndEnabled={dndEnabled}
      isDragging={isDragging}
      isActionCol={isActionCol}
      onVote={onVote}
      onSave={onSave}
      onArchive={onArchive}
      onKeyboardMove={onKeyboardMove}
      onOpenDetails={onOpenDetails}
      findSourceCard={findSourceCard}
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown>}
      style={style}
    />
  );
}
