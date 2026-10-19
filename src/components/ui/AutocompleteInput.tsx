import * as React from "react";
import { Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  analyzeInputMatches,
  CatalogItemLike,
  CatalogKind,
} from "@/lib/catalogs";

export interface AutocompleteInputProps<T extends CatalogItemLike = CatalogItemLike>
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  items: readonly T[];
  kind?: CatalogKind;
  onItemSelect?: (item: T) => void;
  onAddNew?: (newValue: string) => void;
  allowAddNew?: boolean;
}

export function AutocompleteInput<T extends CatalogItemLike = CatalogItemLike>({
  value,
  onChange,
  items,
  kind,
  onItemSelect,
  onAddNew,
  allowAddNew = true,
  className,
  placeholder,
  disabled,
  id,
  ...props
}: AutocompleteInputProps<T>) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const analysis = React.useMemo(() => {
    return analyzeInputMatches(value, items, { maxResults: 7 });
  }, [value, items]);

  const handleSelect = (item: T) => {
    onChange(item.name);
    if (onItemSelect) onItemSelect(item);
    setOpen(false);
  };

  const handleApplySuggestion = (suggestion: T) => {
    onChange(suggestion.name);
    if (onItemSelect) onItemSelect(suggestion);
    setOpen(false);
  };

  const handleCreateNew = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (onAddNew) onAddNew(trimmed);
    setOpen(false);
  };

  const hasTypoSuggestion =
    analysis.bestTypoSuggestion !== null &&
    analysis.bestTypoSuggestion.item.name.toLowerCase() !== value.trim().toLowerCase();

  return (
    <div ref={containerRef} className="relative w-full">
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
            <Input
              ref={inputRef}
              id={id}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                if (!open) setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                } else if (e.key === "Enter" && hasTypoSuggestion && e.ctrlKey) {
                  // Ctrl+Enter para autocompletar la sugerencia
                  e.preventDefault();
                  handleApplySuggestion(analysis.bestTypoSuggestion!.item);
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={cn("pr-8", className)}
              autoComplete="off"
              {...props}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                if (!disabled) {
                  setOpen(!open);
                  inputRef.current?.focus();
                }
              }}
              className="absolute right-2.5 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <ChevronsUpDown className="size-4" />
            </button>
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="w-(--radix-popover-trigger-width) p-1 shadow-lg bg-popover text-popover-foreground border border-border/70 rounded-lg max-h-64 overflow-y-auto z-50"
        >
          {/* Tarjeta de corrección "¿Quisiste decir...?" */}
          {hasTypoSuggestion && (
            <div className="mb-1 rounded-md bg-amber-500/10 p-2 text-xs border border-amber-500/20">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                <Sparkles className="size-3.5 shrink-0" />
                <span>¿Quisiste decir?</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleApplySuggestion(analysis.bestTypoSuggestion!.item)
                }
                className="mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left font-semibold text-foreground hover:bg-amber-500/20 transition-colors"
              >
                <span>{analysis.bestTypoSuggestion!.item.name}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Aplicar
                </span>
              </button>
            </div>
          )}

          {/* Opciones de la lista */}
          {analysis.suggestions.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {analysis.suggestions.map(({ item }) => {
                const isSelected =
                  item.name.toLowerCase() === value.trim().toLowerCase();
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left rounded-md transition-colors hover:bg-muted font-medium",
                      isSelected && "bg-muted font-semibold text-signal",
                    )}
                  >
                    <span className="truncate">{item.name}</span>
                    {isSelected && <Check className="size-3.5 shrink-0 text-signal" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-2 px-3 text-center text-xs text-muted-foreground">
              Sin coincidencias exactas
            </div>
          )}

          {/* Opción para registrar nuevo término */}
          {allowAddNew && value.trim() && !analysis.exactMatch && (
            <div className="mt-1 pt-1 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCreateNew}
                className="w-full justify-start gap-1.5 px-2 py-1.5 text-xs font-medium text-signal hover:text-signal hover:bg-signal/10 h-auto"
              >
                <Plus className="size-3.5" />
                <span className="truncate">Añadir &quot;{value.trim()}&quot;</span>
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
