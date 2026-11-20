import { api } from "@/convex/_generated/api";
import type { AiSettingsPublicView } from "@/lib/ai";
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
}

export const INITIAL_AI_FORM_DATA: AiFormData = {
  enabled: false,
  baseUrl: "https://api.deepseek.com",
  visionModel: "deepseek-chat",
  chatModel: "deepseek-chat",
  apiKey: "",
  clearApiKey: false,
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
    });
  }, [settings]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const trimmedKey = formData.apiKey.trim();
      await save({
        enabled: formData.enabled,
        baseUrl: formData.baseUrl.trim() || "https://api.deepseek.com",
        visionModel: formData.visionModel.trim() || "deepseek-chat",
        chatModel: formData.chatModel.trim() || "deepseek-chat",
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
        clearApiKey: formData.clearApiKey,
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
