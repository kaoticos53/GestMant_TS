import { api } from "@/convex/_generated/api";
import {
  AI_MAX_CALLS_PER_USER_HOUR,
  ALL_AI_TOOL_MODULES,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_CHAT_MODEL,
  DEFAULT_DEEPSEEK_VISION_MODEL,
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_MODEL,
  type AiSettingsPublicView,
  type AiTasksEnabledConfig,
  type AiToolModule,
} from "@/lib/ai";
import { getErrorMessage } from "@/lib/workshop";
import { useAction, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface AiFormData {
  enabled: boolean;
  baseUrl: string;
  visionModel: string;
  chatModel: string;
  apiKey: string;
  clearApiKey: boolean;
  tasks: AiTasksEnabledConfig;
  rateLimitPerHour: number;
  allowedRoles: string[];
  enabledModules: AiToolModule[];
  embeddingEnabled: boolean;
  embeddingBaseUrl: string;
  embeddingModel: string;
  embeddingApiKey: string;
  clearEmbeddingApiKey: boolean;
}

export const INITIAL_AI_FORM_DATA: AiFormData = {
  enabled: false,
  baseUrl: DEFAULT_DEEPSEEK_BASE_URL,
  visionModel: DEFAULT_DEEPSEEK_VISION_MODEL,
  chatModel: DEFAULT_DEEPSEEK_CHAT_MODEL,
  apiKey: "",
  clearApiKey: false,
  tasks: {
    labelScanner: true,
    incidentQa: true,
    workshopChat: true,
  },
  rateLimitPerHour: AI_MAX_CALLS_PER_USER_HOUR,
  allowedRoles: [],
  enabledModules: [...ALL_AI_TOOL_MODULES],
  embeddingEnabled: false,
  embeddingBaseUrl: DEFAULT_EMBEDDING_BASE_URL,
  embeddingModel: DEFAULT_EMBEDDING_MODEL,
  embeddingApiKey: "",
  clearEmbeddingApiKey: false,
};

/** ¿El formulario difiere de lo guardado? La clave nueva o borrarla cuentan. */
export function isAiFormDirty(current: AiFormData, saved: AiFormData): boolean {
  if (
    current.apiKey.trim() !== "" ||
    current.clearApiKey ||
    current.embeddingApiKey.trim() !== "" ||
    current.clearEmbeddingApiKey
  ) {
    return true;
  }
  const comparable = (data: AiFormData) =>
    JSON.stringify({
      enabled: data.enabled,
      baseUrl: data.baseUrl.trim(),
      visionModel: data.visionModel.trim(),
      chatModel: data.chatModel.trim(),
      tasks: data.tasks,
      rateLimitPerHour: data.rateLimitPerHour,
      allowedRoles: [...data.allowedRoles].sort(),
      enabledModules: [...data.enabledModules].sort(),
      embeddingEnabled: data.embeddingEnabled,
      embeddingBaseUrl: data.embeddingBaseUrl.trim(),
      embeddingModel: data.embeddingModel.trim(),
    });
  return comparable(current) !== comparable(saved);
}

export function useAiSettingsForm(settings: AiSettingsPublicView | undefined) {
  const save = useMutation(api.aiSettings.save);
  const testConnection = useAction(api.aiSettings.testConnection);
  const testEmbeddingConnection = useAction(
    api.aiSettings.testEmbeddingConnection,
  );

  const [formData, setFormData] = useState<AiFormData>(INITIAL_AI_FORM_DATA);
  const [baseline, setBaseline] = useState<AiFormData>(INITIAL_AI_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingEmbedding, setTestingEmbedding] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    seeded.current = true;
    const seededData: AiFormData = {
      enabled: settings.enabled,
      baseUrl: settings.baseUrl,
      visionModel: settings.visionModel,
      chatModel: settings.chatModel,
      apiKey: "",
      clearApiKey: false,
      tasks: settings.tasks ?? INITIAL_AI_FORM_DATA.tasks,
      rateLimitPerHour:
        settings.rateLimitPerHour ?? INITIAL_AI_FORM_DATA.rateLimitPerHour,
      allowedRoles: settings.allowedRoles ?? [],
      enabledModules:
        settings.enabledModules ?? [...ALL_AI_TOOL_MODULES],
      embeddingEnabled: settings.embeddingEnabled ?? false,
      embeddingBaseUrl:
        settings.embeddingBaseUrl ?? DEFAULT_EMBEDDING_BASE_URL,
      embeddingModel: settings.embeddingModel ?? DEFAULT_EMBEDDING_MODEL,
      embeddingApiKey: "",
      clearEmbeddingApiKey: false,
    };
    setFormData(seededData);
    setBaseline(seededData);
  }, [settings]);

  const dirty = settings !== undefined && isAiFormDirty(formData, baseline);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const trimmedKey = formData.apiKey.trim();
      const trimmedEmbKey = formData.embeddingApiKey.trim();
      await save({
        enabled: formData.enabled,
        baseUrl: formData.baseUrl.trim() || DEFAULT_DEEPSEEK_BASE_URL,
        visionModel:
          formData.visionModel.trim() || DEFAULT_DEEPSEEK_VISION_MODEL,
        chatModel: formData.chatModel.trim() || DEFAULT_DEEPSEEK_CHAT_MODEL,
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
        clearApiKey: formData.clearApiKey,
        tasks: formData.tasks,
        rateLimitPerHour: Math.min(
          500,
          Math.max(
            1,
            Math.trunc(formData.rateLimitPerHour) || AI_MAX_CALLS_PER_USER_HOUR,
          ),
        ),
        allowedRoles: formData.allowedRoles,
        enabledModules: formData.enabledModules,
        embeddingEnabled: formData.embeddingEnabled,
        embeddingBaseUrl: formData.embeddingBaseUrl.trim(),
        embeddingModel:
          formData.embeddingModel.trim() || DEFAULT_EMBEDDING_MODEL,
        ...(trimmedEmbKey ? { embeddingApiKey: trimmedEmbKey } : {}),
        clearEmbeddingApiKey: formData.clearEmbeddingApiKey,
      });
      setFormData((prev) => ({
        ...prev,
        apiKey: "",
        clearApiKey: false,
        embeddingApiKey: "",
        clearEmbeddingApiKey: false,
      }));
      setBaseline({
        ...formData,
        apiKey: "",
        clearApiKey: false,
        embeddingApiKey: "",
        clearEmbeddingApiKey: false,
      });
      toast.success("Configuración de IA guardada");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [formData, save]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testConnection({});
      if (result.ok) {
        toast.success("Conexión con DeepSeek verificada");
      } else {
        toast.error(result.error || "La prueba de conexión ha fallado");
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }, [testConnection]);

  const handleTestEmbedding = useCallback(async () => {
    setTestingEmbedding(true);
    try {
      const result = await testEmbeddingConnection({});
      if (result.ok) {
        toast.success(
          `Conexión de embeddings verificada (${result.dimensions ?? 1024} dims)`,
        );
      } else {
        toast.error(
          result.error || "La prueba de embeddings ha fallado",
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTestingEmbedding(false);
    }
  }, [testEmbeddingConnection]);

  return {
    formData,
    setFormData,
    dirty,
    saving,
    testing,
    testingEmbedding,
    handleSave,
    handleTest,
    handleTestEmbedding,
  };
}
