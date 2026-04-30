import type { Card } from "../_data/retro";

// F-15: pure filter logic, kept side-effect free so it can be unit-tested
// and called from render code without ceremony. The render layer owns
// `hideNonMatching` (a view concern) and the dimming class — this helper
// just answers "does this card match the active filter?".

export type FilterDueStatus = "none" | "overdue" | "thisWeek" | "completed";

export type BoardFilter = {
  text: string;
  labelIds: string[];
  memberIds: string[];
  dueStatus: FilterDueStatus;
  // Render-only flag, but stored here so the popover can drive both the
  // shape of the rendered list and the dim styling from a single source.
  hideNonMatching: boolean;
};

export const EMPTY_FILTER: BoardFilter = {
  text: "",
  labelIds: [],
  memberIds: [],
  dueStatus: "none",
  hideNonMatching: false,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Local "today" in YYYY-MM-DD. Mirrors dueDateStatus.ts so F-15 and F-10
// agree on what "today" means at the day boundary.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Add `days` days to a YYYY-MM-DD string in local time. Used for the
// "due this week" upper bound (today + 6 = full 7-day inclusive window).
function addDaysLocalISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

// Counts how many filter dimensions are currently doing work. Used by the
// popover button's count badge. `hideNonMatching` is a render flag, not a
// filter dimension, so it doesn't bump the badge count.
export function activeFilterDimensionCount(f: BoardFilter): number {
  let n = 0;
  if (f.text.trim().length > 0) n += 1;
  if (f.labelIds.length > 0) n += 1;
  if (f.memberIds.length > 0) n += 1;
  if (f.dueStatus !== "none") n += 1;
  return n;
}

export function isFilterActive(f: BoardFilter): boolean {
  return activeFilterDimensionCount(f) > 0;
}

function textMatches(card: Card, needleRaw: string): boolean {
  const needle = needleRaw.trim().toLowerCase();
  if (!needle) return true;
  if (card.body && card.body.toLowerCase().includes(needle)) return true;
  if (card.description && card.description.toLowerCase().includes(needle)) {
    return true;
  }
  if (card.comments) {
    for (const c of card.comments) {
      if (c.body && c.body.toLowerCase().includes(needle)) return true;
    }
  }
  return false;
}

function dueMatches(card: Card, status: FilterDueStatus): boolean {
  if (status === "none") return true;
  if (status === "completed") return card.dueComplete === true;
  // overdue and thisWeek both require a real, non-completed date.
  if (!card.dueDate || !ISO_DATE.test(card.dueDate)) return false;
  if (card.dueComplete) return false;
  const today = todayLocalISO();
  if (status === "overdue") {
    return card.dueDate < today;
  }
  // thisWeek: today inclusive through today+6 inclusive.
  const upper = addDaysLocalISO(today, 6);
  return card.dueDate >= today && card.dueDate <= upper;
}

// AND across dimensions, OR within multi-select dimensions. Empty
// dimensions are treated as inactive — a card matches them trivially.
export function cardMatchesFilter(card: Card, filter: BoardFilter): boolean {
  if (!textMatches(card, filter.text)) return false;
  if (filter.labelIds.length > 0) {
    const cardLabels = card.labels ?? [];
    const hit = filter.labelIds.some((id) => cardLabels.includes(id));
    if (!hit) return false;
  }
  if (filter.memberIds.length > 0) {
    const cardMembers = card.assigneeIds ?? [];
    const hit = filter.memberIds.some((id) => cardMembers.includes(id));
    if (!hit) return false;
  }
  if (!dueMatches(card, filter.dueStatus)) return false;
  return true;
}
