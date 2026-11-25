import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  keywords?: string;
  hint?: string;
}

export interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerId?: string;
}

/**
 * Selector buscable (`Combobox`) reutilizable sobre `Popover` y `Command`
 * para listas largas de equipos, repuestos o destinos.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados",
  ariaLabel,
  disabled = false,
  className,
  triggerId,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                const searchValue = opt.keywords
                  ? `${opt.label} ${opt.keywords}`
                  : opt.label;
                return (
                  <CommandItem
                    key={opt.value}
                    value={searchValue}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-1 size-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {opt.hint && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {opt.hint}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
