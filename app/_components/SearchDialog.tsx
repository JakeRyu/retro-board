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
import { useStore } from "../_data/store";
import { useOverlayDismiss } from "../_hooks/useOverlayDismiss";
import { Icon } from "./Primitives";
import type { SearchHit } from "../_data/searchTypes";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEBOUNCE_MS = 200;

export function SearchDialog({ open, onClose }: Props) {
  const router = useRouter();
  const { activeWorkspaceId } = useStore();

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const overlay = useOverlayDismiss(onClose);

  // Reset and autofocus on open.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
    setActiveIdx(0);
    setLoading(false);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced fetch.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}&workspaceId=${encodeURIComponent(
            activeWorkspaceId,
          )}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) {
          setHits([]);
          return;
        }
        const data = (await res.json()) as SearchHit[];
        setHits(data);
        setActiveIdx(0);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setHits([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [q, open, activeWorkspaceId]);

  const term = q.trim();

  const groups = useMemo(() => groupHits(hits), [hits]);
  const flatHits = useMemo(
    () => groups.flatMap((g) => g.items),
    [groups],
  );

  const openHit = useCallback(
    (hit: SearchHit) => {
      const boardPath = `/boards/${hit.boardId}`;
      onClose();
      if (
        hit.kind === "card" &&
        typeof window !== "undefined" &&
        window.location.pathname === boardPath
      ) {
        // Same-board card jump: router.push won't fire `hashchange`, so set
        // location.hash directly — RetroApp's listener picks it up and opens
        // the card modal.
        window.location.hash = `card=${encodeURIComponent(hit.cardId)}`;
        return;
      }
      const href =
        hit.kind === "card"
          ? `${boardPath}#card=${encodeURIComponent(hit.cardId)}`
          : boardPath;
      router.push(href);
    },
    [onClose, router],
  );

  // Keep the active row visible when arrowing.
  useEffect(() => {
    if (!open) return;
    const el = resultsRef.current?.querySelector<HTMLElement>(
      `[data-result-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (!flatHits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flatHits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flatHits[activeIdx];
      if (hit) openHit(hit);
    }
  };

  return (
    <div
      className={"modal-overlay" + (open ? " open" : "")}
      {...overlay.overlayProps}
      aria-hidden={!open}
      onKeyDown={onKeyDown}
    >
      <div
        className="modal modal-search"
        {...overlay.panelProps}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="sr-only">
          Search retros
        </h2>
        <div className="search-input-row">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cards and retros…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search query"
          />
          {loading && <span className="search-spinner" aria-hidden />}
          <kbd className="kbd">Esc</kbd>
        </div>

        <div className="search-results" ref={resultsRef} role="listbox">
          {term.length < 2 ? (
            <div className="search-empty">
              <span className="search-hint">
                Type at least 2 characters. Searches card text and retro
                titles in the active workspace.
              </span>
            </div>
          ) : !loading && flatHits.length === 0 ? (
            <div className="search-empty">
              <span>No matches for &ldquo;{term}&rdquo;.</span>
            </div>
          ) : (
            groups.map((group, gi) => (
              <div className="search-group" key={gi}>
                <div className="search-group-head">{group.label}</div>
                {group.items.map((hit) => {
                  const idx = flatHits.indexOf(hit);
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      type="button"
                      key={resultKey(hit, idx)}
                      data-result-idx={idx}
                      role="option"
                      aria-selected={isActive}
                      className={
                        "search-result" + (isActive ? " active" : "")
                      }
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => openHit(hit)}
                    >
                      <ResultRow hit={hit} term={term} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {flatHits.length > 0 && (
          <div className="search-footer">
            <span>
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd> navigate
            </span>
            <span>
              <kbd className="kbd">↵</kbd> open
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

type Group = { label: string; items: SearchHit[] };

function groupHits(hits: SearchHit[]): Group[] {
  // Boards first (title matches), then card matches grouped by board.
  const boardHits = hits.filter((h) => h.kind === "board");
  const cardHits = hits.filter((h) => h.kind === "card");
  const groups: Group[] = [];
  if (boardHits.length) {
    groups.push({ label: "Retros", items: boardHits });
  }
  if (cardHits.length) {
    const byBoard = new Map<string, SearchHit[]>();
    for (const h of cardHits) {
      if (h.kind !== "card") continue;
      const arr = byBoard.get(h.boardId) ?? [];
      arr.push(h);
      byBoard.set(h.boardId, arr);
    }
    for (const [, items] of byBoard) {
      const first = items[0];
      if (first.kind !== "card") continue;
      groups.push({
        label: `Cards in ${first.boardTitle}${first.archived ? " · archived" : ""}`,
        items,
      });
    }
  }
  return groups;
}

function resultKey(hit: SearchHit, idx: number): string {
  return hit.kind === "card"
    ? `card-${hit.boardId}-${hit.cardId}-${idx}`
    : `board-${hit.boardId}-${idx}`;
}

function ResultRow({ hit, term }: { hit: SearchHit; term: string }) {
  if (hit.kind === "board") {
    return (
      <>
        <Icon name="board" size={14} />
        <span className="search-result-main">
          <span className="search-result-title">
            <Highlight text={hit.boardTitle} term={term} />
          </span>
        </span>
        {hit.archived && <span className="search-badge">archived</span>}
      </>
    );
  }
  return (
    <>
      <Icon name="description" size={14} />
      <span className="search-result-main">
        <span className="search-snippet">
          <SnippetHighlight
            snippet={hit.snippet}
            start={hit.matchStart}
            len={hit.matchLen}
          />
        </span>
        <span className="search-result-meta">
          in {hit.boardTitle}
          {hit.cardArchived && " · archived card"}
        </span>
      </span>
      {hit.archived && <span className="search-badge">archived</span>}
    </>
  );
}

function Highlight({ text, term }: { text: string; term: string }) {
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-mark">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

function SnippetHighlight({
  snippet,
  start,
  len,
}: {
  snippet: string;
  start: number;
  len: number;
}) {
  if (start < 0 || start >= snippet.length) return <>{snippet}</>;
  return (
    <>
      {snippet.slice(0, start)}
      <mark className="search-mark">{snippet.slice(start, start + len)}</mark>
      {snippet.slice(start + len)}
    </>
  );
}
