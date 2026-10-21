import { Kbd } from "@/components/ui/kbd";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { richDocToPlainText } from "@/lib/richDoc";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_META,
  STATUS_META,
  equipmentLabel,
  looksLikeIncidentReference,
  normalizeIncidentReference,
} from "@/lib/workshop";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import {
  Archive,
  Boxes,
  ClipboardList,
  Cpu,
  ScanLine,
  Search,
  Siren,
} from "lucide-react";
import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Resultado de la búsqueda global: el módulo al que navega y qué abrir.
 *
 * La incidencia y la petición llevan si están archivadas: se siguen
 * encontrando —lo que se busca cuando algo lleva tiempo cerrado— pero no se
 * abren en su cola, porque allí ya no están, sino en el archivo y en solo
 * lectura.
 */
export type SearchHit =
  | {
      kind: "incident";
      id: Id<"incidents">;
      title: string;
      subtitle: string;
      archived: boolean;
    }
  | {
      kind: "request";
      id: Id<"partRequests">;
      title: string;
      subtitle: string;
      archived: boolean;
    }
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
  /** «archive» no es un tipo de ficha: es el grupo de lo que ya no está en la cola. */
  kind: SearchHit["kind"] | "archive";
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
}: {
  /** Solo responsable/admin acceden al catálogo: no se busca lo que no ven. */
  canSearchCatalog?: boolean;
  onSelect: (hit: SearchHit) => void;
  className?: string;
}) {
  // Lo que se busca lo carga el buscador: está en la cabecera y tiene que ver
  // todo el taller —también lo archivado, que es lo que se busca cuando algo
  // lleva tiempo cerrado—, así que no puede pedírselo a la pestaña que haya
  // abierta. Lo que no se puede ver no se busca: el catálogo y los equipos solo
  // se piden a quien los tiene (el backend tampoco le contestaría).
  // La lista vacía de mientras carga se guarda en su propio `useMemo`: si se
  // escribiera `?? []` en el cuerpo, cada render tendría una lista nueva y el
  // filtro de abajo se recalcularía sin que haya cambiado nada.
  // El buscador no descarga el taller hasta que alguien lo usa: vive en la barra
  // lateral y se monta en cada pantalla, así que pedir todas las incidencias y
  // peticiones —también las archivadas— nada más entrar anulaba el resumen
  // contado del panel. Hasta el primer foco, las consultas se saltan.
  const [engaged, setEngaged] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const consultaIncidencias = useQuery(
    api.incidents.list,
    engaged ? { includeArchived: true } : "skip",
  );
  const consultaPeticiones = useQuery(
    api.partRequests.list,
    engaged ? { includeArchived: true } : "skip",
  );
  const consultaRepuestos = useQuery(
    api.spareParts.list,
    engaged && canSearchCatalog ? {} : "skip",
  );
  const consultaEquipos = useQuery(
    api.equipment.list,
    engaged && canSearchCatalog ? {} : "skip",
  );
  const incidents = useMemo(
    () => consultaIncidencias ?? [],
    [consultaIncidencias],
  );
  const requests = useMemo(
    () => consultaPeticiones ?? [],
    [consultaPeticiones],
  );
  const parts = useMemo(() => consultaRepuestos ?? [], [consultaRepuestos]);
  const equipment = useMemo(() => consultaEquipos ?? [], [consultaEquipos]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘/Ctrl + K lleva el foco al buscador desde cualquier pantalla: es el atajo
  // que se espera en un panel y ahorra recorrer el menú para buscar algo.
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setEngaged(true);
      setOpen(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

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

    const requestHits: Extract<SearchHit, { kind: "request" }>[] = requests
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
        kind: "request" as const,
        id: request._id,
        title: request.reference,
        subtitle: `${STATUS_META[request.status]?.label ?? STATUS_META.pending.label} · ${request.requesterName}${
          request.equipment ? ` · ${request.equipment}` : ""
        }`,
        archived: request.archivedAt !== undefined,
      }));

    // Las incidencias se buscan también por su referencia —el número que se le
    // da a quien la notifica—, y no solo por texto: «inc-4», «INC-4» y «4»
    // encuentran la misma ficha, igual que en la consulta de invitado. Solo
    // cuando lo escrito tiene forma de referencia: si no, «PET-0014» —una
    // petición— sacaba también la incidencia 14, que no tiene nada que ver.
    const reference = looksLikeIncidentReference(query.trim())
      ? normalizeIncidentReference(query.trim())
      : null;
    const incidentHits: Extract<SearchHit, { kind: "incident" }>[] = incidents
      .filter(
        (incident) =>
          (reference !== null && incident.reference === reference) ||
          [
            incident.reference,
            incident.equipmentKind ?? "",
            incident.model ?? "",
            incident.serialNumber ?? "",
            incident.location ?? "",
            incident.reporterName,
            richDocToPlainText(incident.description),
          ].some((value) => includesQuery(value, q)),
      )
      .slice(0, MAX_PER_GROUP)
      .map((incident) => ({
        kind: "incident" as const,
        id: incident._id,
        title: incident.reference,
        subtitle: [
          INCIDENT_STATUS_META[incident.status]?.label,
          [incident.equipmentKind, incident.model].filter(Boolean).join(" "),
          incident.location,
        ]
          .filter(Boolean)
          .join(" · "),
        archived: incident.archivedAt !== undefined,
      }));

    // Lo archivado va en su propio grupo: no se abre donde el resto —su cola ya
    // no lo tiene—, sino en el archivo y en solo lectura. Mezclado con la cola,
    // elegir una ficha archivada llevaba a un módulo donde no aparecía.
    const archivedHits: SearchHit[] = [...incidentHits, ...requestHits].filter(
      (hit) => hit.archived,
    );

    const result: SearchGroup[] = [
      {
        kind: "incident",
        label: "Incidencias",
        icon: Siren,
        hits: incidentHits.filter((hit) => !hit.archived),
      },
      {
        kind: "request",
        label: "Peticiones",
        icon: ClipboardList,
        hits: requestHits.filter((hit) => !hit.archived),
      },
      {
        kind: "archive",
        label: "Archivo · solo lectura",
        icon: Archive,
        hits: archivedHits,
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
  }, [query, incidents, requests, parts, equipment, canSearchCatalog]);

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
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => {
          setEngaged(true);
          setQuery(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          setEngaged(true);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
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
          onClick={() => {
            setEngaged(true);
            setScannerOpen(true);
          }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title="Escanear código QR o barras"
          aria-label="Escanear código QR o barras"
        >
          <ScanLine className="size-4" />
        </button>
      </div>

      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={(code) => {
          setEngaged(true);
          setQuery(code);
          setActiveIndex(0);
          setOpen(true);
          inputRef.current?.focus();
        }}
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
