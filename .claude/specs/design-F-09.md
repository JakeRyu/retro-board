# F-09 — Action list (repurposed from checklist)

> Replaces the original design-F-09.md (card checklist). The per-card
> checklist is reframed as an action-items list: same structural shell,
> renamed data model, two affordances removed, one discussion-mode signal added.

---

## Goal

Give the retro facilitator a place to capture commitments directly on the
sticky being discussed, so every action item is tied to the observation that
produced it and can flow into the Action column (F-23) at the end of the meeting.

---

## Renames at a glance

| Artifact | Before | After |
|---|---|---|
| Component file | `Checklist.tsx` | `ActionList.tsx` |
| Component export | `Checklist` | `ActionList` |
| Props type | `ChecklistProps` | `ActionListProps` |
| Row sub-type | `ChecklistRowProps` / `ChecklistRowViewProps` | `ActionRowProps` / `ActionRowViewProps` |
| Data type | `ChecklistItem` | `ActionItem` |
| Card field | `Card.checklist?: ChecklistItem[]` | `Card.actionItems?: ActionItem[]` |
| Store mutation | `addChecklistItem` | `addActionItem` |
| Store mutation | `toggleChecklistItem` | `toggleActionItem` |
| Store mutation | `editChecklistItem` | `editActionItem` |
| Store mutation | `deleteChecklistItem` | `deleteActionItem` |
| Store mutation | `reorderChecklist` | (removed — see DnD removal below) |

**Component naming rationale.** "ActionList" is the plural noun that matches
the section heading "Action items" and the field name `actionItems`. It
parallels `Column`, `Card`, `Sidebar` — one word, noun. "ActionItemList" is
accurate but verbose; the shorter form reads cleanly.

---

## Modal section relabel

In `CardDetailsModal.tsx`, the `<section className="cd-checklist">` becomes
`<section className="cd-action-items">`. The `<h3>` heading changes from
`"Checklist"` to `"Action items"`. The `<Checklist>` import and JSX tag become
`<ActionList>`, passing `items={card.actionItems ?? []}`. The section comment
`{/* F-09 slot */}` stays; the description updates to match.

The CSS rule `.cd-description, .cd-checklist { margin-bottom: 18px; }` in
`globals.css` updates the second selector to `.cd-action-items`.

---

## Card preview cleanup

`Card.tsx` currently computes `checklistTotal`, `checklistDone`, `hasChecklist`,
`checklistComplete` from `card.checklist`. These locals and the `X / Y`
progress badge inside `.vote-row` are removed.

**Replaced with a presence-only indicator** (post-design adjustment, 2026-05-01
on user feedback): a small checkmark icon appears in `.vote-row` when the card
has any action items. No count, no progress — just a "this card has actions"
signal so facilitators can scan the board without opening every card. The
indicator mirrors `.card-desc-indicator`:

```jsx
{hasActionItems && (
  <span
    className="card-actions-indicator"
    aria-label="Has action items"
    title="This card has action items"
  >
    <Icon name="actions" size={12} />
  </span>
)}
```

A new `actions` icon (single checkmark glyph, `<path d="M4 12l5 5L20 6" />`) is
added to `Primitives.tsx`. CSS reuses the desc-indicator rule via grouped
selector. Vote-row reads, left to right:

```
[.card-desc-indicator?]  [.card-actions-indicator?]  [.voters]  [VoteButton or vote count]
```

---

## DnD removal (post-design adjustment, 2026-05-01)

User feedback flagged a bug in the per-item drag-reorder. Rather than fix the
bug, the entire drag affordance is removed:

- `DndContext`, `DragOverlay`, `SortableContext`, `useSortable`, sensors, and
  the `<DragOverlay>` follower clone are deleted from `ActionList.tsx`.
- The `dragEnabled` prop chain on `ActionRow`/`ActionRowView` is gone.
- The `.action-item-handle` JSX (six-dot grab handle), its `aria-label="Drag to
  reorder"`, and the `attributes`/`listeners`/`style` spreading are deleted.
- The `reorderActionItems` store mutation is deleted entirely (zero callers).
- The `.action-item-handle`, hover/focus-within reveal rules, and `:active`
  cursor rules are removed from `globals.css`.

Items keep their insertion order; new items append. If reorder is desired
later, redesign with a non-buggy implementation (e.g., explicit "move up" /
"move down" buttons or modal-internal arrow keys).

---

## "Hide completed" removal

The `hideCompleted` local state in `ActionList` (formerly `Checklist`) is
removed. With it go:

- The `useMemo` that filtered `visibleItems` to in-progress only.
- The `dragEnabled = !readOnly && !hideCompleted` guard (simplifies to
  `dragEnabled = !readOnly`).
- The `<div className="checklist-head">` block that rendered the progress
  string and the toggle button.
- The `.checklist-head`, `.checklist-progress`, `.checklist-toggle-hide`,
  and `.checklist-toggle-hide[data-on="true"]` CSS rules.

`visibleItems` collapses to `items` directly; `visibleIds` follows. The
DnD context still wraps the list — reorder is unaffected.

The section now renders three regions: item list (when non-empty) → add
composer (when not read-only). No header row.

---

## Discussion-mode signal

**Chosen affordance: a persistent indigo left-border on the section container
while discussion mode is active.**

When the card modal opens during an active discussion, `CardDetailsModal`
receives (or derives) an `isDiscussion` boolean. When true, the
`.cd-action-items` section element gains an `.discussion-active` modifier
class.

```css
.cd-action-items.discussion-active {
  border-left: 2px solid rgba(94, 106, 210, 0.55);
  padding-left: 10px;          /* compensate so text doesn't shift */
  margin-left: -12px;          /* pull the border flush with the column gutter */
}
```

No animation, no pulse. The border is calm and persistent — it reads as
"this section is live right now." It is the same indigo family as focus
rings and vote buttons elsewhere; no new color token is needed.

**Why this over the alternatives:**
- A badge ("Capture as you discuss") adds words the facilitator has to read
  mid-meeting. The border communicates state without demanding attention.
- A focus pulse on modal open is a one-time signal; the facilitator may open
  the modal long after discussion starts and would miss it.
- A full-section glow is too flashy and clashes with the existing discussion-
  mode column halo.

The `isDiscussion` boolean can be passed as a prop from `RetroApp` via
`CardDetailsModal` (the parent already has discussion-state access). If the
architecture instead prefers a context, that is an implementation detail; the
visual contract is the same.

---

## Microcopy / aria sweep

Strings to change:

- `"Checklist"` (section heading in `CardDetailsModal`) → `"Action items"`
- `"Add an item"` (composer placeholder) → `"Add an action item…"`
- `aria-label="Add a checklist item"` (composer input) → `aria-label="Add an action item"`
- `"Hide completed"` (toggle label, being removed) — delete
- `"Showing in-progress"` (toggle label, being removed) — delete
- `"X / Y complete"` (progress string, being removed with the `.checklist-head` block) — delete
- `aria-label={`${checklistDone} of ${checklistTotal} checklist items complete`}` (card
  indicator, being removed) — delete
- `"Drag to reorder"` — gone with the drag handle (post-design adjustment).
- `"Delete item"` (delete button aria-label in `ActionRowView`) — keep as-is.
- Comment block `// --- Checklist (F-09) ---` in `store.ts` → `// --- Action items (F-09) ---`
- JSX comment `{/* F-09 slot — owned by spec design-F-09.md */}` in `CardDetailsModal` — update
  description to reference "Action items".

---

## CSS classes to rename / remove

**Rename:**

| Before | After |
|---|---|
| `.cd-checklist` | `.cd-action-items` |
| `.checklist` | `.action-list` |
| `.checklist-list` | `.action-list-items` |
| `.checklist-item` | `.action-item` |
| `.checklist-handle` | (removed — DnD gone) |
| `.checklist-checkbox` | `.action-item-checkbox` |
| `.checklist-text` | `.action-item-text` |
| `.checklist-text-input` | `.action-item-text-input` |
| `.checklist-del` | `.action-item-del` |
| `.checklist-add` | `.action-list-add` |
| `.checklist-add-input` | `.action-list-add-input` |

**Remove entirely:**

- `.checklist-head` — gone with the progress/toggle header row.
- `.checklist-progress` — gone with the header row.
- `.checklist-toggle-hide` — gone with the hide-completed toggle.
- `.checklist-toggle-hide:hover` — same.
- `.checklist-toggle-hide[data-on="true"]` — same.
- `.card-checklist-indicator` — gone with the card-preview badge.
- `.card-checklist-indicator.complete` — same.

**Add:**

- `.cd-action-items.discussion-active` — the indigo left-border signal
  (see Discussion-mode signal section above).
- `.card-actions-indicator` — joined to `.card-desc-indicator` via grouped
  selector; same muted color and right-margin (post-design adjustment).

The CSS section comment `/* card checklist (F-09) */` in `globals.css`
becomes `/* action list (F-09) */`.

---

## localStorage migration note

F-09 ships the rename in code only. Freshly created retros (after this
commit) persist `actionItems` on cards. Existing localStorage payloads
carry the old `checklist` key; those cards will have `actionItems: undefined`
until the migration runs.

**The `checklist` → `actionItems` rename in persisted data is deferred to
F-MIGRATE.** That feature bumps `SCHEMA_VERSION` to 2 and runs a migration
function that walks every card and moves `card.checklist` to
`card.actionItems`. F-09 must not add migration logic — doing so would
partially pre-empt F-MIGRATE and create a split-migration hazard where some
users get migrated by F-09 and others by F-MIGRATE depending on deploy timing.

The developer should document this gap in the commit message. Users who
open an existing retro between the F-09 deploy and the F-MIGRATE deploy will
see their action-items section temporarily empty; they can re-enter any items.
This window should be short because F-MIGRATE is the next item in the build
sequence (see backlog §Build sequence step 9).

---

## Out of scope

- Per-item assignment to a team member — deferred to backend integration.
- Per-item due date — deferred to backend integration.
- Multiple action lists per card — explicitly cut from v1.
- F-MIGRATE migration logic — that spec owns the `checklist` → `actionItems`
  data rename in localStorage.
- F-23 (Finish Discussion → Action column) — this spec is only the per-card
  list. F-23 reads from `card.actionItems` and is not designed here.
- Changing item interaction behavior (toggle, edit, reorder, delete) — the
  mechanics are unchanged from the original F-09 checklist; only naming and
  two removed affordances differ.
