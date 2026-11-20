import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import {
  AI_VARIABLE_CATALOG,
  DEFAULT_AI_PROMPTS,
  PROTECTED_OUTPUT_CONTRACTS,
  type AiTaskId,
  type AiTaskParamConfig,
} from "@/lib/ai";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Lock, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const TASK_META: Array<{ id: AiTaskId; label: string }> = [
  { id: "workshop_chat", label: "Chat global" },
  { id: "incident_qa", label: "Asistente de incidencias" },
  { id: "label_scanner", label: "Escáner de etiquetas" },
];

const DEFAULT_PARAMS: Record<AiTaskId, AiTaskParamConfig> = {
  label_scanner: { temperature: 0.1, maxTokens: 1600 },
  incident_qa: { temperature: 0.1, maxTokens: 900 },
  workshop_chat: { temperature: 0.2, maxTokens: 1200 },
};

export function AiPromptsCard() {
  const settings = useQuery(api.aiSettings.settings);
  const save = useMutation(api.aiSettings.save);

  const [selectedTask, setSelectedTask] = useState<AiTaskId>("workshop_chat");
  const [draftOverrides, setDraftOverrides] =
    useState<Record<AiTaskId, AiTaskParamConfig> | null>(null);
  const [saving, setSaving] = useState(false);

  const taskParams = draftOverrides ?? settings?.taskParams ?? DEFAULT_PARAMS;

  const setTaskParams = (
    updater: (
      prev: Record<AiTaskId, AiTaskParamConfig>,
    ) => Record<AiTaskId, AiTaskParamConfig>,
  ) => {
    setDraftOverrides((prev) =>
      updater(prev ?? settings?.taskParams ?? DEFAULT_PARAMS),
    );
  };

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" />
            Prompts y variables de IA
          </CardTitle>
          <CardDescription>Cargando prompts de IA...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const current = taskParams[selectedTask];
  const activePromptValue =
    current.customPrompt !== undefined
      ? current.customPrompt
      : DEFAULT_AI_PROMPTS[selectedTask];

  const updateCurrent = (patch: Partial<AiTaskParamConfig>) => {
    setTaskParams((prev) => ({
      ...prev,
      [selectedTask]: {
        ...prev[selectedTask],
        ...patch,
      },
    }));
  };

  const insertVariable = (varKey: string) => {
    const token = `{{${varKey}}}`;
    const base = activePromptValue;
    const next = base.endsWith(" ") || base.endsWith("\n")
      ? `${base}${token}`
      : `${base} ${token}`;
    updateCurrent({ customPrompt: next });
  };

  const restoreDefault = () => {
    updateCurrent({
      ...DEFAULT_PARAMS[selectedTask],
      customPrompt: undefined,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({
        enabled: settings.enabled,
        baseUrl: settings.baseUrl,
        visionModel: settings.visionModel,
        chatModel: settings.chatModel,
        tasks: settings.tasks,
        rateLimitPerHour: settings.rateLimitPerHour,
        allowedRoles: settings.allowedRoles,
        enabledModules: settings.enabledModules,
        taskParams,
      });
      toast.success("Prompts y parámetros de IA guardados");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          Prompts y variables de IA
        </CardTitle>
        <CardDescription>
          Personaliza las instrucciones del modelo por tarea e inserta variables
          dinámicas. El formato JSON de respuesta queda protegido para no romper
          la aplicación.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {TASK_META.map((task) => (
            <Button
              key={task.id}
              type="button"
              size="sm"
              variant={selectedTask === task.id ? "default" : "outline"}
              onClick={() => setSelectedTask(task.id)}
            >
              {task.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt-temperature">Temperatura (0 - 1)</Label>
            <Input
              id="ai-prompt-temperature"
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={current.temperature}
              onChange={(e) =>
                updateCurrent({
                  temperature: Math.min(
                    1,
                    Math.max(0, Number(e.target.value) || 0),
                  ),
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt-max-tokens">Máximo de tokens</Label>
            <Input
              id="ai-prompt-max-tokens"
              type="number"
              min={100}
              max={4096}
              value={current.maxTokens}
              onChange={(e) =>
                updateCurrent({
                  maxTokens: Math.min(
                    4096,
                    Math.max(100, Number(e.target.value) || 900),
                  ),
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="ai-prompt-editor">
              Instrucciones del sistema (editables)
            </Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={restoreDefault}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Restaurar por defecto
            </Button>
          </div>
          <Textarea
            id="ai-prompt-editor"
            rows={7}
            className="font-mono text-xs"
            value={activePromptValue}
            onChange={(e) => updateCurrent({ customPrompt: e.target.value })}
          />
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium">
            Variables disponibles (haz clic para insertar en el prompt; también
            se pueden usar en el chat):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AI_VARIABLE_CATALOG.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant="outline"
                title={`${item.label}: ${item.description} (ej. ${item.example})`}
                className="h-7 px-2 font-mono text-[11px]"
                onClick={() => insertVariable(item.key)}
              >
                {`{{${item.key}}}`}
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  {item.scope}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-dashed bg-muted/30 p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Lock className="size-3.5" />
            <span>Contrato JSON protegido (anexado automáticamente)</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
            {PROTECTED_OUTPUT_CONTRACTS[selectedTask]}
          </pre>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar prompts y parámetros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
