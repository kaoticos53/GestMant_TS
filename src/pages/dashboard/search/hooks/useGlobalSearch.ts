import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GlobalSearchProps, QuickAction } from "../types";
import { buildSearchGroupsFromResponse } from "../helpers";

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function useGlobalSearch({
  canSearchCatalog = false,
  onSelect,
  quickActions = [],
  shortcutEnabled = true,
}: Pick<
  GlobalSearchProps,
  "canSearchCatalog" | "onSelect" | "quickActions" | "shortcutEnabled"
>) {
  const [engaged, setEngaged] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = query.trim();
    const timer = window.setTimeout(
      () => {
        setDebouncedQuery(next);
      },
      next ? 160 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const effectiveQuery = query.trim() ? debouncedQuery : "";
  const response = useQuery(
    api.search.global,
    engaged && effectiveQuery ? { query: effectiveQuery } : "skip",
  );

  // ⌘/Ctrl + K lleva el foco al buscador desde cualquier pantalla visible
  useEffect(() => {
    if (!shortcutEnabled) return;
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setEngaged(true);
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [shortcutEnabled]);

  // Cierre al pulsar fuera
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const groups = useMemo(
    () =>
      buildSearchGroupsFromResponse(effectiveQuery ? response : null, {
        canSearchCatalog,
      }),
    [effectiveQuery, response, canSearchCatalog],
  );

  const flatHits = useMemo(
    () => groups.flatMap((group) => group.hits),
    [groups],
  );

  const trimmed = query.trim();
  const filteredActions = useMemo(() => {
    if (quickActions.length === 0) return [];
    if (trimmed === "") return quickActions;
    const needle = normalizeSearchText(trimmed);
    return quickActions.filter((action) => {
      const haystack = [
        action.label,
        action.subtitle,
        ...(action.keywords ?? []),
      ]
        .map(normalizeSearchText)
        .join(" ");
      return haystack.includes(needle);
    });
  }, [quickActions, trimmed]);

  const totalNavigable = flatHits.length + filteredActions.length;
  const safeIndex =
    totalNavigable > 0 ? Math.min(activeIndex, totalNavigable - 1) : 0;

  const selectHit = (hit: (typeof flatHits)[number]) => {
    onSelect(hit);
    setQuery("");
    setOpen(false);
  };

  const runAction = (action: QuickAction) => {
    action.onRun();
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (totalNavigable === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.min(safeIndex + 1, totalNavigable - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(safeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (safeIndex < flatHits.length) {
        const hit = flatHits[safeIndex];
        if (hit) selectHit(hit);
      } else {
        const action = filteredActions[safeIndex - flatHits.length];
        if (action) runAction(action);
      }
    }
  };

  const handleFocus = () => {
    setEngaged(true);
    setOpen(true);
  };

  const handleChangeQuery = (value: string) => {
    setEngaged(true);
    setQuery(value);
    setActiveIndex(0);
    setOpen(true);
  };

  const handleScan = (code: string) => {
    setEngaged(true);
    setQuery(code);
    setActiveIndex(0);
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleOpenScanner = () => {
    setEngaged(true);
    setScannerOpen(true);
  };

  return {
    query,
    open,
    trimmed,
    groups,
    filteredActions,
    safeIndex,
    scannerOpen,
    containerRef,
    inputRef,
    setActiveIndex,
    setScannerOpen,
    selectHit,
    runAction,
    handleKeyDown,
    handleFocus,
    handleChangeQuery,
    handleScan,
    handleOpenScanner,
  };
}
