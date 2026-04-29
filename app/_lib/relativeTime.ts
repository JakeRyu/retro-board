// Compact relative-time formatter for boards-list "updated" line.
// No library — the bands are short and the design spec pins the exact strings.
//
// Buckets (from F-02 microcopy bank):
//   < 1 min     "just now"
//   < 60 min    "Nm ago"
//   < 24 h      "Nh ago"
//   < 7 d       "Nd ago"
//   < 14 d      "last week"
//   < 30 d      "Nw ago"
//   same year   "MMM d"   (e.g. "Jan 12")
//   older       "MMM yyyy"

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  const sameYear = then.getFullYear() === now.getFullYear();
  if (sameYear) return `${MONTHS[then.getMonth()]} ${then.getDate()}`;
  return `${MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}
