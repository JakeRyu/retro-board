export type User = {
  id: string;
  name: string;
  initials: string;
  color: string;
};

export type BoardType = "kanban" | "retro";

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Comment = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Label = {
  id: string;
  name: string;
  color: string;
};

export type Card = {
  id: string;
  body: string;
  authorId: string;
  voters: string[];
  description?: string;
  comments?: Comment[];
  checklist?: ChecklistItem[];
  dueDate?: string;
  labels?: string[];
  assigneeIds?: string[];
  archivedAt?: string;
};

// Back-compat alias — older code paths still import RetroCard.
export type RetroCard = Card;

export type Column = {
  id: string;
  title: string;
  desc: string;
  cards: Card[];
};

export type Board = {
  id: string;
  type: BoardType;
  title: string;
  theme: string;
  created: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  starred: boolean;
  columns: Column[];
};

export const USERS: User[] = [
  { id: "me", name: "You", initials: "YO", color: "#5e6ad2" },
  { id: "u2", name: "Maya", initials: "MA", color: "#e08e3b" },
  { id: "u3", name: "Jordan", initials: "JO", color: "#27a644" },
  { id: "u4", name: "Priya", initials: "PR", color: "#bb55cc" },
  { id: "u5", name: "Sam", initials: "SA", color: "#e05a5a" },
  { id: "u6", name: "Wen", initials: "WE", color: "#3b9ee0" },
  { id: "u7", name: "Theo", initials: "TH", color: "#7a7fad" },
];

const SEED_TIMESTAMP = "2026-04-24T09:00:00.000Z";

export const SEED_COLUMNS: Column[] = [
  {
    id: "c1",
    title: "What went well",
    desc: "Wins worth celebrating — process, product, people.",
    cards: [
      {
        id: "k1",
        body: "Shipping behind a flag let us catch the tax-rounding bug before any customer hit it.",
        authorId: "u2",
        voters: ["u3", "u4", "u5", "me", "u6"],
      },
      {
        id: "k2",
        body: "Pair-programming on the payment hand-off saved at least a day of back-and-forth.",
        authorId: "u3",
        voters: ["u2", "me"],
      },
      {
        id: "k3",
        body: "Design review on Tuesday caught the address-form regression early.",
        authorId: "me",
        voters: ["u4"],
      },
      {
        id: "k4",
        body: "On-call rotation handover doc is finally up to date.",
        authorId: "u5",
        voters: [],
      },
    ],
  },
  {
    id: "c2",
    title: "What didn't",
    desc: "Friction, frustrations, things that slowed us down.",
    cards: [
      {
        id: "k5",
        body: "Staging data drifted from prod — three bugs only showed up after the cutover.",
        authorId: "u4",
        voters: ["u2", "u3", "me", "u5", "u6", "u7"],
      },
      {
        id: "k6",
        body: "Three meetings on the same day blocked anyone shipping Wed afternoon.",
        authorId: "me",
        voters: ["u2", "u3", "u4"],
      },
      {
        id: "k7",
        body: "Flaky e2e tests got muted instead of fixed.",
        authorId: "u6",
        voters: ["u3"],
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
        body: "Block 2-hour focus windows on the calendar before sprint planning.",
        authorId: "u2",
        voters: ["me", "u4", "u5", "u3"],
      },
      {
        id: "k9",
        body: "Rotate who runs standup — fresh eyes on the blockers.",
        authorId: "u7",
        voters: ["u2"],
      },
      {
        id: "k10",
        body: "Add a smoke-test step to the deploy that hits real staging data.",
        authorId: "u3",
        voters: ["u4", "me"],
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
        body: "Wen unblocked the auth migration on Friday night — saved Monday.",
        authorId: "me",
        voters: ["u2", "u3", "u4", "u5"],
      },
      {
        id: "k12",
        body: "Priya's checkout teardown doc is now the onboarding reference for new hires.",
        authorId: "u3",
        voters: ["u2", "me"],
      },
    ],
  },
];

export const SEED_BOARD: Board = {
  id: "b-seed-sprint-24",
  type: "retro",
  title: "Sprint 24 — checkout v2",
  theme:
    "We shipped checkout v2 last Tuesday. What worked, what didn't, and what should we try next sprint? Stay specific — talk about behaviors, not people.",
  created: "Apr 24",
  state: "open",
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
  starred: false,
  columns: SEED_COLUMNS,
};

// Back-compat re-exports for code paths that still reference the old constants.
export const BOARD = SEED_BOARD;
export const COLUMNS = SEED_COLUMNS;
