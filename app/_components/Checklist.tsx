"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "./Primitives";
import type { ChecklistItem } from "../_data/retro";
import { storeActions } from "../_data/store";

type ChecklistProps = {
  boardId: string;
  cardId: string;
  items: ChecklistItem[];
  readOnly: boolean;
};

export function Checklist({ boardId, cardId, items, readOnly }: ChecklistProps) {
  // Per-modal-session state — resets when this component unmounts (modal close).
  const [hideCompleted, setHideCompleted] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const completed = items.filter((i) => i.done).length;
  const total = items.length;

  // Drag is disabled when "Hide completed" is on (filtered list breaks index
  // math — see design-F-09.md §10.1). Sensors still mounted so the toggle can
  // be flipped without remounting the DndContext.
  const dragEnabled = !readOnly && !hideCompleted;

  const visibleItems = useMemo(
    () => (hideCompleted ? items.filter((i) => !i.done) : items),
    [items, hideCompleted],
  );
  const visibleIds = useMemo(() => visibleItems.map((i) => i.id), [visibleItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    if (!e.over || e.active.id === e.over.id) return;
    // Translate visible-list ids into canonical-list indices. Drag is gated
    // on `!hideCompleted` so visible == canonical, but we still resolve via
    // ids to stay robust.
    const fromIdx = items.findIndex((i) => i.id === String(e.active.id));
    const toIdx = items.findIndex((i) => i.id === String(e.over!.id));
    if (fromIdx < 0 || toIdx < 0) return;
    storeActions.reorderChecklist(boardId, cardId, fromIdx, toIdx);
  };

  const onDragCancel = () => setActiveDragId(null);

  const onSubmitDraft = () => {
    const v = draft.trim();
    if (!v) return;
    storeActions.addChecklistItem(boardId, cardId, v);
    setDraft("");
  };

  const activeItem = activeDragId
    ? items.find((i) => i.id === activeDragId)
    : undefined;

  return (
    <div className="checklist">
      {(total > 0 || !readOnly) && (
        <div className="checklist-head">
          <span className="checklist-progress">
            {completed} / {total} complete
          </span>
          {!readOnly && completed > 0 && (
            <button
              type="button"
              className="checklist-toggle-hide"
              data-on={hideCompleted}
              onClick={() => setHideCompleted((v) => !v)}
              aria-pressed={hideCompleted}
            >
              <span>{hideCompleted ? "Showing in-progress" : "Hide completed"}</span>
            </button>
          )}
        </div>
      )}

      {visibleItems.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext
            items={visibleIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="checklist-list">
              {visibleItems.map((item) => (
                <ChecklistRow
                  key={item.id}
                  boardId={boardId}
                  cardId={cardId}
                  item={item}
                  readOnly={readOnly}
                  dragEnabled={dragEnabled}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <ChecklistRowView
                item={activeItem}
                readOnly={readOnly}
                dragEnabled={false}
                isFollower
                editing={false}
                onStartEdit={() => {}}
                onCommitEdit={() => {}}
                onCancelEdit={() => {}}
                draft={activeItem.text}
                onDraftChange={() => {}}
                onToggle={() => {}}
                onDelete={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {!readOnly && (
        <div className="checklist-add">
          <input
            type="text"
            className="checklist-add-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmitDraft();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                setDraft("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Add an item"
            aria-label="Add a checklist item"
          />
        </div>
      )}
    </div>
  );
}

// --- Row ---------------------------------------------------------------------

type ChecklistRowProps = {
  boardId: string;
  cardId: string;
  item: ChecklistItem;
  readOnly: boolean;
  dragEnabled: boolean;
};

function ChecklistRow({
  boardId,
  cardId,
  item,
  readOnly,
  dragEnabled,
}: ChecklistRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  // Disable drag while this row is being edited so pointerdown lands on the
  // input rather than starting a drag.
  const sortable = useSortable({
    id: item.id,
    disabled: !dragEnabled || editing,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    sortable;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  // Sync local draft when the item text changes underneath us.
  useEffect(() => {
    if (!editing) setDraft(item.text);
  }, [item.text, editing]);

  const startEdit = () => {
    if (readOnly) return;
    setDraft(item.text);
    setEditing(true);
  };

  const commitEdit = () => {
    const v = draft.trim();
    // Empty after trim: revert silently. Explicit deletion is the trash.
    if (!v) {
      setDraft(item.text);
      setEditing(false);
      return;
    }
    if (v !== item.text) {
      storeActions.editChecklistItem(boardId, cardId, item.id, v);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(item.text);
    setEditing(false);
  };

  return (
    <ChecklistRowView
      ref={setNodeRef}
      item={item}
      readOnly={readOnly}
      dragEnabled={dragEnabled}
      isDragging={isDragging}
      editing={editing}
      draft={draft}
      onDraftChange={setDraft}
      onStartEdit={startEdit}
      onCommitEdit={commitEdit}
      onCancelEdit={cancelEdit}
      onToggle={() =>
        storeActions.toggleChecklistItem(boardId, cardId, item.id)
      }
      onDelete={() =>
        storeActions.deleteChecklistItem(boardId, cardId, item.id)
      }
      attributes={attributes as unknown as Record<string, unknown>}
      listeners={listeners as unknown as Record<string, unknown>}
      style={style}
    />
  );
}

// Visual-only row, used both inline (via Sortable) and by the DragOverlay clone.
type ChecklistRowViewProps = {
  item: ChecklistItem;
  readOnly: boolean;
  dragEnabled: boolean;
  isDragging?: boolean;
  isFollower?: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  attributes?: Record<string, unknown>;
  listeners?: Record<string, unknown>;
  style?: React.CSSProperties;
};

const ChecklistRowView = forwardRef<HTMLDivElement, ChecklistRowViewProps>(
  function ChecklistRowView(
    {
      item,
      readOnly,
      dragEnabled,
      isFollower,
      editing,
      draft,
      onDraftChange,
      onStartEdit,
      onCommitEdit,
      onCancelEdit,
      onToggle,
      onDelete,
      attributes,
      listeners,
      style,
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      }
    }, [editing]);

    const onRowKeyDown = (e: React.KeyboardEvent) => {
      if (editing) return;
      if (readOnly) return;
      if (e.key === "Backspace" || e.key === "Delete") {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName === "INPUT") return;
        e.preventDefault();
        onDelete();
      }
    };

    return (
      <div
        ref={ref}
        style={style}
        className={
          "checklist-item" +
          (item.done ? " done" : "") +
          (isFollower ? " drag-follower" : "")
        }
        onKeyDown={onRowKeyDown}
      >
        {dragEnabled && !readOnly && (
          <span
            className="checklist-handle"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            {...(attributes ?? {})}
            {...(listeners ?? {})}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="3" cy="2" r="1" />
              <circle cx="7" cy="2" r="1" />
              <circle cx="3" cy="5" r="1" />
              <circle cx="7" cy="5" r="1" />
              <circle cx="3" cy="8" r="1" />
              <circle cx="7" cy="8" r="1" />
            </svg>
          </span>
        )}

        <input
          type="checkbox"
          className="checklist-checkbox"
          checked={item.done}
          onChange={onToggle}
          disabled={readOnly}
          aria-label={item.text}
        />

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            className="checklist-text-input"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitEdit();
              } else if (e.key === "Escape") {
                e.stopPropagation();
                e.preventDefault();
                onCancelEdit();
              }
            }}
          />
        ) : (
          <span
            className={"checklist-text" + (item.done ? " done" : "")}
            role={readOnly ? undefined : "button"}
            tabIndex={readOnly ? -1 : 0}
            onClick={readOnly ? undefined : onStartEdit}
            onKeyDown={(e) => {
              if (readOnly) return;
              if (e.key === "Enter") {
                e.preventDefault();
                onStartEdit();
              }
            }}
          >
            {item.text}
          </span>
        )}

        {!readOnly && !editing && (
          <button
            type="button"
            className="checklist-del"
            onClick={onDelete}
            aria-label="Delete item"
            title="Delete"
          >
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
    );
  },
);
