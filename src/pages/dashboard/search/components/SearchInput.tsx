import type { RefObject } from "react";
import { Search, ScanLine } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

export interface SearchInputProps {
  query: string;
  onChangeQuery: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onOpenScanner: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchInput({
  query,
  onChangeQuery,
  onFocus,
  onKeyDown,
  onOpenScanner,
  inputRef,
}: SearchInputProps) {
  return (
    <>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onChangeQuery(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder="Buscar por referencia o texto..."
        aria-label="Búsqueda global"
        aria-keyshortcuts="Control+K"
        className="h-9 w-full rounded-lg border border-border/70 bg-card pl-9 pr-22 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {query === "" && (
          <span
            aria-hidden="true"
            className="pointer-events-none hidden sm:flex items-center gap-0.5"
          >
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        )}
        <button
          type="button"
          onClick={onOpenScanner}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title="Escanear código QR o barras"
          aria-label="Escanear código QR o barras"
        >
          <ScanLine className="size-4" />
        </button>
      </div>
    </>
  );
}
