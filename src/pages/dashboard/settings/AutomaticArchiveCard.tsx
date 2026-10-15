import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import {
  AFTER_MONTHS_OPTIONS,
  DEFAULT_AFTER_MONTHS,
  afterMonthsLabel,
  archivableBefore,
} from "@/lib/archive";
import { monthsAgo } from "@/lib/browse";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Moon, Play } from "lucide-react";
import { toast } from "sonner";

export function AutomaticArchiveCard() {
  // Lo que se llevaría el archivado automático se cuenta sobre las colas vivas,
  // que carga la propia tarjeta: solo hacen falta cuando se enseña, y solo la
  // ve quien puede configurarla.
  const incidents = useQuery(api.incidents.list, {}) ?? [];
  const requests = useQuery(api.partRequests.list, {}) ?? [];
  const settings = useQuery(api.archive.settings);
  const saveSettings = useMutation(api.archive.setSettings);
  const runNow = useMutation(api.archive.runNow);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Antigüedad guardada; mientras carga vale la de partida.
  const autoMonths = settings?.afterMonths ?? DEFAULT_AFTER_MONTHS;
  const autoCutoff = monthsAgo(autoMonths);
  const pending = archivableBefore({
    incidents,
    requests,
    before: autoCutoff,
  });
  // El valor guardado manda: el selector enseña lo que hay, aunque no sea una
  // de las antigüedades habituales.
  const autoOptions = AFTER_MONTHS_OPTIONS.some(
    (option) => option.months === autoMonths,
  )
    ? AFTER_MONTHS_OPTIONS
    : [
        { months: autoMonths, label: afterMonthsLabel(autoMonths) },
        ...AFTER_MONTHS_OPTIONS,
      ];

  /** Guarda el automático (interruptor y antigüedad van juntos). */
  const handleSaveSettings = async (next: {
    enabled: boolean;
    afterMonths: number;
  }) => {
    setSaving(true);
    try {
      await saveSettings(next);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /** Limpieza inmediata con la antigüedad configurada, sin esperar la noche. */
  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runNow();
      toast.success(
        result.total === 0
          ? "No había nada terminado tan antiguo"
          : `${result.incidents} ${result.incidents === 1 ? "incidencia" : "incidencias"} y ${result.requests} ${result.requests === 1 ? "petición" : "peticiones"} al archivo`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal">
            <Moon className="size-4" />
          </span>
          <div className="max-w-xl">
            <p className="text-sm font-semibold tracking-tight">
              Archivado automático
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Cada noche el taller manda solo al archivo lo que ya está
              terminado —incidencias cerradas y peticiones ya decididas—
              anterior a la antigüedad elegida. No se borra nada: todo sigue en
              el módulo Archivo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs font-medium",
              (settings?.enabled ?? true)
                ? "text-signal"
                : "text-muted-foreground",
            )}
          >
            {settings === undefined
              ? "Cargando..."
              : settings.enabled
                ? "Activado"
                : "Desactivado"}
          </span>
          <Switch
            checked={settings?.enabled ?? true}
            disabled={settings === undefined || saving}
            aria-label="Archivado automático de cada noche"
            onCheckedChange={(checked) =>
              void handleSaveSettings({
                enabled: checked,
                afterMonths: autoMonths,
              })
            }
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label
            htmlFor="ajustes-archivo-antiguedad"
            className="text-xs text-muted-foreground"
          >
            Antigüedad
          </Label>
          <Select
            value={String(autoMonths)}
            disabled={settings === undefined || saving}
            onValueChange={(value) =>
              void handleSaveSettings({
                enabled: settings?.enabled ?? true,
                afterMonths: Number(value),
              })
            }
          >
            <SelectTrigger id="ajustes-archivo-antiguedad" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {autoOptions.map((option) => (
                <SelectItem key={option.months} value={String(option.months)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={running || settings === undefined}
          onClick={() => void handleRunNow()}
        >
          <Play className="size-4" />
          {running
            ? "Archivando..."
            : pending.total > 0
              ? `Ejecutar ahora (${pending.total})`
              : "Ejecutar ahora"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {(settings?.enabled ?? true)
          ? `Corte automático: anterior al ${formatDate(autoCutoff)}`
          : "El automático está apagado: mientras siga así, solo se archiva cuando lo pidas desde el módulo Archivo."}
        {settings?.lastRunAt
          ? ` · última limpieza automática ${formatDateTime(settings.lastRunAt)} (${settings.lastRunArchived ?? 0} ${
              (settings.lastRunArchived ?? 0) === 1 ? "ficha" : "fichas"
            })`
          : " · sin limpiezas automáticas todavía"}
      </p>
    </div>
  );
}
