"use client";

import { useEffect, useState } from "react";
import { EnergyBattery, ENERGY_LABELS, ENERGY_LEVELS } from "./EnergyBattery";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";
import type { EnergyCheckIn } from "../_hooks/useEnergyCheckIn";

const CHARGE_MS = 900;

type EnergyResultModalProps = {
  open: boolean;
  energy: EnergyCheckIn;
  onClose: () => void;
};

export function EnergyResultModal({
  open,
  energy,
  onClose,
}: EnergyResultModalProps) {
  const overlay = useOverlayDismiss(onClose);
  const result = energy.result;
  const target = result?.percent ?? 0;
  // One tweened value drives both the fill width and the numeral, so they
  // can't drift apart the way a CSS transition plus a JS counter would.
  const charge = useCharge(open && !!result, target);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dist = result?.distribution ?? [];
  const peak = Math.max(1, ...dist);

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      {...overlay.overlayProps}
    >
      <div className="modal modal-energy" {...overlay.panelProps}>
        <h2>Team energy</h2>
        <p>Sprint check-in · anonymous</p>

        {result && (
          <>
            <div className="energy-hero">
              <EnergyBattery percent={charge} size="lg" />
              <div className="energy-hero-read">
                <span className="energy-hero-pct">{charge}%</span>
                <span className="energy-hero-avg">
                  {result.average.toFixed(1)} / 5 average
                </span>
              </div>
            </div>

            <div className="energy-dist">
              {ENERGY_LEVELS.map((level) => {
                const n = dist[level - 1] ?? 0;
                return (
                  <div className="energy-dist-row" key={level}>
                    <span className="energy-dist-label">
                      {level} <em>{ENERGY_LABELS[level - 1]}</em>
                    </span>
                    <span className="energy-dist-track">
                      <span
                        className="energy-dist-bar"
                        style={{ width: `${(n / peak) * 100}%` }}
                        data-zero={n === 0}
                      />
                    </span>
                    <span className="energy-dist-count">{n}</span>
                  </div>
                );
              })}
            </div>

            {isSplit(dist, energy.count) && (
              <p className="energy-split">
                Split team — the average hides two very different sprints.
                Worth digging into.
              </p>
            )}
          </>
        )}

        <div className="energy-foot">
          <span className="energy-count">
            {energy.count} of {energy.total} voted
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function useCharge(active: boolean, target: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / CHARGE_MS);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return value;
}

// Both ends of the scale carrying most of the votes means the average is
// describing nobody's actual sprint.
function isSplit(dist: number[], count: number): boolean {
  if (count < 4) return false;
  const low = (dist[0] ?? 0) + (dist[1] ?? 0);
  const high = (dist[3] ?? 0) + (dist[4] ?? 0);
  return low > 0 && high > 0 && low + high >= count * 0.6;
}
