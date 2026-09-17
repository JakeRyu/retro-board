"use client";

// The battery is the shared metaphor for the whole check-in: you charge your
// own cell in the picker, and the reveal shows the team's merged charge. Both
// use the same shell so the two readings are visually comparable.

import { useState } from "react";

export const ENERGY_LABELS = [
  "Drained",
  "Low",
  "Steady",
  "Good",
  "Energised",
] as const;

export const ENERGY_LEVELS = [1, 2, 3, 4, 5] as const;

export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

/** Colour band, resolved in CSS off the `data-band` attribute. */
export function energyBand(percent: number): "low" | "mid" | "high" {
  if (percent <= 40) return "low";
  if (percent <= 70) return "mid";
  return "high";
}

function Cells() {
  // Five equal cells drawn over the fill. Without them "62%" has nothing to
  // be 62% *of* — they put the 1–5 scale back under the continuous reading.
  return (
    <span className="energy-cells" aria-hidden>
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

type EnergyBatteryProps = {
  percent: number;
  size?: "sm" | "lg";
};

export function EnergyBattery({ percent, size = "sm" }: EnergyBatteryProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <span
      className="energy-battery"
      data-size={size}
      data-band={energyBand(clamped)}
    >
      <span className="energy-shell">
        <span className="energy-fill" style={{ width: `${clamped}%` }} />
        <Cells />
      </span>
      <span className="energy-nub" />
    </span>
  );
}

type EnergyPickerProps = {
  value: EnergyLevel | null;
  onPick: (level: EnergyLevel) => void;
  /** Lets the caller echo the level being considered before it's committed. */
  onHover?: (level: EnergyLevel | null) => void;
};

export function EnergyPicker({ value, onPick, onHover }: EnergyPickerProps) {
  const [hover, setHover] = useState<EnergyLevel | null>(null);
  const shown = hover ?? value;
  const band = energyBand(shown ? (shown / 5) * 100 : 0);

  const preview = (level: EnergyLevel | null) => {
    setHover(level);
    onHover?.(level);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const digit = Number(e.key);
    if (digit >= 1 && digit <= 5) {
      e.preventDefault();
      onPick(digit as EnergyLevel);
      return;
    }
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    // Arrows commit straight away, as a native radio group would. Re-voting
    // stays open until the reveal, so there is nothing to confirm.
    onPick(Math.min(5, Math.max(1, (value ?? 0) + delta)) as EnergyLevel);
  };

  return (
    <div
      className="energy-battery energy-picker"
      data-band={band}
      role="radiogroup"
      aria-label="Your energy level"
      onKeyDown={onKeyDown}
      onPointerLeave={() => preview(null)}
    >
      <span className="energy-shell">
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            className="energy-seg"
            data-filled={shown !== null && level <= shown}
            aria-checked={value === level}
            aria-label={`${level} — ${ENERGY_LABELS[level - 1]}`}
            tabIndex={value === null ? (level === 1 ? 0 : -1) : value === level ? 0 : -1}
            onPointerEnter={() => preview(level)}
            onFocus={() => preview(level)}
            onClick={() => onPick(level)}
          />
        ))}
      </span>
      <span className="energy-nub" />
    </div>
  );
}
