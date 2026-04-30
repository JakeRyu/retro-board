import type { Card } from "../_data/retro";

export type DueDateStatus = "future" | "today" | "overdue" | "complete";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Local "today" in the same YYYY-MM-DD shape we persist. Using local-time
// components (not toISOString) so a user near midnight in their own zone
// doesn't see a date flip caused by UTC offset — backlog says no time-zones
// beyond local for v1.
function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Returns null when the card has no due date or the stored string is malformed
// (e.g. a corrupt persisted payload). Callers use null to suppress rendering.
// `dueComplete === true` always wins over the date comparison.
export function dueDateStatus(card: Card): DueDateStatus | null {
  if (!card.dueDate) return null;
  if (!ISO_DATE.test(card.dueDate)) return null;
  if (card.dueComplete) return "complete";
  const today = todayLocalISO();
  if (card.dueDate < today) return "overdue";
  if (card.dueDate === today) return "today";
  return "future";
}

// Human-readable date label for an ISO YYYY-MM-DD string. Drops the year when
// the date is in the current calendar year (matches the design spec).
export function formatDueDate(iso: string): string {
  if (!ISO_DATE.test(iso)) return iso;
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  // Build with local-time components so the formatter doesn't shift by tz.
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}
