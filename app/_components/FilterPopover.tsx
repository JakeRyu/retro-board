"use client";

import { useEffect, useRef } from "react";
import { Avatar, Icon } from "./Primitives";
import type { Label, User } from "../_data/retro";
import {
  activeFilterDimensionCount,
  isFilterActive,
  type BoardFilter,
  type FilterDueStatus,
} from "../_lib/cardMatchesFilter";

type FilterPopoverProps = {
  open: boolean;
  filter: BoardFilter;
  labels: Label[];
  users: User[];
  onToggleOpen: () => void;
  onChange: (next: BoardFilter) => void;
  onClose: () => void;
  onClearAll: () => void;
};

const DUE_OPTIONS: Array<{ value: FilterDueStatus; label: string }> = [
  { value: "none", label: "Any" },
  { value: "overdue", label: "Overdue" },
  { value: "thisWeek", label: "Due this week" },
  { value: "completed", label: "Completed" },
];

export function FilterPopover({
  open,
  filter,
  labels,
  users,
  onToggleOpen,
  onChange,
  onClose,
  onClearAll,
}: FilterPopoverProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const active = isFilterActive(filter);
  const badgeCount = activeFilterDimensionCount(filter);

  // Autofocus the text input when the popover opens. Defer one frame so the
  // node is mounted and focusable.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      textInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Outside-click + Esc close. Anchored to wrapRef so a click on the button
  // itself doesn't double-fire (the button's own onClick handles toggle).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        type="button"
        className="filter-btn"
        data-active={active}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <Icon name="filter" size={12} />
        <span>Filter</span>
        {badgeCount > 0 && (
          <span className="filter-btn-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="filter-popover"
          role="dialog"
          aria-label="Filter cards"
        >
          {/* Text */}
          <div className="filter-section">
            <input
              ref={textInputRef}
              type="search"
              className="filter-text-input"
              placeholder="Search cards…"
              value={filter.text}
              onChange={(e) => onChange({ ...filter, text: e.target.value })}
            />
          </div>

          {/* Labels (hidden when board has none) */}
          {labels.length > 0 && (
            <div className="filter-section">
              <div className="filter-section-label">Labels</div>
              <div className="filter-list">
                {labels.map((label) => {
                  const checked = filter.labelIds.includes(label.id);
                  const display = label.name.trim();
                  return (
                    <label key={label.id} className="filter-list-row">
                      <input
                        type="checkbox"
                        className="label-checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange({
                            ...filter,
                            labelIds: toggleId(filter.labelIds, label.id),
                          })
                        }
                      />
                      <span
                        className="swatch"
                        style={{ background: label.color }}
                      />
                      <span
                        className={"filter-row-name" + (display ? "" : " empty")}
                      >
                        {display || "Untitled"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Members */}
          <div className="filter-section">
            <div className="filter-section-label">Members</div>
            <div className="filter-list">
              {users.map((u) => {
                const checked = filter.memberIds.includes(u.id);
                return (
                  <label key={u.id} className="filter-list-row">
                    <input
                      type="checkbox"
                      className="label-checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange({
                          ...filter,
                          memberIds: toggleId(filter.memberIds, u.id),
                        })
                      }
                    />
                    <Avatar user={u} size={18} />
                    <span className="filter-row-name">{u.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Due date */}
          <div className="filter-section">
            <div className="filter-section-label">Due date</div>
            <div className="filter-due-options">
              {DUE_OPTIONS.map((opt) => (
                <label key={opt.value}>
                  <input
                    type="radio"
                    name="filter-due-status"
                    checked={filter.dueStatus === opt.value}
                    onChange={() =>
                      onChange({ ...filter, dueStatus: opt.value })
                    }
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Hide non-matching */}
          <div className="filter-section">
            <label className="filter-list-row">
              <input
                type="checkbox"
                className="label-checkbox"
                checked={filter.hideNonMatching}
                onChange={() =>
                  onChange({
                    ...filter,
                    hideNonMatching: !filter.hideNonMatching,
                  })
                }
              />
              <span className="filter-row-name">Hide non-matching</span>
            </label>
          </div>

          {/* Clear all */}
          <div className="filter-actions">
            <button
              type="button"
              className="btn btn-subtle"
              onClick={onClearAll}
              disabled={!active && !filter.hideNonMatching}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
