import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GlobalSearchProps, SearchHit } from "../types";
import { filterSearchGroups } from "../helpers";

export function useGlobalSearch({
  canSearchCatalog = false,
  onSelect,
}: Pick<GlobalSearchProps, "canSearchCatalog" | "onSelect">) {
  const [engaged, setEngaged] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const consultaIncidencias = useQuery(
    api.incidents.list,
    engaged ? { includeArchived: true } : "skip",
  );
  const consultaPeticiones = useQuery(
    api.partRequests.list,
    engaged ? { includeArchived: true } : "skip",
  );
  const consultaRepuestos = useQuery(
    api.spareParts.list,
    engaged && canSearchCatalog ? {} : "skip",
  );
  const consultaEquipos = useQuery(
    api.equipment.list,
    engaged && canSearchCatalog ? {} : "skip",
  );

  const incidents = useMemo(
    () => consultaIncidencias ?? [],
    [consultaIncidencias],
  );
  const requests = useMemo(
    () => consultaPeticiones ?? [],
    [consultaPeticiones],
  );
  const parts = useMemo(() => consultaRepuestos ?? [], [consultaRepuestos]);
  const equipment = useMemo(() => consultaEquipos ?? [], [consultaEquipos]);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘/Ctrl + K lleva el foco al buscador desde cualquier pantalla
  useEffect(() => {
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
  }, []);

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
      filterSearchGroups({
        query,
        incidents,
        requests,
        parts,
        equipment,
        canSearchCatalog,
      }),
    [query, incidents, requests, parts, equipment, canSearchCatalog],
  );

  const flatHits = useMemo(
    () => groups.flatMap((group) => group.hits),
    [groups],
  );

  const trimmed = query.trim();
  const safeIndex =
    flatHits.length > 0 ? Math.min(activeIndex, flatHits.length - 1) : 0;

  const selectHit = (hit: SearchHit) => {
    onSelect(hit);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (flatHits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.min(safeIndex + 1, flatHits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(safeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = flatHits[safeIndex] ?? flatHits[0];
      if (hit) selectHit(hit);
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
    safeIndex,
    scannerOpen,
    containerRef,
    inputRef,
    setActiveIndex,
    setScannerOpen,
    selectHit,
    handleKeyDown,
    handleFocus,
    handleChangeQuery,
    handleScan,
    handleOpenScanner,
  };
}
