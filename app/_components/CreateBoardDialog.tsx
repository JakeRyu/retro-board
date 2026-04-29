"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { BOARD_COLORS, type BoardType } from "../_data/retro";
import { storeActions } from "../_data/store";

type Props = {
  open: boolean;
  onClose: () => void;
};

const TITLE_MAX = 80;
const SUBMIT_DELAY_MS = 120; // brief "Creating…" beat per spec §4.

function pickRandomColor(): string {
  const i = Math.floor(Math.random() * BOARD_COLORS.length);
  return BOARD_COLORS[i];
}

export function CreateBoardDialog({ open, onClose }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<BoardType>("kanban");
  const [theme, setTheme] = useState("");
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusRef = useRef<HTMLButtonElement | null>(null);
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const titleLabelId = useId();
  const typeLabelId = useId();
  const themeLabelId = useId();
  const colorLabelId = useId();
  const errorId = useId();
  const dialogTitleId = useId();

  // Reset state when the dialog opens. Default color is randomized at
  // dialog-open per spec §3 so successive creates don't collide.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("kanban");
    setTheme("");
    setColor(pickRandomColor());
    setError(null);
    setSubmitting(false);
  }, [open]);

  // Autofocus title input on open.
  useEffect(() => {
    if (!open) return;
    // Defer to ensure the input is in the DOM and the modal transition has
    // started; otherwise the focus flickers.
    const t = setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Esc to cancel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const colorIndex = useMemo(
    () => BOARD_COLORS.findIndex((c) => c === color),
    [color],
  );

  const submit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed.length < 1) {
      setError("Title is required.");
      titleInputRef.current?.focus();
      return;
    }
    if (trimmed.length > TITLE_MAX) {
      setError(`Title is too long — ${TITLE_MAX} characters max.`);
      titleInputRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    // Small confirmation beat before navigation per spec §4.
    setTimeout(() => {
      try {
        const id = storeActions.createBoard({
          title: trimmed,
          type,
          color,
          theme: type === "retro" ? theme.trim() : "",
        });
        // Close before pushing so the trigger gets refocused; navigation
        // will then mount a fresh page.
        onClose();
        router.push(`/boards/${id}`);
      } catch {
        setSubmitting(false);
        setError("Couldn't save — your browser's storage is full.");
      }
    }, SUBMIT_DELAY_MS);
  }, [title, type, color, theme, onClose, router]);

  const onTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const onSegmentedKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setType((t) => (t === "kanban" ? "retro" : "kanban"));
    }
  };

  const onColorKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const nextIdx =
        (idx + dir + BOARD_COLORS.length) % BOARD_COLORS.length;
      setColor(BOARD_COLORS[nextIdx]);
      swatchRefs.current[nextIdx]?.focus();
    }
  };

  // Focus trap — wrap from the last focusable back to the first and vice-versa.
  const onTrapStart = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.relatedTarget === lastFocusRef.current) {
      titleInputRef.current?.focus();
    } else {
      lastFocusRef.current?.focus();
    }
  };
  const onTrapEnd = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.relatedTarget === titleInputRef.current) {
      lastFocusRef.current?.focus();
    } else {
      titleInputRef.current?.focus();
    }
  };

  const showCounter = title.length >= 60;
  const counterTone =
    title.length > TITLE_MAX
      ? "danger"
      : title.length >= 70
        ? "warn"
        : "default";

  const isRetro = type === "retro";

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      onClick={onClose}
      aria-hidden={!open}
    >
      {/* Sentinel to catch shift-tab from the first focusable element. */}
      <input
        tabIndex={open ? 0 : -1}
        aria-hidden
        className="focus-sentinel"
        onFocus={onTrapStart}
      />
      <div
        className="modal modal-create"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
      >
        <h2 id={dialogTitleId}>Create a new board</h2>

        {/* Title field */}
        <div className="field">
          <label className="field-label" htmlFor={titleLabelId}>
            Title
          </label>
          <input
            id={titleLabelId}
            ref={titleInputRef}
            type="text"
            className={"add-card-input field-input" + (error ? " has-error" : "")}
            value={title}
            placeholder="e.g. Sprint 25 — payments v3"
            onChange={(e) => {
              setTitle(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onTitleKeyDown}
            disabled={submitting}
            maxLength={400}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
          />
          {showCounter && !error && (
            <div className={"field-counter " + counterTone}>
              {title.length}/{TITLE_MAX}
            </div>
          )}
          {error && (
            <div id={errorId} className="field-helper error">
              {error}
            </div>
          )}
        </div>

        {/* Type segmented control */}
        <div className="field">
          <span className="field-label" id={typeLabelId}>Type</span>
          <div
            className="segmented"
            role="radiogroup"
            aria-labelledby={typeLabelId}
            onKeyDown={onSegmentedKeyDown}
          >
            <span
              className="segmented-indicator"
              aria-hidden
              data-pos={type}
            />
            <button
              type="button"
              role="radio"
              aria-checked={type === "kanban"}
              aria-selected={type === "kanban"}
              tabIndex={type === "kanban" ? 0 : -1}
              className="segmented-option"
              onClick={() => setType("kanban")}
              disabled={submitting}
            >
              Kanban
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={type === "retro"}
              aria-selected={type === "retro"}
              tabIndex={type === "retro" ? 0 : -1}
              className="segmented-option"
              onClick={() => setType("retro")}
              disabled={submitting}
            >
              Retro
            </button>
          </div>
        </div>

        {/* Theme prompt — animated reveal */}
        <div className={"theme-prompt-collapse" + (isRetro ? " open" : "")}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor={themeLabelId}>
              Theme prompt
            </label>
            <textarea
              id={themeLabelId}
              className="add-card-input field-input"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="What's this retro about? Stay specific — talk about behaviors, not people."
              rows={3}
              disabled={submitting || !isRetro}
              tabIndex={isRetro ? 0 : -1}
              aria-hidden={!isRetro}
            />
          </div>
        </div>

        {/* Color swatches */}
        <div className="field">
          <span className="field-label" id={colorLabelId}>Color</span>
          <div
            className="color-swatch-grid"
            role="radiogroup"
            aria-labelledby={colorLabelId}
          >
            {BOARD_COLORS.map((c, i) => {
              const selected = c === color;
              return (
                <button
                  key={c}
                  type="button"
                  ref={(el) => {
                    swatchRefs.current[i] = el;
                  }}
                  className="color-swatch"
                  role="radio"
                  aria-checked={selected}
                  aria-pressed={selected}
                  aria-label={`Color ${i + 1}`}
                  tabIndex={
                    selected || (colorIndex < 0 && i === 0) ? 0 : -1
                  }
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  onKeyDown={(e) => onColorKeyDown(e, i)}
                  disabled={submitting}
                />
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            ref={lastFocusRef}
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create board"}
          </button>
        </div>
      </div>
      {/* Sentinel to catch tab past the last focusable element. */}
      <input
        tabIndex={open ? 0 : -1}
        aria-hidden
        className="focus-sentinel"
        onFocus={onTrapEnd}
      />
    </div>
  );
}
