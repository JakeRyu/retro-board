import { BOARD_COLORS } from "../_data/retro";

// Derive a stable 2-letter avatar string from a display name.
//   "Jihyung Ryu" → "JR"   "maya"       → "MA"
//   "Wen"         → "WE"   ""           → "??"
// Single-word names fall back to the first two letters so the avatar circle
// never renders as one centred glyph (looks lopsided next to multi-word peers).
export function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Hash the name to a BOARD_COLORS index so the swatch is deterministic across
// renders and sessions. Mirrors workspaceColor()'s formula — same palette
// keeps the sidebar visually coherent (boards, workspaces, user).
export function colorFromName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % BOARD_COLORS.length;
  return BOARD_COLORS[idx];
}
