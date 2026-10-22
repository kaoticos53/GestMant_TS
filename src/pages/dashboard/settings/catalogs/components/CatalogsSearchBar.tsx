import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface CatalogsSearchBarProps {
  search: string;
  catalogLabel: string;
  totalCount: number;
  onSearchChange: (value: string) => void;
}

export function CatalogsSearchBar({
  search,
  catalogLabel,
  totalCount,
  onSearchChange,
}: CatalogsSearchBarProps) {
  const labelLower = catalogLabel.toLowerCase();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`Buscar en ${labelLower}...`}
          className="pl-8 text-xs h-9"
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {totalCount} {labelLower} en el catálogo
      </span>
    </div>
  );
}
