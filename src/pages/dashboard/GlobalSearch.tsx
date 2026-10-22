import { cn } from "@/lib/utils";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import type { GlobalSearchProps, SearchHit } from "./search/types";
import { useGlobalSearch } from "./search/hooks/useGlobalSearch";
import { SearchInput } from "./search/components/SearchInput";
import { SearchResultsDropdown } from "./search/components/SearchResultsDropdown";

export type { SearchHit };

/**
 * Buscador global del taller: incidencias y peticiones (siempre) y, para quien
 * gestiona el catálogo, repuestos y equipos. Al elegir un resultado, `onSelect`
 * lleva al módulo correspondiente con el elemento abierto o pre-filtrado.
 *
 * Las incidencias se encuentran también por su referencia —«INC-0004», «inc-4»
 * o «4»—, que es el número que se le da a quien notifica la avería; además de
 * por su texto, como el resto.
 */
export function GlobalSearch({
  canSearchCatalog = false,
  onSelect,
  className,
}: GlobalSearchProps) {
  const {
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
  } = useGlobalSearch({ canSearchCatalog, onSelect });

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <SearchInput
        query={query}
        onChangeQuery={handleChangeQuery}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onOpenScanner={handleOpenScanner}
        inputRef={inputRef}
      />

      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />

      <SearchResultsDropdown
        open={open}
        trimmedQuery={trimmed}
        groups={groups}
        safeIndex={safeIndex}
        onHoverIndex={setActiveIndex}
        onSelectHit={selectHit}
      />
    </div>
  );
}
