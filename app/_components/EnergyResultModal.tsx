"use client";

import { useEffect } from "react";
import { ENERGY_LABELS, ENERGY_LEVELS } from "./EnergyBattery";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";
import type { EnergyCheckIn } from "../_hooks/useEnergyCheckIn";

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dist = result?.distribution ?? [];

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
            <div className="energy-dist" aria-label="Energy vote distribution">
              {ENERGY_LEVELS.map((level) => {
                const n = dist[level - 1] ?? 0;
                const share = energy.count === 0 ? 0 : Math.round((n / energy.count) * 100);
                return (
                  <div className="energy-dist-row" key={level}>
                    <span className="energy-dist-label">
                      <em>{ENERGY_LABELS[level - 1]}</em>
                    </span>
                    <span className="energy-dist-track">
                      <span
                        className="energy-dist-bar"
                        style={{ width: `${share}%` }}
                        data-zero={n === 0}
                      />
                    </span>
                    <span className="energy-dist-count">{n} ({share}%)</span>
                  </div>
                );
              })}
            </div>
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
