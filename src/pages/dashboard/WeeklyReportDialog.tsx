import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { roleBadgeClassName } from "@/lib/roles";
import { formatDateTime, getErrorMessage } from "@/lib/workshop";
import { WEEKDAY_OPTIONS, weekdayLabel } from "@/lib/weeklyReport";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Resumen semanal por correo: lo que se trabajó, lo que quedó sin constancia y
 * lo que se archivó. Aquí se enciende, se elige el día y los roles que lo
 * reciben, se ve el correo que saldría y se puede mandar en el momento. El
 * envío automático lo hace el cron del backend el día elegido.
 */
export function WeeklyReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const settings = useQuery(api.weeklyReport.settings);
  const roleOptions = useQuery(api.weeklyReport.roleOptions);
  const preview = useQuery(api.weeklyReport.preview);
  const history = useQuery(api.weeklyReport.history);
  const saveSettings = useMutation(api.weeklyReport.setSettings);
  const sendNow = useAction(api.weeklyReport.sendNow);

  const [enabled, setEnabled] = useState(true);
  const [weekday, setWeekday] = useState(String(WEEKDAY_OPTIONS[0].value));
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Los ajustes guardados rellenan el formulario al abrir, una sola vez.
  const seeded = useRef(false);
  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current || settings === undefined) return;
    setEnabled(settings.enabled);
    setWeekday(String(settings.weekday));
    setRoleKeys(settings.roleKeys);
    seeded.current = true;
  }, [open, settings]);

  const knownRoleKeys = (roleOptions ?? []).map((option) => option.key);
  const audience = roleKeys.filter((key) => knownRoleKeys.includes(key));
  const recipients = preview?.recipients ?? [];

  const toggleRole = (key: string, checked: boolean) =>
    setRoleKeys((current) =>
      checked
        ? current.includes(key)
          ? current
          : [...current, key]
        : current.filter((item) => item !== key),
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        enabled,
        weekday: Number(weekday),
        roleKeys: audience,
      });
      toast.success("Ajustes del resumen guardados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendNow({});
      if (result.status === "sent") {
        toast.success(
          `Resumen enviado a ${result.recipients.length} ${
            result.recipients.length === 1 ? "persona" : "personas"
          }`,
        );
      } else {
        toast.error(result.error ?? "No se pudo enviar el resumen");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resumen semanal del taller</DialogTitle>
          <DialogDescription>
            Un correo a la semana con lo que se trabajó, lo que lleva días en
            curso sin que su técnico anote nada y lo que se fue al archivo. Sale
            solo el día que elijas; desde aquí también puedes mandarlo ahora.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Encendido y día del envío */}
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border/70 p-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={enabled}
                aria-label="Enviar el resumen cada semana"
                onCheckedChange={setEnabled}
                disabled={settings === undefined}
              />
              <div>
                <p className="text-sm font-medium">
                  {enabled ? "Resumen activado" : "Resumen apagado"}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {enabled
                    ? `Se envía los ${weekdayLabel(Number(weekday)).toLowerCase()} por la mañana (07:00 UTC).`
                    : "Mientras esté apagado no se envía nada; el botón de enviar ahora sigue disponible."}
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="resumen-dia"
                className="text-xs text-muted-foreground"
              >
                Día del envío
              </Label>
              <Select
                value={weekday}
                disabled={settings === undefined}
                onValueChange={setWeekday}
              >
                <SelectTrigger id="resumen-dia" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* A quién le llega */}
          <div className="grid gap-2">
            <Label className="text-sm">A qué roles les llega</Label>
            {roleOptions === undefined ? (
              <Skeleton className="h-24 rounded-lg" />
            ) : (
              <ul className="grid max-h-56 gap-1.5 overflow-y-auto pr-1">
                {roleOptions.map((option) => (
                  <li
                    key={option.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {option.label}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClassName(option.key)}`}
                        >
                          {option.key}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <Switch
                      checked={roleKeys.includes(option.key)}
                      disabled={saving}
                      aria-label={`Enviar el resumen a ${option.label}`}
                      onCheckedChange={(checked) =>
                        toggleRole(option.key, checked)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              {recipients.length === 0
                ? "Ninguna persona en activo de esos roles tiene correo: así no saldría el resumen."
                : `${recipients.length} ${
                    recipients.length === 1
                      ? "persona recibe"
                      : "personas reciben"
                  } el resumen: ${recipients.join(", ")}.`}
              {settings?.lastSentAt
                ? ` Último envío: ${formatDateTime(settings.lastSentAt)}.`
                : ""}
            </p>
          </div>

          {/* El correo que saldría */}
          <div className="grid gap-2">
            <Label className="text-sm">El correo que saldría ahora</Label>
            {preview === undefined ? (
              <Skeleton className="h-40 rounded-lg" />
            ) : (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                <p className="text-sm font-medium">{preview.subject}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Semana del {preview.windowLabel} · {preview.counts.touched}{" "}
                  incidencias con movimiento · {preview.counts.withoutTrace} sin
                  constancia · {preview.counts.archived} al archivo
                </p>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                  {preview.text}
                </pre>
              </div>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              La vista previa usa los ajustes ya guardados.
            </p>
          </div>

          {/* Lo que ha salido otras semanas */}
          {history !== undefined && history.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-sm">Últimos envíos</Label>
              <ul className="grid gap-1.5">
                {history.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs"
                  >
                    <span className="font-medium">{item.subject}</span>
                    <span
                      className={
                        item.status === "sent"
                          ? "text-emerald-700"
                          : "text-destructive"
                      }
                    >
                      {item.status === "sent"
                        ? `Enviado a ${item.recipients.length}`
                        : "No salió"}
                      {item.sentAt ? ` · ${formatDateTime(item.sentAt)}` : ""}
                    </span>
                    {item.error && (
                      <span className="w-full text-muted-foreground">
                        {item.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={sending || settings === undefined}
            onClick={() => void handleSend()}
          >
            {sending ? "Enviando..." : "Enviar ahora"}
          </Button>
          <Button
            type="button"
            disabled={
              saving || settings === undefined || roleOptions === undefined
            }
            onClick={() => void handleSave()}
          >
            {saving ? "Guardando..." : "Guardar ajustes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
