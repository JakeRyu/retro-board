# F-08 — Card description (in modal)

## 1. Feature recap

The first slot on the card details modal (`.cd-description`, owned by F-07).
Lets the user attach a multi-line description to a card so cards carry the
context, not just the headline. Markdown-light only: line breaks and URLs are
honored; nothing else. Per backlog: no full markdown renderer, no toast on save.

## 2. Surface

Lives inside `.cd-description` in `CardDetailsModal.tsx`. Section heading
(`<h3 class="cd-section-label">Description</h3>`) already in place from F-07;
this spec only fills the body of the section. The card preview on the board
gains a tiny indicator glyph in the existing `.card-foot` row.

## 3. States

| State | Visual |
|---|---|
| Empty (no description, not focused) | Read-mode placeholder text styled like `.cd-placeholder`, copy: `Add a more detailed description…`. Click swaps it for a focused, empty textarea. |
| Read mode (description set) | Plain `<div class="cd-description-render">` with `white-space: pre-wrap` for line breaks and inline `<a>` tags for URLs detected by `/\bhttps?:\/\/\S+/g`. Cursor: text on hover; click switches to edit mode. |
| Edit mode (focused) | `<textarea class="cd-description-input">` autosizes from 4 rows up to ~12 rows then scrolls. Border/glow same as `.card-edit-input`. |
| Saving (blur) | No visible state — write is synchronous via the store, no toast (suppressed; would be too chatty per AC). |
| Read-only (closed board) | Always renders read mode. Click does NOT switch to edit. If empty, render the placeholder with `var(--fg4)` italic, no hover affordance. Selectable text. |

## 4. Interaction spec

- **Trigger to edit**: click on the rendered body or the placeholder. Sets
  local `editing = true`; the textarea autofocuses with the cursor at the end.
- **Save**: textarea `onBlur` calls `storeActions.setCardDescription` with the
  trimmed value (trim trailing whitespace; preserve interior blank lines).
  Then `editing = false`. No toast. `updatedAt` bumps via the existing `touch`
  helper inside the store.
- **Esc**: revert local draft to the saved value, exit edit mode, return focus
  to the card-details modal title input. Esc is consumed locally so the
  modal-level Esc handler does NOT fire (use `e.stopPropagation()`).
- **Cmd/Ctrl+Enter**: save and exit edit mode (matches comment composer
  pattern from F-13). Plain Enter inserts a newline.
- **Tab**: from textarea, moves focus to the next focusable element in the
  modal (the next slot, in DOM order), saving on blur.
- **URL clicks (read mode)**: `<a target="_blank" rel="noopener noreferrer">`,
  styled with `color: var(--brand-violet-hi); text-decoration: underline`.
  Clicking a link must NOT switch to edit mode — `e.stopPropagation()` on the
  anchor's `onClick`.

## 5. Card-preview indicator

When `card.description` is non-empty (after trim), the card on the board
shows a small "lines" glyph in the `.card-foot` row, left of the author
strip / vote-row, with `aria-label="Has description"` and `title="This card
has a description"`. Color `var(--fg4)`, size 12px, no background.

The existing `Icon` primitive in `Primitives.tsx` doesn't ship a description
glyph. Add a new `IconName = "description"` with the path:
`M4 6h16M4 12h12M4 18h8`. (Three offset horizontal rules; reads as "lines of
text" at any size.) Justified addition: this is the canonical Trello/Linear
glyph for the affordance and can be reused by F-09 (checklist preview) and
F-13 (comment count) later as siblings.

## 6. Autosize

A small inline hook inside the component:

- On mount, on every keystroke, and on text injection, set
  `el.style.height = 'auto'` then `el.style.height = el.scrollHeight + 'px'`.
- Cap: compute `maxHeight = lineHeight * 12 + verticalPadding`. Once
  `scrollHeight > maxHeight`, clamp `height = maxHeight` and let
  `overflow-y: auto` take over.
- `lineHeight` resolved via `parseFloat(getComputedStyle(el).lineHeight)`
  with a fallback to `20` if `normal`.

No extra dependency. Hook can be local to the file; if F-13 needs it later
we'll lift it then.

## 7. CSS

Add to `globals.css`:

- `.cd-description-render` — `font-size: 13px; line-height: 1.55; color: var(--fg2); white-space: pre-wrap; word-wrap: break-word; cursor: text; padding: 6px 8px; border-radius: 6px; min-height: 28px;`
- `.cd-description-render:hover` (when editable) — `background: var(--surface-02);`
- `.cd-description-render a` — `color: var(--brand-violet-hi); text-decoration: underline;`
- `.cd-description-render.empty` — `color: var(--fg4); font-style: italic;`
- `.cd-description-input` — clones `.card-edit-input` rules but full-width
  inside the slot, `min-height: 84px`, no `margin-bottom`. Same indigo glow
  on focus.
- `.card-desc-indicator` — `display: inline-flex; align-items: center; color: var(--fg4); margin-right: 4px;`

No new tokens.

## 8. Edge cases

- Whitespace-only input on blur is treated as empty (saved as `undefined`
  via the store action).
- Very long unbroken URL: `word-wrap: break-word` keeps the layout intact.
- Description present + board closes: read-mode view stays; click-to-edit is
  suppressed (see §3 read-only row).
