# F-04 — Board routing + per-board view shell

## 1. Feature recap

Each board gets its own URL at `/boards/[id]` so users can bookmark, share, and use the back button. The existing `RetroApp` surface (topbar, theme bar, columns) becomes the body of that route. `/` is reserved for the future boards list (F-02). Most of F-04 is engineering plumbing — the user-visible design surfaces are: (a) the "board not found" state, (b) the topbar breadcrumb adapting to board type and live title, (c) the brief hydration window before localStorage is read.

## 2. Visual layout

The route shell reuses the existing `.app` two-column grid. The right pane swaps content based on resolution:

```
[sidebar][topbar: crumbs · state-pill · ........ · presence · actions]
        [theme bar (retro only)]
        [board area: columns]
```

When the id resolves to nothing:

```
[sidebar][topbar: crumbs only — "Boards / not found"]
        [empty-state panel, centered, max-width 360px]
```

The empty-state panel reuses the `.modal` visual vocabulary inline (no overlay): same `--bg-surface` card, `--border-standard` border, 12px radius, `--shadow-dialog`. It is not a real modal — just a centered card on the empty board area.

## 3. All states

- **Hydrating** (pre-localStorage read): topbar renders with the in-memory seed board (this is what `useStore` already returns from `getServerSnapshot`). No spinner, no flash. The store re-emits when hydration completes; React swaps the title in place. Acceptable because (a) the hydrate is synchronous read of localStorage on mount, completing in < 1 frame on any normal device, and (b) the seed is the same shape as a real board, so layout is stable.
- **Resolved, open**: full topbar — `<crumb-prefix> / <title input> · <open pill>` plus right-aligned controls.
- **Resolved, closed**: title input disabled, `closed · read-only` pill, right-aligned actions hide per existing `RetroApp` rules.
- **Not found**: empty-state panel (see §4). No theme bar, no board area, no presence, no anon toggle, no Start discussion.
- **Archived (id exists, but `archivedAt` set)**: out of scope for F-04 — flag for F-17. For now, archived boards render as normal "resolved, closed" with the existing pill; the archive surface lives elsewhere.

## 4. Not-found panel

Centered in the board area (which is empty). Single card.

```
   ┌──────────────────────────────────────┐
   │  Board not found.                    │
   │                                      │
   │  This board may have been deleted,   │
   │  or the link is out of date.         │
   │                                      │
   │  [ ← Back to boards ]                │
   └──────────────────────────────────────┘
```

- Title (`h2`, 16px/590, `--fg1`): `Board not found.`
- Body (13px, `--fg2`, line-height 1.5): `This board may have been deleted, or the link is out of date.`
- Primary CTA: `.btn .btn-primary`, label `Back to boards`, leading `arrow` icon mirrored (or just plain text — see open question Q1). Clicking navigates to `/`.
- Spacing: 22px padding (matches `.modal`). Width 360px max, 92vw.
- Topbar in this state: crumb shows `Boards / not found` with `not found` in `--fg4` italic.

Reuse class: `.modal` (without the `.modal-overlay` wrapper). To position it cleanly, wrap in a flex container that fills the board area and centers. Recommended new class `.board-empty` on that wrapper:

```css
.board-empty {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 40px 18px;
}
```

(Justification: the existing `.board-area` is `display:flex` with `align-items:flex-start` and a horizontal scroll — wrong axis for centering. A dedicated wrapper is one rule and reuses `.modal` for the card itself.)

## 5. Topbar breadcrumb

Currently hardcoded as `Retros / <title>`. After F-04 it must:

- Read the loaded board's `type` and choose the prefix:
  - `type === "retro"` → `Retros`
  - `type === "kanban"` → `Boards`
- The prefix is a clickable link to `/` (boards list lands in F-02; for now the link still routes to `/`, which falls back to the boards list once that ships, or shows the seed board on `/` in the interim — this is fine for F-04 because both routes will exist by the time any user follows the crumb).
- The title input continues to inline-edit; `storeActions.setBoardTitle` already triggers a re-render, so the breadcrumb updates live as the user types.
- Long titles: the existing `.board-title-input` already has `max-width: 360px` + `text-overflow: ellipsis`. Crumbs container has `min-width: 0` so the row reflows correctly. No new rules.

Markup change (illustrative — Developer territory):

```tsx
<div className="crumbs">
  <a href="/" className="crumb-link">
    {board.type === "retro" ? "Retros" : "Boards"}
  </a>
  <span className="crumb-sep">/</span>
  <input className="board-title-input" ... />
  <span className={"state-pill " + (closed ? "closed" : "open")}>...</span>
</div>
```

New token: `.crumb-link` — same color/weight as the existing prefix span, but with a hover affordance:

```css
.crumb-link {
  color: var(--fg3);
  text-decoration: none;
  border-radius: 3px;
  padding: 1px 4px;
  margin: -1px -4px; /* zero out visible offset */
  transition: background 120ms, color 120ms;
}
.crumb-link:hover { color: var(--fg1); background: var(--surface-04); }
.crumb-link:focus-visible { outline: 1px solid var(--brand-indigo); outline-offset: 1px; }
```

## 6. Loading state

Spec is: render normally, do nothing visible.

- `useStore` already guarantees a same-shape snapshot on first paint via `getServerSnapshot` returning the in-memory seed. The user sees a fully-laid-out board for whichever id matches the seed (or the not-found panel if it doesn't). On hydrate, the snapshot updates and React reconciles in place.
- No spinner, no skeleton. A skeleton would flash for one frame and add noise.
- If hydrate ever becomes async (backend swap, F-21+), revisit and add a 240ms-delayed skeleton — but not now.

## 7. Interaction spec

| Trigger | Result |
|---|---|
| Click crumb prefix (`Retros` / `Boards`) | Navigate to `/` |
| Tab / Shift+Tab through topbar | Order: crumb prefix → title input → anon toggle → Start discussion → Close board |
| Click `Back to boards` on not-found | Navigate to `/` |
| Browser back from board → list | Native; no custom handling needed |
| `Esc` on not-found panel | No-op (it's not a modal). Keyboard focus stays where it was. |

Microcopy: see §4. No HANDOVER §4.6 entry covers not-found; copy is new but in-voice (terse, no exclamation, lowercase second sentence trailing).

## 8. Animations

- Crumb prefix hover: 120ms background fade (matches existing `.btn-toolbar` etc.).
- Not-found panel entrance: none. Reusing `.modal`'s 150ms transform/opacity is tempting but it's an empty-state, not a dialog — appearing without animation is correct.
- Hydration swap: no animation. Title text changes in place; React's reconciliation handles it. Forcing a fade on every mount would add perceived latency.

## 9. Edge cases

- **Id collision after delete**: user has board open; another tab deletes it. Out of scope (no realtime in v1; localStorage is single-tab in practice). Flag for F-22 / backend.
- **Stale tab after rename**: title changes are pushed via the store immediately in the same tab; cross-tab is a v2 concern.
- **`/boards/[id]` with empty string or whitespace id**: route shouldn't match; Next routing returns 404. If it does match (trailing-slash quirks), our component should treat blank as not-found.
- **User edits title to all-spaces**: out of scope here — F-05 covers title validation. F-04 just renders whatever the store returns.
- **Long board title in narrow viewport**: existing `text-overflow: ellipsis` handles it. The crumb row never wraps.

## 10. CSS tokens used / introduced

Reused: `.modal`, `.btn .btn-primary`, `.crumbs`, `.crumb-sep`, `.board-title-input`, `.state-pill`, `--fg1/2/3/4`, `--surface-04`, `--brand-indigo`.

New (small additions):
- `.crumb-link` — see §5. Justified: the existing prefix is a span; making it a link needs a hover affordance distinct from the title input's hover.
- `.board-empty` — see §4. Justified: `.board-area`'s flex axis is wrong for centering an empty state.

No new CSS custom properties. No new colors.

## 11. Open questions for PO

1. **Back-arrow icon on the not-found CTA**: `arrow` icon is right-pointing in the existing set. Add a left-pointing variant, mirror with CSS, or drop the icon and use plain text? Recommendation: drop the icon — the button label is unambiguous and the icon set stays lean.
2. **`/boards/[id]` with an archived board**: render the board read-only as today, or redirect to a future archive view? Recommendation: render normally for v1; revisit with F-17.
3. **Crumb prefix for a board that's been renamed to something incongruous (e.g. a kanban board titled "Q2 retro")**: the prefix follows `type`, not title — confirmed correct? Yes from the spec, but flagging because users may find it odd.
