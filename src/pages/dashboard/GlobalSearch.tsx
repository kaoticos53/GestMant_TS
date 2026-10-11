import type { Doc, Id } from "@/convex/_generated/dataModel";
import { richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import { STATUS_META, equipmentLabel } from "@/lib/workshop";
import { Boxes, ClipboardList, Cpu, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Tipos tolerantes (campos opcionales/nulos según lleguen de Convex en caliente)
type SearchRequest = {
  _id: Id<"partRequests">;
  reference: string;
  requesterName: string;
  requesterTeam?: string | null;
  equipment?: string | null;
  description?: string | null;
  lines?: { code: string; name: string }[] | null;
  status: Doc<"partRequests">["status"];
};

type SearchPart = {
  _id: Id<"spareParts">;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  partNumber?: string | null;
  supplier?: string | null;
  location?: string | null;
  stock: number;
};

type SearchEquipment = {
  _id: Id<"equipment">;
  code?: string | null;
  brand?: string | null;
  name: string;
  model: string;
  location?: string | null;
  serialNumber?: string | null;
  supplier?: string | null;
};

/** Resultado de la búsqueda global: el módulo al que navega y qué abrir. */
export type SearchHit =
  | { kind: "request"; id: Id<"partRequests">; title: string; subtitle: string }
  | {
      kind: "part";
      id: Id<"spareParts">;
      term: string;
      title: string;
      subtitle: string;
    }
  | {
      kind: "equipment";
      id: Id<"equipment">;
      term: string;
      title: string;
      subtitle: string;
    };

interface SearchGroup {
  kind: SearchHit["kind"];
  label: string;
  icon: typeof Boxes;
  hits: SearchHit[];
}

const MAX_PER_GROUP = 5;

/** Minúsculas sin acentos para comparar («estación» encuentra "Estacion"). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesQuery(haystack: string, query: string): boolean {
  return normalize(haystack).includes(query);
}

/**
 * Buscador global del taller: peticiones (siempre) y, para quien gestiona el
 * catálogo, repuestos y equipos. Al elegir un resultado, `onSelect` lleva al
 * módulo correspondiente con el elemento abierto o pre-filtrado.
 */
export function GlobalSearch({
  requests = [],
  parts = [],
  equipment = [],
  canSearchCatalog = false,
  onSelect,
  className,
}: {
  requests?: SearchRequest[];
  parts?: SearchPart[];
  equipment?: SearchEquipment[];
  /** Solo responsable/admin acceden al catálogo: no se busca lo que no ven. */
  canSearchCatalog?: boolean;
  onSelect: (hit: SearchHit) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierre al pulsar fuera (suscrito al documento: callback, no setState en
  // el cuerpo del efecto).
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const groups = useMemo<SearchGroup[]>(() => {
    const q = normalize(query.trim());
    if (!q) return [];

    const requestHits: SearchHit[] = requests
      .filter((request) =>
        [
          request.reference,
          request.requesterName,
          request.requesterTeam ?? "",
          request.equipment ?? "",
          // Las descripciones se escriben con el editor: se busca por su texto,
          // no por el documento con formato que se guarda.
          richDocToPlainText(request.description),
          (request.lines ?? [])
            .map((line) => `${line.code} ${line.name}`)
            .join(" "),
        ].some((value) => includesQuery(value, q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map((request) => ({
        kind: "request",
        id: request._id,
        title: request.reference,
        subtitle: `${STATUS_META[request.status]?.label ?? STATUS_META.pending.label} · ${request.requesterName}${
          request.equipment ? ` · ${request.equipment}` : ""
        }`,
      }));

    const result: SearchGroup[] = [
      {
        kind: "request",
        label: "Peticiones",
        icon: ClipboardList,
        hits: requestHits,
      },
    ];

    if (canSearchCatalog) {
      const partHits: SearchHit[] = parts
        .filter((part) =>
          [
            part.code,
            part.name,
            richDocToPlainText(part.description),
            part.category,
            part.partNumber ?? "",
            part.supplier ?? "",
            part.location ?? "",
          ].some((value) => includesQuery(value, q)),
        )
        .slice(0, MAX_PER_GROUP)
        .map((part) => ({
          kind: "part",
          id: part._id,
          term: part.code,
          title: `${part.code} · ${part.name}`,
          subtitle: `${part.category} · stock ${part.stock}${
            part.location ? ` · ${part.location}` : ""
          }`,
        }));

      const equipmentHits: SearchHit[] = equipment
        .filter((item) =>
          [
            item.code ?? "",
            item.brand ?? "",
            item.name,
            item.model,
            item.location ?? "",
            item.serialNumber ?? "",
            item.supplier ?? "",
          ].some((value) => includesQuery(value, q)),
        )
        .slice(0, MAX_PER_GROUP)
        .map((item) => ({
          kind: "equipment",
          id: item._id,
          term: item.code ?? item.model,
          title: equipmentLabel(item),
          subtitle: [item.code, item.serialNumber, item.location]
            .filter(Boolean)
            .join(" · "),
        }));

      result.push(
        { kind: "part", label: "Repuestos", icon: Boxes, hits: partHits },
        { kind: "equipment", label: "Equipos", icon: Cpu, hits: equipmentHits },
      );
    }

    return result.filter((group) => group.hits.length > 0);
  }, [query, requests, parts, equipment, canSearchCatalog]);

  const flatHits = useMemo(
    () => groups.flatMap((group) => group.hits),
    [groups],
  );
  const trimmed = query.trim();
  // El índice destacado se limita al tamaño actual de resultados (si la
  // consulta cambia y hay menos coincidencias, se muestra la última).
  const safeIndex =
    flatHits.length > 0 ? Math.min(activeIndex, flatHits.length - 1) : 0;

  const selectHit = (hit: SearchHit) => {
    onSelect(hit);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (flatHits.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(Math.min(safeIndex + 1, flatHits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(Math.max(safeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = flatHits[safeIndex] ?? flatHits[0];
      if (hit) selectHit(hit);
    }
  };

  let runningIndex = -1;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar peticiones, repuestos..."
        aria-label="Búsqueda global"
        className="h-9 w-full rounded-lg border border-border/70 bg-card pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-signal/50 focus:ring-2 focus:ring-signal/20"
      />

      {open && trimmed.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1.5 shadow-lg">
          {flatHits.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Sin resultados para «{trimmed}»
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="mb-1 last:mb-0">
                <p className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <group.icon className="size-3" />
                  {group.label}
                </p>
                {group.hits.map((hit) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const active = index === safeIndex;
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      onClick={() => selectHit(hit)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active ? "bg-signal/10" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-signal" : "text-foreground",
                        )}
                      >
                        {hit.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
