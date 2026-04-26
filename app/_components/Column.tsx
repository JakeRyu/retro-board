"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "./Card";
import type { Column as ColumnType, User } from "../_data/retro";

export type ColumnProps = {
  col: ColumnType;
  users: User[];
  anonymous: boolean;
  focused: boolean;
  sortByVotes: boolean;
  readOnly: boolean;
  newIds: Set<string>;
  onVote: (cardId: string) => void;
  onAdd: (colId: string, body: string) => void;
  onSaveCard: (cardId: string, body: string) => void;
  onDeleteCard: (cardId: string) => void;
};

export function Column({
  col,
  users,
  anonymous,
  focused,
  sortByVotes,
  readOnly,
  newIds,
  onVote,
  onAdd,
  onSaveCard,
  onDeleteCard,
}: ColumnProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [descOpen, setDescOpen] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus();
  }, [adding]);

  const submit = () => {
    const v = text.trim();
    if (v) onAdd(col.id, v);
    setText("");
    setAdding(false);
  };

  const cards = sortByVotes
    ? [...col.cards].sort((a, b) => b.voters.length - a.voters.length)
    : col.cards;
  const topId = cards.length && cards[0].voters.length > 0 ? cards[0].id : null;

  return (
    <div className={"col" + (focused ? " focused" : "")}>
      <div className="col-head">
        <div className="col-title-wrap">
          <span className="col-title">{col.title}</span>
          <span className="col-count">{col.cards.length}</span>
        </div>
        {!readOnly && (
          <div className="col-actions">
            <button className="col-icon-btn" title="Column settings">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {descOpen && <div className="col-desc">{col.desc}</div>}
      <button className="col-desc-toggle" onClick={() => setDescOpen((o) => !o)}>
        {descOpen ? "hide description" : "show description"}
      </button>

      {!readOnly &&
        (adding ? (
          <>
            <textarea
              ref={inputRef}
              className="add-card-input"
              placeholder="Type your card…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  setText("");
                  setAdding(false);
                }
              }}
            />
            <div className="add-card-actions">
              <button className="btn btn-primary" onClick={submit}>
                Add card
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setText("");
                  setAdding(false);
                }}
              >
                Cancel
              </button>
              <span className="hint">
                <span className="kbd">↵</span> save · <span className="kbd">esc</span> cancel
              </span>
            </div>
          </>
        ) : (
          <button className="add-card-btn" onClick={() => setAdding(true)}>
            <span className="plus">+</span> Add a card
          </button>
        ))}

      <div className="col-cards">
        {cards.map((c) => (
          <Card
            key={c.id}
            card={c}
            users={users}
            anonymous={anonymous}
            isTopVoted={focused && sortByVotes && c.id === topId}
            isNew={newIds.has(c.id)}
            readOnly={readOnly}
            onVote={onVote}
            onSave={onSaveCard}
            onDelete={onDeleteCard}
          />
        ))}
      </div>
    </div>
  );
}
