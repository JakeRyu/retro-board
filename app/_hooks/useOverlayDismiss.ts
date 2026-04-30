"use client";

import { useCallback, useRef } from "react";

/**
 * Pointerdown-vs-click guard for modal overlays.
 *
 * The naive `<div className="modal-overlay" onClick={close}>` pattern leaks:
 * a text-selection drag that *starts* inside the modal but *releases* over
 * the overlay fires a `click` event whose `target === currentTarget`, and
 * the modal closes. The fix is to track whether `pointerdown` also landed on
 * the overlay, and treat the click as a real overlay-dismiss only if both
 * did.
 *
 * Usage:
 *
 *   const overlay = useOverlayDismiss(onClose);
 *   <div className="modal-overlay" {...overlay.overlayProps}>
 *     <div className="modal" {...overlay.panelProps}>...</div>
 *   </div>
 *
 * `panelProps` only sets `onPointerDown` — callers can still attach their
 * own click / pointerdown handlers without conflicting (handlers are
 * additive on JSX spread).
 */
export function useOverlayDismiss(onClose: () => void) {
  const pointerStartedOnOverlay = useRef(false);

  const onOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerStartedOnOverlay.current = e.target === e.currentTarget;
    },
    [],
  );

  const onPanelPointerDown = useCallback(() => {
    pointerStartedOnOverlay.current = false;
  }, []);

  const onOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (!pointerStartedOnOverlay.current) return;
      pointerStartedOnOverlay.current = false;
      onClose();
    },
    [onClose],
  );

  return {
    overlayProps: {
      onPointerDown: onOverlayPointerDown,
      onClick: onOverlayClick,
    },
    panelProps: {
      onPointerDown: onPanelPointerDown,
    },
  };
}
