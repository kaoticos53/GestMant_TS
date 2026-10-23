import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";

export interface UseDataTableToolbarSearchParams {
  search: string;
  onSearchChange: (value: string) => void;
  debounceMs?: number;
}

export function useDataTableToolbarSearch({
  search,
  onSearchChange,
  debounceMs = 0,
}: UseDataTableToolbarSearchParams) {
  const [localSearch, setLocalSearch] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);

  // Si el valor externo cambia, el campo local lo sigue en el mismo render.
  if (search !== prevSearch) {
    setPrevSearch(search);
    setLocalSearch(search);
  }

  useEffect(() => {
    if (debounceMs <= 0) return;
    if (localSearch === search) return;

    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localSearch, debounceMs, onSearchChange, search]);

  const handleSearchInput = (value: string) => {
    if (debounceMs > 0) {
      setLocalSearch(value);
    } else {
      setLocalSearch(value);
      onSearchChange(value);
    }
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && debounceMs > 0) {
      onSearchChange(localSearch);
    }
  };

  return {
    localSearch,
    handleSearchInput,
    handleClearSearch,
    handleKeyDown,
  };
}
