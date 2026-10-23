import { Button } from "@/components/ui/button";
import { Archive, SearchX } from "lucide-react";
import { getEmptyStateDescription, getEmptyStateTitle } from "./helpers";
import type { ArchiveEmptyStateProps } from "./types";

export function ArchiveEmptyState({
  search,
  totalEntries,
  onClearSearch,
}: ArchiveEmptyStateProps) {
  const isSearching = search !== "";

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-signal/10 text-signal">
        {isSearching ? (
          <SearchX className="size-5" />
        ) : (
          <Archive className="size-5" />
        )}
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight">
        {getEmptyStateTitle(search, totalEntries)}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {getEmptyStateDescription(search, totalEntries)}
      </p>
      {isSearching && (
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={onClearSearch}
        >
          Limpiar la búsqueda
        </Button>
      )}
    </div>
  );
}
