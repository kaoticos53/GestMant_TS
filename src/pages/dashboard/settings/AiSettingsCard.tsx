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
import type { AiKeySource } from "@/lib/ai";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
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

export function AiSettingsCard() {
  const settings = useQuery(api.aiSettings.settings);
  const { formData, setFormData, saving, testing, handleSave, handleTest } =
    useAiSettingsForm(settings);

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

  const sourceMeta = KEY_SOURCE_LABELS[settings.keySource];

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
              Reconocimiento de etiquetas de equipos y asistente de incidencias
              solo para miembros autenticados del taller.
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

      <CardContent className="space-y-5">
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
              placeholder="https://api.deepseek.com"
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
              placeholder="deepseek-chat"
            />
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
