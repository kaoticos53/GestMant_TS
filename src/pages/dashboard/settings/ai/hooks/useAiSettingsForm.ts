import { api } from "@/convex/_generated/api";
import {
  AI_MAX_CALLS_PER_USER_HOUR,
  ALL_AI_TOOL_MODULES,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_CHAT_MODEL,
  DEFAULT_DEEPSEEK_VISION_MODEL,
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
};

export function useAiSettingsForm(settings: AiSettingsPublicView | undefined) {
  const save = useMutation(api.aiSettings.save);
  const testConnection = useAction(api.aiSettings.testConnection);

  const [formData, setFormData] = useState<AiFormData>(INITIAL_AI_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    seeded.current = true;
    setFormData({
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
    });
  }, [settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const trimmedKey = formData.apiKey.trim();
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
      });
      setFormData((prev) => ({
        ...prev,
        apiKey: "",
        clearApiKey: false,
      }));
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

  return {
    formData,
    setFormData,
    saving,
    testing,
    handleSave,
    handleTest,
  };
}
