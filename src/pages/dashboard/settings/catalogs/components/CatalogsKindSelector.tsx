import { CATALOG_KIND_LABELS, type CatalogKind } from "@/lib/catalogs";

interface CatalogsKindSelectorProps {
  selectedKind: CatalogKind;
  onSelectKind: (kind: CatalogKind) => void;
}

export function CatalogsKindSelector({
  selectedKind,
  onSelectKind,
}: CatalogsKindSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
      {(Object.keys(CATALOG_KIND_LABELS) as CatalogKind[]).map((kind) => {
        const isSelected = selectedKind === kind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelectKind(kind)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? "bg-signal text-signal-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {CATALOG_KIND_LABELS[kind].label}
          </button>
        );
      })}
    </div>
  );
}
