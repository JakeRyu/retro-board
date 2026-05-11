export type User = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type ActionItem = {
  id: string;
  text: string;
  done: boolean;
};

// Minimal user reference embedded on cards so we don't need an out-of-band
// directory to resolve display names for voters / authors. Carries id (the
// stable identity — Entra OID for real users, seed id like "u2" for
// coworkers) plus the display name captured at write time. Names persist
// even if the user's Entra display name changes later; we accept the small
// staleness in exchange for being able to render any vote without a fetch.
export type Voter = { id: string; name: string };

export type Card = {
  id: string;
  body: string;
  author: Voter;
  voters: Voter[];
  description?: string;
  actionItems?: ActionItem[];
  archivedAt?: string;
  /** Column the card was in at archive time. Used by `unarchiveCard` to send
   *  it home; falls back to first column if the column is gone. */
  originColumnId?: string;
  /** Set on Action column cards only — the id of the source card whose action
   *  item text became this card's body. Undefined on all prompt-column cards
   *  and on manually-added Action column cards. */
  sourceCardId?: string;
};

// Back-compat alias — older code paths still import RetroCard.
export type RetroCard = Card;

export type Column = {
  id: string;
  title: string;
  desc: string;
  cards: Card[];
  /** Marker for the system-managed Action column produced by F-23. When set,
   *  the column is locked (non-renameable, non-reorderable) and cards carry
   *  back-pointers to their source cards. All prompt columns have
   *  `kind: undefined`. */
  kind?: "action";
};

export type Board = {
  id: string;
  type: "retro";
  /** F-24: id of the workspace this board belongs to. Required for new boards;
   *  pre-F-24 persisted boards are migrated to DEFAULT_WORKSPACE_ID on hydrate. */
  workspaceId: string;
  title: string;
  theme: string;
  created: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  starred: boolean;
  /** ISO timestamp set when `starred` flips to true; cleared on unstar. Drives
   *  most-recently-starred ordering in the boards-list "Starred" group. */
  starredAt?: string;
  // Stable seeded color used by sidebar swatch and boards-list theme stripe.
  // Not user-editable in v1.
  color: string;
  columns: Column[];
  /** Board-level archive bucket (F-14). Cards leave their column on archive
   *  and live here until unarchived or permanently deleted. Each carries its
   *  own `archivedAt` and `originColumnId`. */
  archivedCards: Card[];
};

// F-24: workspace partition. Two seeded workspaces in v1; UI for creating
// more is out of scope.
export type Workspace = {
  id: string;
  name: string;
};

export const WORKSPACES: Workspace[] = [
  { id: "ws-selene", name: "Selene" },
  { id: "ws-eos", name: "Eos" },
];

export const DEFAULT_WORKSPACE_ID = "ws-selene";

// Fixed palette used to seed Board.color. F-03 will pick from the same set
// (round-robin or hash-of-id) so the palette is the source of truth.
export const BOARD_COLORS = [
  "#5e6ad2", // indigo
  "#7a7fad", // lavender
  "#3b9ee0", // blue
  "#27a644", // green
  "#e08e3b", // amber
  "#bb55cc", // magenta
  "#e05a5a", // red
] as const;

// F-24: deterministic mark color from workspace id. Hash → palette index.
// Stable across sessions; future workspaces get a color without manual config.
export function workspaceColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h * 31) + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % BOARD_COLORS.length;
  return BOARD_COLORS[idx];
}

// Seeded coworkers used by the demo retros' authorIds + voter lists. The
// signed-in Entra user is NOT in this array — they're prepended at render time
// in RetroApp.tsx so their id is the real session.user.id.
export const USERS: User[] = [
  { id: "u2", name: "Maya", initials: "MA", color: "#e08e3b" },
  { id: "u3", name: "Jordan", initials: "JO", color: "#27a644" },
  { id: "u4", name: "Priya", initials: "PR", color: "#bb55cc" },
  { id: "u5", name: "Sam", initials: "SA", color: "#e05a5a" },
  { id: "u6", name: "Wen", initials: "WE", color: "#3b9ee0" },
  { id: "u7", name: "Theo", initials: "TH", color: "#7a7fad" },
];

const SELENE_TIMESTAMP = "2026-04-24T09:00:00.000Z";
const EOS_TIMESTAMP = "2026-04-22T09:00:00.000Z";

// ---------------------------------------------------------------------------
// Selene workspace — Azure Data Factory reporting team
// ---------------------------------------------------------------------------

const SELENE_RICH_COLUMNS: Column[] = [
  {
    id: "c1",
    title: "What went well",
    desc: "Wins worth celebrating — pipelines, reports, people.",
    cards: [
      {
        id: "k1",
        body: "Switching the daily pipeline to incremental refresh cut runtime from 47m to 9m.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }, { id: "u5", name: "Sam" }, { id: "u6", name: "Wen" }],
      },
      {
        id: "k2",
        body: "Power BI dataset refresh failures dropped to zero after we fixed the upstream null-handling.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u4", name: "Priya" }],
      },
      {
        id: "k3",
        body: "Pair-debugging the parameter override on Friday saved at least a half-day.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u4", name: "Priya" }],
      },
      {
        id: "k4",
        body: "Stakeholder demo Wednesday landed — they signed off on the schema change.",
        author: { id: "u5", name: "Sam" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }],
      },
    ],
  },
  {
    id: "c2",
    title: "What didn't",
    desc: "Friction, delays, things that slowed us down.",
    cards: [
      {
        id: "k5",
        body: "ADF deployment from dev to prod still takes ~20 min — too much manual review.",
        author: { id: "u4", name: "Priya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u5", name: "Sam" }, { id: "u6", name: "Wen" }, { id: "u7", name: "Theo" }],
      },
      {
        id: "k6",
        body: "Two reports broke silently because the source column was renamed without notice.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }],
      },
      {
        id: "k7",
        body: "Cost spike on Tuesday — we left a debug pipeline running over lunch.",
        author: { id: "u6", name: "Wen" },
        voters: [{ id: "u3", name: "Jordan" }, { id: "u5", name: "Sam" }],
      },
    ],
  },
  {
    id: "c3",
    title: "Try next time",
    desc: "Concrete experiments for next sprint.",
    cards: [
      {
        id: "k8",
        body: "Add a smoke-test pipeline that runs against prod data after each deploy.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u4", name: "Priya" }, { id: "u5", name: "Sam" }, { id: "u3", name: "Jordan" }],
      },
      {
        id: "k9",
        body: "Slack-bot upstream schema-change announcements so reporting owners get a heads-up.",
        author: { id: "u7", name: "Theo" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u4", name: "Priya" }],
      },
      {
        id: "k10",
        body: "Scheduled budget alert at 80% of monthly cap.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u4", name: "Priya" }],
      },
    ],
  },
  {
    id: "c4",
    title: "Shout-outs",
    desc: "Who deserves a thank-you this sprint?",
    cards: [
      {
        id: "k11",
        body: "Maya unblocked the Synapse linked-service auth on Friday — saved the demo.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }, { id: "u5", name: "Sam" }],
      },
      {
        id: "k12",
        body: "Jordan's runbook for hot-fixing failed pipeline runs is now the team standard.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u2", name: "Maya" }],
      },
    ],
  },
];

export const SEED_BOARD: Board = {
  id: "b-seed-selene-1",
  type: "retro",
  workspaceId: "ws-selene",
  title: "Sprint 24 — Pipeline refresh",
  theme:
    "ADF pipeline rewrite shipped Tuesday. What worked, what slowed us down, what should we try next sprint? Stay specific — talk about behaviors and pipelines, not people.",
  created: "Apr 24",
  state: "open",
  createdAt: SELENE_TIMESTAMP,
  updatedAt: SELENE_TIMESTAMP,
  starred: false,
  color: BOARD_COLORS[0],
  columns: SELENE_RICH_COLUMNS,
  archivedCards: [],
};

const SEED_BOARD_SELENE_CLOSED: Board = {
  id: "b-seed-selene-2",
  type: "retro",
  workspaceId: "ws-selene",
  title: "Sprint 23 — Reporting cutover",
  theme:
    "Cutover to the new reporting model after one week of slip. What did we learn?",
  created: "Apr 10",
  state: "closed",
  createdAt: "2026-04-10T09:00:00.000Z",
  updatedAt: "2026-04-17T17:00:00.000Z",
  starred: false,
  color: BOARD_COLORS[1],
  columns: [],
  archivedCards: [],
};

const SEED_BOARD_SELENE_ARCHIVED: Board = {
  id: "b-seed-selene-3",
  type: "retro",
  workspaceId: "ws-selene",
  title: "Q1 reporting retro",
  theme: "How did the Q1 reporting overhaul land?",
  created: "Mar 30",
  state: "closed",
  createdAt: "2026-03-30T09:00:00.000Z",
  updatedAt: "2026-04-02T11:00:00.000Z",
  archivedAt: "2026-04-04T11:00:00.000Z",
  starred: false,
  color: BOARD_COLORS[3],
  columns: [],
  archivedCards: [],
};

// ---------------------------------------------------------------------------
// Eos workspace — new API project team
// ---------------------------------------------------------------------------

const EOS_RICH_COLUMNS: Column[] = [
  {
    id: "e1",
    title: "What went well",
    desc: "Wins worth celebrating — endpoints, dev flow, people.",
    cards: [
      {
        id: "e-k1",
        body: "OAuth handshake worked first try in staging — credit to Wen's early prototype.",
        author: { id: "u6", name: "Wen" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }, { id: "u5", name: "Sam" }],
      },
      {
        id: "e-k2",
        body: "OpenAPI spec → typed client generation cut frontend integration time in half.",
        author: { id: "u4", name: "Priya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }],
      },
      {
        id: "e-k3",
        body: "Postman collection lives in the repo now; new hires got productive on day 1.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u4", name: "Priya" }],
      },
      {
        id: "e-k4",
        body: "Code review SLA stayed under 4 hours all sprint.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u7", name: "Theo" }],
      },
    ],
  },
  {
    id: "e2",
    title: "What didn't",
    desc: "Friction, churn, things that slowed us down.",
    cards: [
      {
        id: "e-k5",
        body: "Local dev still requires manual port-forwarding to the Redis sidecar — fragile.",
        author: { id: "u7", name: "Theo" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }, { id: "u6", name: "Wen" }],
      },
      {
        id: "e-k6",
        body: "API contract churn — endpoint shape changed twice mid-sprint, frontend rebuilt twice.",
        author: { id: "u4", name: "Priya" },
        voters: [{ id: "u3", name: "Jordan" }, { id: "u5", name: "Sam" }],
      },
      {
        id: "e-k7",
        body: "Three flaky integration tests muted again this sprint.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u6", name: "Wen" }, { id: "u7", name: "Theo" }],
      },
    ],
  },
  {
    id: "e3",
    title: "Try next time",
    desc: "Concrete experiments for next sprint.",
    cards: [
      {
        id: "e-k8",
        body: "Lock the contract before frontend starts — schema PR must merge first.",
        author: { id: "u4", name: "Priya" },
        voters: [{ id: "u3", name: "Jordan" }, { id: "u5", name: "Sam" }, { id: "u2", name: "Maya" }],
      },
      {
        id: "e-k9",
        body: "Fix or delete the muted tests — no more skipping.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u6", name: "Wen" }, { id: "u7", name: "Theo" }],
      },
      {
        id: "e-k10",
        body: "Docker-compose target for the full stack so port-forwarding is one command.",
        author: { id: "u7", name: "Theo" },
        voters: [{ id: "u4", name: "Priya" }, { id: "u2", name: "Maya" }],
      },
    ],
  },
  {
    id: "e4",
    title: "Shout-outs",
    desc: "Who deserves a thank-you this sprint?",
    cards: [
      {
        id: "e-k11",
        body: "Theo's load-test harness caught a connection-pool leak before staging deploy.",
        author: { id: "u2", name: "Maya" },
        voters: [{ id: "u2", name: "Maya" }, { id: "u3", name: "Jordan" }, { id: "u4", name: "Priya" }, { id: "u6", name: "Wen" }],
      },
      {
        id: "e-k12",
        body: "Priya rewrote the auth error responses — much clearer for frontend.",
        author: { id: "u3", name: "Jordan" },
        voters: [{ id: "u4", name: "Priya" }],
      },
    ],
  },
];

const SEED_BOARD_EOS_OPEN: Board = {
  id: "b-seed-eos-1",
  type: "retro",
  workspaceId: "ws-eos",
  title: "Sprint 8 — Auth + first endpoints",
  theme:
    "First two endpoints behind OAuth shipped to staging. What's working, what's slow, what to try next?",
  created: "Apr 22",
  state: "open",
  createdAt: EOS_TIMESTAMP,
  updatedAt: EOS_TIMESTAMP,
  starred: false,
  color: BOARD_COLORS[2],
  columns: EOS_RICH_COLUMNS,
  archivedCards: [],
};

const SEED_BOARD_EOS_CLOSED: Board = {
  id: "b-seed-eos-2",
  type: "retro",
  workspaceId: "ws-eos",
  title: "Sprint 7 — Project kickoff",
  theme: "First sprint after kickoff. What set us up well, what tripped us?",
  created: "Apr 08",
  state: "closed",
  createdAt: "2026-04-08T09:00:00.000Z",
  updatedAt: "2026-04-15T17:00:00.000Z",
  starred: false,
  color: BOARD_COLORS[4],
  columns: [],
  archivedCards: [],
};

export const SEED_BOARDS: Board[] = [
  SEED_BOARD,
  SEED_BOARD_SELENE_CLOSED,
  SEED_BOARD_SELENE_ARCHIVED,
  SEED_BOARD_EOS_OPEN,
  SEED_BOARD_EOS_CLOSED,
];
