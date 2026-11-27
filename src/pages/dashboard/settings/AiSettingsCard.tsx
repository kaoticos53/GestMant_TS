import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import {
  AI_TOOL_MODULE_LABELS,
  ALL_AI_TOOL_MODULES,
  type AiKeySource,
  type AiToolModule,
} from "@/lib/ai";
import { useState } from "react";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useAiSettingsForm } from "./ai/hooks/useAiSettingsForm";

const KEY_SOURCE_LABELS: Record<AiKeySource, { label: string; tone: string }> = {
  guardada: {
    label: "Guardada en base de datos (cifrada)",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  entorno: {
    label: "Variable de entorno DEEPSEEK_API_KEY",
    tone: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/60",
  },
  ninguna: {
    label: "Sin clave configurada",
    tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60",
  },
};

const ROLE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "admin", label: "Administrador" },
  { key: "manager", label: "Responsable" },
  { key: "technician", label: "Técnico" },
];

export function AiSettingsCard() {
  const settings = useQuery(api.aiSettings.settings);
  const liveRoles = useQuery(api.permissions.listRoles);
  const {
    formData,
    setFormData,
    dirty,
    saving,
    testing,
    handleSave,
    handleTest,
  } = useAiSettingsForm(settings);
  useUnsavedChangesGuard(dirty);
  const [rateLimitInput, setRateLimitInput] = useState<string | null>(null);

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Inteligencia artificial (DeepSeek)
          </CardTitle>
          <CardDescription>Cargando configuración de IA...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roleOptions =
    Array.isArray(liveRoles) && liveRoles.length > 0
      ? liveRoles.map((r) => ({ key: r.key, label: r.label }))
      : ROLE_OPTIONS;

  const sourceMeta = KEY_SOURCE_LABELS[settings.keySource];

  const toggleRole = (roleKey: string, checked: boolean) => {
    setFormData((prev) => {
      const next = checked
        ? [...new Set([...prev.allowedRoles, roleKey])]
        : prev.allowedRoles.filter((r) => r !== roleKey);
      return { ...prev, allowedRoles: next };
    });
  };

  const toggleModule = (mod: AiToolModule, checked: boolean) => {
    setFormData((prev) => {
      const next = checked
        ? [...new Set([...prev.enabledModules, mod])]
        : prev.enabledModules.filter((m) => m !== mod);
      return { ...prev, enabledModules: next };
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Inteligencia artificial (DeepSeek)
            </CardTitle>
            <CardDescription className="mt-1">
              Reconocimiento de etiquetas de equipos, asistente de incidencias y
              chat global del taller solo para miembros autenticados.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ai-enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, enabled: checked }))
              }
            />
            <Label htmlFor="ai-enabled" className="text-sm font-medium">
              {formData.enabled ? "Activada" : "Desactivada"}
            </Label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm">
            <KeyRound className="size-4 text-muted-foreground" />
            <span className="font-medium">Estado de la API Key:</span>
            {settings.keyHint ? (
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                {settings.keyHint}
              </code>
            ) : (
              <span className="text-muted-foreground">No definida</span>
            )}
          </div>
          <Badge variant="outline" className={sourceMeta.tone}>
            {sourceMeta.label}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ai-api-key">
              Nueva API Key de DeepSeek (opcional para mantener la actual)
            </Label>
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              placeholder={
                settings.hasKey
                  ? "Dejar vacío para conservar la clave actual"
                  : "sk-..."
              }
              value={formData.apiKey}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  apiKey: e.target.value,
                  clearApiKey: false,
                }))
              }
            />
            {settings.keySource === "guardada" && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={formData.clearApiKey}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      clearApiKey: checked === true,
                      apiKey: checked === true ? "" : prev.apiKey,
                    }))
                  }
                />
                Eliminar clave guardada en base de datos
              </label>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ai-base-url">URL base compatible OpenAI</Label>
            <Input
              id="ai-base-url"
              type="url"
              value={formData.baseUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              placeholder="https://api.deepseek.com/v1"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-vision-model">Modelo de visión / etiquetas</Label>
            <Input
              id="ai-vision-model"
              value={formData.visionModel}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  visionModel: e.target.value,
                }))
              }
              placeholder="deepseek-flash"
            />
            <p className="text-[11px] text-muted-foreground">
              Para leer etiquetas con imagen en DeepSeek usa{" "}
              <code>deepseek-flash</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-chat-model">Modelo de chat / historial</Label>
            <Input
              id="ai-chat-model"
              value={formData.chatModel}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, chatModel: e.target.value }))
              }
              placeholder="deepseek-chat"
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" />
            <span>Capacidades, cuota y permisos de acceso</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={formData.tasks.labelScanner}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    tasks: { ...prev.tasks, labelScanner: checked === true },
                  }))
                }
              />
              Escáner de etiquetas
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={formData.tasks.incidentQa}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    tasks: { ...prev.tasks, incidentQa: checked === true },
                  }))
                }
              />
              Asistente de incidencias
            </label>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={formData.tasks.workshopChat}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    tasks: { ...prev.tasks, workshopChat: checked === true },
                  }))
                }
              />
              Chat global del taller
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-rate-limit">
                Límite de consultas por usuario / hora
              </Label>
              <Input
                id="ai-rate-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                value={rateLimitInput ?? String(formData.rateLimitPerHour)}
                onChange={(e) => {
                  const raw = e.target.value;
                  setRateLimitInput(raw);
                  const parsed = Number.parseInt(raw, 10);
                  if (
                    raw.trim() !== "" &&
                    Number.isFinite(parsed) &&
                    parsed >= 1 &&
                    parsed <= 500
                  ) {
                    setFormData((prev) => ({
                      ...prev,
                      rateLimitPerHour: parsed,
                    }));
                  }
                }}
                onBlur={() => {
                  const raw = rateLimitInput ?? String(formData.rateLimitPerHour);
                  const parsed = Number.parseInt(raw, 10);
                  const clamped =
                    raw.trim() !== "" && Number.isFinite(parsed)
                      ? Math.min(500, Math.max(1, parsed))
                      : 40;
                  setFormData((prev) => ({
                    ...prev,
                    rateLimitPerHour: clamped,
                  }));
                  setRateLimitInput(null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Roles con acceso a la IA (vacío = todos activos)</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {roleOptions.map((role) => (
                  <label
                    key={role.key}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Checkbox
                      checked={formData.allowedRoles.includes(role.key)}
                      onCheckedChange={(checked) =>
                        toggleRole(role.key, checked === true)
                      }
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Módulos consultables por las herramientas del asistente (siempre
              filtrados además por el permiso real del usuario)
            </Label>
            <div className="grid gap-2 pt-1 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_AI_TOOL_MODULES.map((mod) => (
                <label
                  key={mod}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Checkbox
                    checked={formData.enabledModules.includes(mod)}
                    onCheckedChange={(checked) =>
                      toggleModule(mod, checked === true)
                    }
                  />
                  {AI_TOOL_MODULE_LABELS[mod]}
                </label>
              ))}
            </div>
          </div>
        </div>

        {settings.lastTestAt !== null && (
          <div className="flex items-start gap-2 rounded-lg border p-3 text-xs">
            {settings.lastTestOk ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium">
                {settings.lastTestOk
                  ? "Última prueba de conexión correcta"
                  : "Última prueba de conexión fallida"}
              </p>
              {settings.lastTestError && (
                <p className="text-destructive">{settings.lastTestError}</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <span
              role="status"
              className="mr-auto text-xs font-medium text-amber-700 dark:text-amber-300"
            >
              Hay cambios sin guardar
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={testing || saving}
            onClick={() => void handleTest()}
          >
            {testing && <Loader2 className="mr-2 size-4 animate-spin" />}
            Probar conexión
          </Button>
          <Button
            type="button"
            disabled={saving || testing}
            onClick={() => void handleSave()}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
