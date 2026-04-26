"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Icon } from "./Primitives";
import type { RetroCard, User } from "../_data/retro";

type VotersProps = {
  voterIds: string[];
  users: User[];
  anonymous: boolean;
};

function Voters({ voterIds, users, anonymous }: VotersProps) {
  const max = 4;
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
              style={{ background: "var(--surface-08)", color: "var(--fg3)", fontSize: 8 }}
            >
              ?
            </span>
          );
        }
        return <Avatar key={id + i} user={u} size={16} />;
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
      title={voted ? "Click to remove your vote." : "Vote on this card"}
    >
      <span className="arr">▲</span>
      <span>{count}</span>
    </button>
  );
}

export type CardProps = {
  card: RetroCard;
  users: User[];
  anonymous: boolean;
  isTopVoted: boolean;
  isNew: boolean;
  readOnly: boolean;
  onVote: (cardId: string) => void;
  onSave: (cardId: string, body: string) => void;
  onDelete: (cardId: string) => void;
};

export function Card({
  card,
  users,
  anonymous,
  isTopVoted,
  isNew,
  readOnly,
  onVote,
  onSave,
  onDelete,
}: CardProps) {
  const author = users.find((u) => u.id === card.authorId);
  const isMine = card.authorId === "me" && !readOnly;
  const voted = card.voters.includes("me");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.body);
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
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

  return (
    <div
      ref={ref}
      className={
        "card" +
        (isMine ? " mine" : "") +
        (isTopVoted ? " top-voted" : "") +
        (isNew ? " new" : "")
      }
    >
      {isTopVoted && <div className="top-voted-flag">★ top voted</div>}

      {editing ? (
        <textarea
          ref={inputRef}
          className="card-edit-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
        <div className="card-body">{card.body}</div>
      )}

      <div className="card-foot">
        {anonymous ? (
          <span className="anon-author">
            <span className="anon-dot">?</span>
            anonymous
          </span>
        ) : author ? (
          <span className="author">
            <Avatar user={author} size={16} />
            <span>
              {author.name}
              {isMine ? " · you" : ""}
            </span>
          </span>
        ) : null}
        <div className="vote-row">
          <Voters voterIds={card.voters} users={users} anonymous={anonymous} />
          {!readOnly && (
            <VoteButton count={card.voters.length} voted={voted} onClick={() => onVote(card.id)} />
          )}
          {readOnly && (
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
            title="More"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <div className="kebab-menu">
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
                className="menu-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(card.id);
                }}
              >
                <Icon name="close" size={12} /> Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
