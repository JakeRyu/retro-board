"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Avatar, Icon } from "./Primitives";
import type { Comment, User } from "../_data/retro";
import { storeActions } from "../_data/store";
import { formatRelativeTime } from "../_lib/relativeTime";

const URL_REGEX = /\bhttps?:\/\/\S+/g;

type CommentsProps = {
  boardId: string;
  cardId: string;
  comments: Comment[];
  users: User[];
  readOnly: boolean;
};

export function Comments({
  boardId,
  cardId,
  comments,
  users,
  readOnly,
}: CommentsProps) {
  // Newest-on-top — composer-then-list per design-F-13.md §2. The store
  // stores in insertion order so we reverse a shallow copy here.
  const ordered = useMemo(() => comments.slice().reverse(), [comments]);
  const me = users.find((u) => u.id === "me");

  return (
    <div className="comments">
      {!readOnly && me && (
        <CommentComposer
          boardId={boardId}
          cardId={cardId}
          me={me}
        />
      )}

      {ordered.length > 0 ? (
        <ul className="comment-list">
          {ordered.map((c) => (
            <CommentRow
              key={c.id}
              boardId={boardId}
              cardId={cardId}
              comment={c}
              users={users}
              readOnly={readOnly}
            />
          ))}
        </ul>
      ) : readOnly ? (
        <p className="cd-placeholder">No comments.</p>
      ) : null}
    </div>
  );
}

// --- Composer ----------------------------------------------------------------

type CommentComposerProps = {
  boardId: string;
  cardId: string;
  me: User;
};

function CommentComposer({ boardId, cardId, me }: CommentComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Autosize: 2 → 8 rows, then scroll. Mirrors the description autosize idiom
  // but with its own min height per design-F-13.md §3.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const parsedLine = parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLine) ? parsedLine : 20;
    const padding =
      parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const maxHeight = lineHeight * 8 + padding;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    storeActions.addComment(boardId, cardId, v);
    setDraft("");
  };

  const canSubmit = draft.trim().length > 0;

  return (
    <div className="comment-composer">
      <Avatar user={me} size={22} />
      <div className="comment-composer-body">
        <textarea
          ref={textareaRef}
          className="comment-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
              return;
            }
            if (e.key === "Escape" && draft.length > 0) {
              // Only swallow Esc when there's a draft to clear; otherwise let
              // it bubble to the modal-level Esc handler.
              e.stopPropagation();
              e.preventDefault();
              setDraft("");
            }
          }}
          placeholder="Write a comment…"
          rows={2}
          aria-label="Write a comment"
        />
        <div className="comment-composer-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={!canSubmit}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Row ---------------------------------------------------------------------

type CommentRowProps = {
  boardId: string;
  cardId: string;
  comment: Comment;
  users: User[];
  readOnly: boolean;
};

function CommentRow({
  boardId,
  cardId,
  comment,
  users,
  readOnly,
}: CommentRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const rowRef = useRef<HTMLLIElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const author = users.find((u) => u.id === comment.authorId);
  const isMine = comment.authorId === "me" && !readOnly;
  const showActions = isMine && !editing;

  // Sync draft when the underlying body changes (e.g. another tab edits while
  // this row was idle).
  useEffect(() => {
    if (!editing) setDraft(comment.body);
  }, [comment.body, editing]);

  // Close the kebab on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // Autosize for the edit textarea — same idiom as composer.
  useLayoutEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    const computed = window.getComputedStyle(el);
    const parsedLine = parseFloat(computed.lineHeight);
    const lineHeight = Number.isFinite(parsedLine) ? parsedLine : 20;
    const padding =
      parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const maxHeight = lineHeight * 8 + padding;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft, editing]);

  const startEdit = () => {
    setMenuOpen(false);
    setDraft(comment.body);
    setEditing(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  };

  const commitEdit = () => {
    const v = draft.trim();
    if (!v || v === comment.body) {
      setDraft(comment.body);
      setEditing(false);
      return;
    }
    storeActions.editComment(boardId, cardId, comment.id, v);
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(comment.body);
    setEditing(false);
  };

  const startConfirmDelete = () => {
    setMenuOpen(false);
    setConfirmingDelete(true);
  };

  const performDelete = () => {
    storeActions.deleteComment(boardId, cardId, comment.id);
    // Component unmounts as the comment leaves the list; no further state work.
  };

  return (
    <li className="comment-row" ref={rowRef}>
      {author ? (
        <Avatar user={author} size={22} />
      ) : (
        <span
          className="avatar"
          style={{
            width: 22,
            height: 22,
            background: "var(--surface-08)",
            color: "var(--fg3)",
            fontSize: 10,
          }}
        >
          ?
        </span>
      )}
      <div className="comment-content">
        <div className="comment-head">
          <span className="comment-author">
            {author ? author.name : comment.authorId}
          </span>
          <span className="comment-time">
            · {formatRelativeTime(comment.createdAt)}
            {comment.updatedAt && (
              <span className="comment-edited"> · edited</span>
            )}
          </span>
        </div>

        {editing ? (
          <>
            <textarea
              ref={textareaRef}
              className="comment-edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitEdit();
                  return;
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              rows={2}
              aria-label="Edit comment"
            />
            <div className="comment-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={cancelEdit}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={commitEdit}
                disabled={draft.trim().length === 0}
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <div className="comment-body">{renderCommentBody(comment.body)}</div>
        )}

        {confirmingDelete && (
          <div
            className="comment-confirm-delete"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                e.preventDefault();
                setConfirmingDelete(false);
              }
            }}
          >
            <span>Delete this comment?</span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={performDelete}
            >
              Yes
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {showActions && !confirmingDelete && (
        <>
          <button
            type="button"
            className="kebab-trigger comment-kebab"
            onClick={() => setMenuOpen((o) => !o)}
            title="More"
            aria-label="Comment actions"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <div className="kebab-menu comment-kebab-menu">
              <button className="menu-item" onClick={startEdit}>
                <Icon name="settings" size={12} /> Edit
              </button>
              <button
                className="menu-item danger"
                onClick={startConfirmDelete}
              >
                <Icon name="close" size={12} /> Delete
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

// Render a comment body with line breaks preserved (`white-space: pre-wrap`
// on the wrapper) and any URLs auto-linked. Mirrors F-08's renderer; kept
// local so this component has no shared util to drag.
function renderCommentBody(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) {
      parts.push(
        <Fragment key={lastIndex}>{text.slice(lastIndex, start)}</Fragment>,
      );
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
