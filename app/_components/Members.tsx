"use client";

import { Avatar } from "./Primitives";
import type { User } from "../_data/retro";
import { storeActions } from "../_data/store";

const MAX_VISIBLE_ASSIGNEES = 3;

// ---------------------------------------------------------------------------
// AssigneeAvatars — card preview pile, bottom-right of .card
// ---------------------------------------------------------------------------

type AssigneeAvatarsProps = {
  users: User[];
  assigneeIds: string[] | undefined;
  anonymous: boolean;
};

export function AssigneeAvatars({
  users,
  assigneeIds,
  anonymous,
}: AssigneeAvatarsProps) {
  if (!assigneeIds || assigneeIds.length === 0) return null;
  // Resolve in card.assigneeIds order; silently drop any ids that no longer
  // map to a known user (e.g. user removed from USERS in a future migration).
  const resolved = assigneeIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));
  if (resolved.length === 0) return null;
  const visible = resolved.slice(0, MAX_VISIBLE_ASSIGNEES);
  const overflow = resolved.length - visible.length;
  return (
    <div className="assignees" aria-label="Assignees">
      {visible.map((u, i) =>
        anonymous ? (
          // Mirrors the anonymous voter mask in Card.tsx / CardDetailsModal.tsx.
          <span
            key={u.id + i}
            className="avatar assignee-avatar"
            style={{
              background: "var(--surface-08)",
              color: "var(--fg3)",
              fontSize: 9,
            }}
          >
            ?
          </span>
        ) : (
          <Avatar
            key={u.id + i}
            user={u}
            size={18}
            style={{ borderWidth: 1.5 }}
          />
        ),
      )}
      {overflow > 0 && <span className="assignees-more">+{overflow}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberPicker — slotted into .cd-side-members in CardDetailsModal
// ---------------------------------------------------------------------------

type MemberPickerProps = {
  boardId: string;
  cardId: string;
  users: User[];
  assigneeIds: string[];
  readOnly: boolean;
};

export function MemberPicker({
  boardId,
  cardId,
  users,
  assigneeIds,
  readOnly,
}: MemberPickerProps) {
  const onToggle = (userId: string) => {
    if (readOnly) return;
    storeActions.toggleCardAssignee(boardId, cardId, userId);
  };

  return (
    <div className="member-picker">
      {users.map((u) => {
        const checked = assigneeIds.includes(u.id);
        return (
          // Names ARE visible in the picker even when board.anonymous is on.
          // Assigning a card is a deliberate act; anonymous mode hides
          // attribution on the board, not the team roster. Documented in
          // design-F-12.md §4.
          <label key={u.id} className="member-row">
            <input
              type="checkbox"
              className="member-checkbox label-checkbox"
              checked={checked}
              disabled={readOnly}
              onChange={() => onToggle(u.id)}
              aria-label={`Toggle ${u.name}`}
            />
            <Avatar user={u} size={20} />
            <span className="member-name">{u.name}</span>
          </label>
        );
      })}
    </div>
  );
}
