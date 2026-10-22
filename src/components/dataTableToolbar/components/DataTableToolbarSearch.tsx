import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDataTableToolbarSearch } from "../hooks/useDataTableToolbarSearch";
import type { DataTableToolbarSearchProps } from "../types";

export function DataTableToolbarSearch({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  searchAriaLabel = "Buscar",
  debounceMs = 0,
}: DataTableToolbarSearchProps) {
  const {
    localSearch,
    handleSearchInput,
    handleClearSearch,
    handleKeyDown,
  } = useDataTableToolbarSearch({
    search,
    onSearchChange,
    debounceMs,
  });

  return (
    <div className="relative min-w-[14rem] flex-1 sm:max-w-md">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={localSearch}
        onChange={(event) => handleSearchInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={searchPlaceholder}
        aria-label={searchAriaLabel}
        className="pl-9 pr-9"
      />
      {localSearch !== "" && (
        <button
          type="button"
          onClick={handleClearSearch}
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
