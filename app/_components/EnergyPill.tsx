"use client";

import { useEffect, useRef, useState } from "react";
import {
  EnergyBattery,
  EnergyPicker,
  ENERGY_LABELS,
  type EnergyLevel,
} from "./EnergyBattery";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";
import type { EnergyCheckIn } from "../_hooks/useEnergyCheckIn";

// Mirrors MIN_REVEAL_VOTES in lib/energyCheckin.ts, which can't be imported
// here — it pulls in node:crypto. The server rejects an early reveal anyway;
// this only drives the disabled state.
const MIN_REVEAL_VOTES = 3;

type EnergyPillProps = {
  energy: EnergyCheckIn;
  isOwner: boolean;
  onOpenResult: () => void;
};

export function EnergyPill({ energy, isOwner, onOpenResult }: EnergyPillProps) {
  const [open, setOpen] = useState(false);
  const [confirmForce, setConfirmForce] = useState(false);
  const [hover, setHover] = useState<EnergyLevel | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const forceOverlay = useOverlayDismiss(() => setConfirmForce(false));

  // Click-away + Escape, matching BoardSettingsMenu.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!confirmForce) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmForce(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmForce]);

  const { count, total, mine, revealed, result } = energy;
  const aboveFloor = count >= MIN_REVEAL_VOTES;
  const everyoneVoted = count > 0 && count >= total;
  const canReveal = isOwner && !revealed && aboveFloor && everyoneVoted;
  const shown = hover ?? mine;

  const onTrigger = () => {
    if (revealed) onOpenResult();
    else setOpen((o) => !o);
  };

  return (
    <div className="energy-wrap" ref={wrapRef}>
      <button
        type="button"
        className="energy-pill"
        data-voted={mine !== null}
        data-revealed={revealed}
        onClick={onTrigger}
        aria-haspopup={revealed ? undefined : "dialog"}
        aria-expanded={revealed ? undefined : open}
        title={
          revealed
            ? "Show team energy"
            : mine !== null
              ? `Your energy: ${mine} — ${ENERGY_LABELS[mine - 1]}`
              : "Vote your energy for this sprint"
        }
      >
        {revealed && result ? (
          <>
            <EnergyBattery percent={result.percent} />
            <span className="energy-count">{result.percent}%</span>
          </>
        ) : mine !== null ? (
          <>
            <EnergyBattery percent={(mine / 5) * 100} />
            <span className="energy-count">
              {count}/{total}
            </span>
          </>
        ) : (
          <>
            <BoltGlyph />
            <span>Energy</span>
            <span className="energy-count">
              {count}/{total}
            </span>
            <span className="energy-nudge" aria-hidden />
          </>
        )}
      </button>

      {open && !revealed && (
        <div className="energy-popover" role="dialog" aria-label="Energy check-in">
          <p className="energy-prompt">How was your energy this sprint?</p>

          <EnergyPicker
            value={mine}
            onPick={(level) => void energy.vote(level)}
            onHover={setHover}
          />

          <p className="energy-scale">
            {shown !== null ? (
              <>
                <strong>{shown}</strong> · {ENERGY_LABELS[shown - 1]}
              </>
            ) : (
              <>
                <span>{ENERGY_LABELS[0]}</span>
                <span className="energy-scale-sep" />
                <span>{ENERGY_LABELS[4]}</span>
              </>
            )}
          </p>

          <div className="energy-foot">
            <span className="energy-foot-note">
              Anonymous — only the team total is shown.
            </span>
            <span className="energy-count">
              {count} of {total} voted
            </span>
          </div>

          {isOwner && (
            <>
              <button
                type="button"
                className="btn btn-primary energy-reveal"
                disabled={!canReveal}
                title={
                  aboveFloor
                    ? undefined
                    : `At least ${MIN_REVEAL_VOTES} votes are needed to reveal anonymously`
                }
                onClick={async () => {
                  if (await energy.reveal()) setOpen(false);
                }}
              >
                {everyoneVoted ? "Reveal results" : `Waiting for ${total - count}`}
              </button>
              {!everyoneVoted && aboveFloor && (
                <button
                  type="button"
                  className="btn btn-subtle energy-reveal-anyway"
                  onClick={() => {
                    setOpen(false);
                    setConfirmForce(true);
                  }}
                >
                  Reveal anyway
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div
        className={"modal-overlay" + (confirmForce ? " open" : "")}
        {...forceOverlay.overlayProps}
      >
        <div className="modal" {...forceOverlay.panelProps}>
          <h2>Reveal without everyone?</h2>
          <p>
            {total - count} {total - count === 1 ? "person hasn't" : "people haven't"}{" "}
            voted yet. Revealing locks the check-in for everyone — they
            won&apos;t be able to vote afterwards, and results can&apos;t be
            hidden again.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmForce(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                await energy.reveal(true);
                setConfirmForce(false);
                setOpen(false);
              }}
            >
              Reveal now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoltGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
