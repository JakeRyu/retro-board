# F-25 — Column description editing

> Date: 2026-05-05
> Depends on: nothing (additive)

---

## Goal

Today every column carries a `desc` string but only seed boards have it
populated; user-created boards always show an empty `desc`. There's no UI to
fill or change it. Facilitators of user-created boards lose the per-column
guidance ("Wins worth celebrating", "Friction worth fixing", etc.) that the
seed boards demonstrate.

F-25 closes the gap on both ends:
1. Adds inline editing for `col.desc` so any owner can fill or change it.
2. Seeds new boards' default 4 columns with generic guidance strings, so a
   freshly-created retro starts with the same affordance as a seed board.

---

## Editing affordance

Inline click — no kebab menu entry. This matches the column **title** edit
pattern at [Column.tsx:286-292](app/_components/Column.tsx#L286-L292) (click
the title text → input replaces it) and the card description edit pattern at
[CardDetailsModal.tsx:387-446](app/_components/CardDetailsModal.tsx#L387-L446)
(click body text → textarea, with empty-state "Add a more detailed
description…" placeholder).

Three render branches for the desc area:

1. **Editing** (`editingDesc === true`): single-line `<input>` replaces
   whatever was there, prefilled with the current desc, max length 200.
2. **Filled, not editing** (`col.desc.trim() !== ""`, not editing): existing
   `.col-desc` div renders the text; cursor becomes `text` and clicking it
   enters edit mode (mirroring title click-to-edit). The existing show/hide
   toggle remains.
3. **Empty + editable** (`col.desc.trim() === ""` AND `descEditable`):
   muted placeholder line "Add description…" rendered with the same
   `.col-desc` slot, additional `.empty` modifier class. Clicking enters edit
   mode. No show/hide toggle (nothing to hide).
4. **Empty + read-only**: nothing rendered (same as today's behavior on
   empty desc).

`descEditable = canEdit && !readOnly && !discussion && !isActionCol` — same
exact gate as `titleEditable` at [Column.tsx:148](app/_components/Column.tsx#L148).
This keeps closed boards, archived boards, discussion mode, and the locked
Action column consistent with how title edit is gated.

---

## Save / cancel semantics

Single-line `<input>`, identical key handling to column title edit:

| Key | Behavior |
|---|---|
| `Enter` | commit (trim trailing whitespace, slice to 200, save) |
| `Escape` | cancel (revert draft, exit edit) |
| `blur` | commit (same as Enter) |

Empty value is **allowed** on commit — that's how a user clears a desc back
to the empty placeholder. This matches `setCardDescription` at
[store.ts:368-381](app/_data/store.ts#L368-L381) (which trims and stores
`undefined` on empty), and `setBoardTheme` at [store.ts:291-294](app/_data/store.ts#L291-L294)
which trims trailing whitespace and allows empty.

If the trimmed value equals `col.desc`, the commit is a no-op (skip the
mutation, just exit edit mode) — same shortcut as `commitRename`.

When entering edit mode, if the desc is currently collapsed (descOpen=false),
`descOpen` flips to true so the user sees what they're editing.

---

## Length limit

`maxLength={200}` — 4× the longest seed desc (~52 chars). Caps at "one or two
sentences," consistent with desc being a brief column hint, not free-form
content. Title is 60 chars; card description has no hard cap (it's freeform
prose). Column desc sits between — it's a prompt/hint, so the cap is tight
but not as tight as title.

---

## Action column behavior

Locked. Same rule as title: `isActionCol` excludes the column from
`descEditable`. The Action column currently has `desc: ""` (set by
`buildActionColumn` in [store.ts:534](app/_data/store.ts#L534)) and stays
that way — no placeholder rendered, no edit affordance.

Consistency rationale: Action column is system-managed; allowing
facilitator notes on it is a separate product question. Per-Action-card
descriptions remain available via the card details modal.

---

## Default columns for newly-created boards

`defaultColumns()` in [store.ts:204-211](app/_data/store.ts#L204-L211)
currently returns the 4 columns with `desc: ""`. F-25 changes this to:

```ts
function defaultColumns(): Column[] {
  return [
    { id: "c-went-well", title: "What went well", desc: "Wins worth celebrating.", cards: [] },
    { id: "c-didnt", title: "What didn't", desc: "Friction worth fixing.", cards: [] },
    { id: "c-try", title: "Try next time", desc: "Concrete experiments to try.", cards: [] },
    { id: "c-shout", title: "Shout-outs", desc: "Who deserves a thank-you?", cards: [] },
  ];
}
```

Generic on purpose — seed boards have themed desc that matches the board
title. The defaults can't predict the new board's theme, so they're
intentionally neutral and concise. The user can always edit them via the
new affordance.

This is a one-shot change at board-creation time; existing user boards in
localStorage are not retroactively populated. (Migration would be too
invasive — the user has already had a chance to fill them in.)

`addColumn` in [store.ts:486-501](app/_data/store.ts#L486-L501) continues to
create columns with `desc: ""` — a manually-added column has no implied
guidance, so the empty placeholder is the right starting state.

---

## Store change

New action:

```ts
setColumnDesc(boardId: string, columnId: string, desc: string) {
  const trimmed = desc.replace(/\s+$/, "").slice(0, 200);
  updateBoardById(boardId, (b) => ({
    ...b,
    columns: b.columns.map((c) =>
      c.id === columnId ? { ...c, desc: trimmed } : c,
    ),
  }));
}
```

Trim trailing whitespace (not leading — facilitator may want indent on
first char, though unlikely with a single-line input). Slice as a defense
even though `maxLength` enforces it client-side. Empty string is stored as
empty string, not `undefined` — `Column.desc` is typed `string`, not
`string | undefined`, so we keep that invariant.

No new prop on `Column.tsx`'s callback list — instead, the existing pattern
of "callbacks flow down from RetroApp" applies. `RetroApp.tsx` already wires
`onRenameColumn`, `onRequestDeleteColumn`, etc.; F-25 adds `onSaveColumnDesc`
parallel to those.

---

## RetroApp wiring

```tsx
const onSaveColumnDesc = useCallback(
  (columnId: string, desc: string) => {
    storeActions.setColumnDesc(board.id, columnId, desc);
  },
  [board.id],
);
```

Prop passes through to each `Column` and `ColumnView`.

---

## Component changes

`Column.tsx` gains state and handlers parallel to title:

```tsx
const [editingDesc, setEditingDesc] = useState(false);
const [descDraft, setDescDraft] = useState(col.desc);
const descInputRef = useRef<HTMLInputElement | null>(null);

const descEditable = canEdit && !readOnly && !discussion && !isActionCol;

const beginEditDesc = () => {
  if (!descEditable) return;
  setDescDraft(col.desc);
  setDescOpen(true); // expand if collapsed so the input is visible
  setEditingDesc(true);
};

const commitEditDesc = () => {
  const trimmed = descDraft.replace(/\s+$/, "").slice(0, MAX_DESC);
  if (trimmed !== col.desc) onSaveColumnDesc(col.id, trimmed);
  setEditingDesc(false);
};

const cancelEditDesc = () => {
  setDescDraft(col.desc);
  setEditingDesc(false);
};
```

`MAX_DESC = 200` constant added next to `MAX_TITLE = 60`.

The render block at [Column.tsx:356-361](app/_components/Column.tsx#L356-L361)
becomes:

```tsx
{editingDesc ? (
  <input
    ref={descInputRef}
    className="col-desc-input"
    value={descDraft}
    maxLength={MAX_DESC}
    placeholder="Add description…"
    onChange={(e) => setDescDraft(e.target.value)}
    onPointerDown={(e) => e.stopPropagation()}
    onBlur={commitEditDesc}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEditDesc();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEditDesc();
      }
    }}
  />
) : descOpen && col.desc ? (
  <div
    className="col-desc"
    style={descEditable ? { cursor: "text" } : undefined}
    onClick={descEditable ? beginEditDesc : undefined}
  >
    {col.desc}
  </div>
) : !col.desc && descEditable ? (
  <div
    className="col-desc empty"
    role="button"
    tabIndex={0}
    onClick={beginEditDesc}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        beginEditDesc();
      }
    }}
  >
    Add description…
  </div>
) : null}

{col.desc && !editingDesc && (
  <button className="col-desc-toggle" onClick={() => setDescOpen((o) => !o)}>
    {descOpen ? "hide description" : "show description"}
  </button>
)}
```

Auto-focus on edit-mode entry, mirroring title:

```tsx
useEffect(() => {
  if (editingDesc && descInputRef.current) {
    descInputRef.current.focus();
    descInputRef.current.select();
  }
}, [editingDesc]);
```

`stopPropagation` on `onPointerDown` matches the title input — prevents the
column DnD listener from intercepting clicks inside the field.

---

## CSS

Two additions, both in [globals.css](app/globals.css) near the existing
`.col-desc` block (line ~691):

```css
.col-desc.empty {
  color: var(--fg4);
  font-style: italic;
  cursor: pointer;
}
.col-desc.empty:hover {
  color: var(--fg3);
}

.col-desc-input {
  width: 100%;
  font-size: 11px;
  line-height: 1.5;
  color: var(--fg1);
  background: var(--bg-surface);
  border: 1px solid var(--brand-indigo);
  border-radius: 4px;
  padding: 4px 6px;
  margin: 0 0 8px;
  outline: none;
  font-family: inherit;
}
```

The input intentionally borrows visual weight from `.col-title-input` —
indigo focus border, surface background — to signal "you're editing." Font
size matches `.col-desc` (11px) so the inline transition between view and
edit doesn't shift surrounding layout.

`.col-desc.empty` uses italic + `--fg4` so the placeholder reads as a
prompt, not as content. Hover bumps to `--fg3` to advertise interactivity.

---

## Out of scope

- Multi-line description editing (textarea). Seed desc and the use case
  (column hint) are single-sentence; an input keeps parity with title.
  Revisit if facilitators routinely want paragraphs.
- Markdown rendering inside the desc. Currently `col.desc` is rendered as
  plain text. F-25 keeps it that way.
- Per-column desc presets / templates ("Apply Sprint Health template" etc.).
  Defer to a workspace-level theming feature.
- Migration to populate desc on existing user-created boards in localStorage.
  Pre-F-25 user data stays empty; new affordance lets the owner fill it in
  one click.
- Action column desc editing.

---

## Acceptance checklist

- [ ] Click an existing column desc → input replaces it, focused, contents
      selected.
- [ ] Enter saves; new value appears in the static `.col-desc` div.
- [ ] Esc cancels; original value restored.
- [ ] Blur saves (same as Enter).
- [ ] Empty desc on an editable column shows "Add description…" placeholder
      in muted italic; clicking enters edit mode.
- [ ] Closed/Archived/Discussion-mode boards: desc renders normally if
      filled, but click does not enter edit mode and empty placeholder is
      not shown.
- [ ] Action column shows no desc affordance regardless of fill state.
- [ ] New board created via "Create retro" arrives with the four default
      columns each carrying a generic desc string visible by default.
- [ ] Show/hide toggle continues to work on filled desc; toggle is hidden
      while editing.
- [ ] `maxLength` enforced at 200; trim trailing whitespace on commit;
      identical-value commit is a no-op.
