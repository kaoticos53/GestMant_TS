import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface EquipmentModelsSearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalModels: number;
}

export function EquipmentModelsSearchBar({
  search,
  onSearchChange,
  totalModels,
}: EquipmentModelsSearchBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por marca, modelo o designación..."
          className="pl-8 text-xs h-9"
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {totalModels} modelo(s) registrado(s)
      </span>
    </div>
  );
}
