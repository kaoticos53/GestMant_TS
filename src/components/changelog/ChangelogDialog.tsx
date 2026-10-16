import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAllReleases,
  formatReleaseDate,
  getCategoryLabel,
  type ChangeCategory,
  type Release,
} from "@/lib/changelog";
import { APP_VERSION, FULL_VERSION } from "@/version";
import {
  Sparkles,
  Search,
  Calendar,
  CheckCircle2,
  Wrench,
  Shield,
  AlertCircle,
  Tag,
  History,
  Info,
} from "lucide-react";

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultVersion?: string;
}

export function ChangelogDialog({
  open,
  onOpenChange,
  defaultVersion,
}: ChangelogDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    ChangeCategory | "todas"
  >("todas");

  const releases = useMemo(() => getAllReleases(), []);

  // Filtrado reactivo de versiones y cambios
  const filteredReleases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const result: Release[] = [];

    for (const rel of releases) {
      if (defaultVersion && rel.version !== defaultVersion.replace(/^v/i, "")) {
        if (!query && selectedCategory === "todas") {
          continue;
        }
      }

      const matchesQuery =
        !query ||
        rel.version.toLowerCase().includes(query) ||
        rel.title.toLowerCase().includes(query) ||
        rel.summary.toLowerCase().includes(query) ||
        rel.date.includes(query) ||
        rel.changes.some(
          (c) =>
            c.description.toLowerCase().includes(query) ||
            c.tag?.toLowerCase().includes(query),
        );

      if (!matchesQuery) continue;

      const filteredChanges = rel.changes.filter((c) => {
        if (selectedCategory !== "todas" && c.category !== selectedCategory) {
          return false;
        }
        if (!query) return true;
        return (
          c.description.toLowerCase().includes(query) ||
          c.tag?.toLowerCase().includes(query) ||
          rel.version.toLowerCase().includes(query) ||
          rel.title.toLowerCase().includes(query)
        );
      });

      if (selectedCategory !== "todas" && filteredChanges.length === 0) {
        continue;
      }

      result.push({
        ...rel,
        changes: filteredChanges,
      });
    }

    return result;
  }, [releases, searchQuery, selectedCategory, defaultVersion]);

  const getCategoryIcon = (category: ChangeCategory) => {
    switch (category) {
      case "novedad":
        return <Sparkles className="size-3 text-emerald-500" />;
      case "mejora":
        return <Wrench className="size-3 text-sky-500" />;
      case "correccion":
        return <AlertCircle className="size-3 text-amber-500" />;
      case "seguridad":
        return <Shield className="size-3 text-purple-500" />;
    }
  };

  const getCategoryBadgeClass = (category: ChangeCategory) => {
    switch (category) {
      case "novedad":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
      case "mejora":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20";
      case "correccion":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      case "seguridad":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[88vw] lg:w-[60vw] sm:max-w-[60vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-xl">
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
                  Historial cronológico de entregas, novedades y evolución
                  técnica de Pulso Taller
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-normal">
              {FULL_VERSION}
            </Badge>
          </div>

          {/* Barra de búsqueda y filtros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por versión, módulo o término..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: "todas", label: "Todas" },
                  { id: "novedad", label: "Novedades" },
                  { id: "mejora", label: "Mejoras" },
                  { id: "correccion", label: "Correcciones" },
                  { id: "seguridad", label: "Seguridad" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
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

        {/* Lista cronológica con timeline */}
        <ScrollArea className="flex-1 p-6 overflow-y-auto">
          {filteredReleases.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Info className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No se encontraron cambios</p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Prueba a ajustar la búsqueda o el filtro de categoría.
              </p>
            </div>
          ) : (
            <div className="relative border-l border-border/70 ml-3.5 space-y-8 pl-6 pb-2">
              {filteredReleases.map((release) => {
                const isCurrent = release.version === APP_VERSION;

                return (
                  <div key={release.version} className="relative group">
                    {/* Hito en la línea de tiempo */}
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[31px] top-1 size-3.5 rounded-full border-2 border-background transition-transform ${
                        isCurrent
                          ? "bg-primary ring-4 ring-primary/20 scale-110"
                          : "bg-muted-foreground/40 group-hover:bg-primary/70"
                      }`}
                    />

                    {/* Cabecera de la versión */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold tracking-tight text-foreground">
                          v{release.version}
                        </span>
                        {isCurrent && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold"
                          >
                            Versión actual
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="size-3.5" />
                        <time dateTime={release.date}>
                          {formatReleaseDate(release.date)}
                        </time>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-foreground/90 mt-1">
                      {release.title}
                    </h4>

                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {release.summary}
                    </p>

                    {/* Destacados si los tiene */}
                    {release.highlights && release.highlights.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                        <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block mb-1.5">
                          Puntos clave
                        </span>
                        <ul className="space-y-1">
                          {release.highlights.map((h, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground flex items-start gap-1.5"
                            >
                              <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Lista de cambios categorizados */}
                    <div className="mt-3 space-y-2">
                      {release.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 text-xs p-2 rounded-md hover:bg-muted/30 transition-colors"
                        >
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${getCategoryBadgeClass(
                              change.category,
                            )}`}
                          >
                            {getCategoryIcon(change.category)}
                            {getCategoryLabel(change.category)}
                          </span>

                          {change.tag && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded shrink-0">
                              <Tag className="size-2.5" />
                              {change.tag}
                            </span>
                          )}

                          <span className="text-foreground/80 leading-snug">
                            {change.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pie del diálogo */}
        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>Pulso Taller · Registro de versiones y trazabilidad</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs"
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
