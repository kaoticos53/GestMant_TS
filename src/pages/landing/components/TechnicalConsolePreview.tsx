import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Siren } from "lucide-react";

/**
 * Maqueta ilustrativa del monitor técnico en tiempo real.
 * Se muestra exclusivamente en pantallas de escritorio (`hidden lg:block`),
 * enriqueciendo el Hero sin sobrecargar dispositivos móviles.
 */
export function TechnicalConsolePreview() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
      data-testid="consola-tecnica"
      className="hidden lg:col-span-5 lg:block"
    >
      <div className="rounded-2xl border border-border/70 bg-card/95 p-1 shadow-lg backdrop-blur-xl">
        <div className="flex items-center justify-between rounded-t-xl border-b border-border/70 bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive/80" />
              <span className="size-2.5 rounded-full bg-amber-500/80" />
              <span className="size-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Monitor técnico · Muestra
            </span>
          </div>
          <Badge
            variant="destructive"
            className="gap-1.5 font-mono text-[10px] tracking-wider"
          >
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            ON AIR
          </Badge>
        </div>

        <div className="space-y-2.5 p-3">
          {/* La incidencia que hay ahora mismo en el taller */}
          <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono font-bold text-signal">
                <Siren className="size-3.5" />
                INC-0128
              </span>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                Prioridad alta
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Pérdida de sincronismo SDI en Cadena 2
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Equipo: Cámara de estudio HDC-3500 · Plató Principal
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
              <span>Técnico: A. Morales (guardia)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                En taller
              </span>
            </div>
          </div>

          {/* La petición de repuesto que se resolvió con ella */}
          <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono font-bold text-muted-foreground">
                PET-0043
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Aprobada · stock descontado
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium">
              <span>Cable triaxial SMPTE 311M 50 m</span>
              <span className="font-mono text-foreground">×1 ud</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Almacén: Pasillo B · Estantería 03 · Cajón 12
            </p>
          </div>

          {/* Los dos estudios que están emitiendo */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <span className="truncate font-medium">
                Plató 1 (Informativos)
              </span>
              <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
              <span className="truncate font-medium">
                Unidad Móvil HD 01
              </span>
              <span className="size-2 shrink-0 rounded-full bg-signal" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
