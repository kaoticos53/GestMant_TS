import { Badge } from "@/components/ui/badge";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { History, Search } from "lucide-react";
import { CHANGELOG_CATEGORY_OPTIONS } from "../helpers";
import type { ChangelogHeaderProps } from "../types";

export function ChangelogHeader({
  fullVersion,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
}: ChangelogHeaderProps) {
  return (
    <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <History className="size-4" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Bitácora de cambios entre versiones
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Historial cronológico de entregas, novedades y evolución técnica
              de Pulso Taller
            </DialogDescription>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-mono font-normal">
          {fullVersion}
        </Badge>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por versión, módulo o término..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {CHANGELOG_CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              type="button"
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </DialogHeader>
  );
}
