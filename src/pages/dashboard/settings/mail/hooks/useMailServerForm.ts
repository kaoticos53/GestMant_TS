import { api } from "@/convex/_generated/api";
import {
  MAIL_PROVIDER_META,
  mailCredentialsWarning,
  mailRelayAddressHint,
  validateMailSettings,
  type MailProvider,
} from "@/lib/mail";
import { getErrorMessage } from "@/lib/workshop";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MailFormData, MailServerSettingsDoc } from "../types";

export const INITIAL_MAIL_FORM_DATA: MailFormData = {
  provider: "vly",
  enabled: true,
  fromName: "Pulso Taller",
  fromEmail: "",
  replyTo: "",
  bcc: "",
  domain: "",
  relayUrl: "",
  smtpUser: "",
  apiKey: "",
  relayToken: "",
  clearApiKey: false,
  clearRelayToken: false,
};

export function useMailServerForm(settings: MailServerSettingsDoc | undefined) {
  const save = useMutation(api.mailSettings.save);
  const [formData, setFormData] = useState<MailFormData>(INITIAL_MAIL_FORM_DATA);
  const [saving, setSaving] = useState(false);

  // El formulario se inicializa con lo guardado una sola vez al cargar
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || settings === undefined) return;
    seeded.current = true;
    setFormData({
      provider: settings.provider,
      enabled: settings.enabled,
      fromName: settings.fromName,
      fromEmail: settings.fromEmail,
      replyTo: settings.replyTo,
      bcc: settings.bcc,
      domain: settings.domain,
      relayUrl: settings.relayUrl,
      smtpUser: settings.smtpUser,
      apiKey: "",
      relayToken: "",
      clearApiKey: false,
      clearRelayToken: false,
    });
  }, [settings]);

  const meta = MAIL_PROVIDER_META[formData.provider];
  const needsKey = meta.fields.includes("apiKey");
  const needsDomain = meta.fields.includes("domain");
  const needsRelay = meta.fields.includes("relayUrl");
  const needsToken = meta.fields.includes("relayToken");
  const needsAccount = meta.fields.includes("smtpUser");
  const smtp = meta.smtp;

  const validation = validateMailSettings({
    provider: formData.provider,
    enabled: formData.enabled,
    fromName: formData.fromName,
    fromEmail: formData.fromEmail,
    replyTo: formData.replyTo,
    bcc: formData.bcc,
    domain: formData.domain,
    relayUrl: formData.relayUrl,
    smtpUser: formData.smtpUser,
  });

  const insecureRelay = mailCredentialsWarning({
    provider: formData.provider,
    relayUrl: formData.relayUrl,
  });

  const relayHint = mailRelayAddressHint(formData.relayUrl);

  const accountHelp =
    formData.provider === "gmail"
      ? "Google no acepta la contraseña de la cuenta: hay que activar la verificación en dos pasos y crear una contraseña de aplicación de 16 letras en la cuenta de Google. El remitente tiene que ser esa misma cuenta, o una dirección que la cuenta tenga verificada, o Google reescribirá la cabecera."
      : formData.provider === "ethereal"
        ? "Ethereal es un buzón de mentira, para probar sin molestar a nadie: se crea una cuenta gratis en ethereal.email y sus mensajes se leen en ethereal.email/messages. Lo que se mande desde aquí no llega a ningún buzón real."
        : null;

  const changeProvider = useCallback((next: MailProvider) => {
    setFormData((prev) => {
      if (next === prev.provider) return prev;
      return {
        ...prev,
        provider: next,
        apiKey: "",
        relayToken: "",
        clearApiKey: false,
        clearRelayToken: false,
      };
    });
  }, []);

  const updateField = useCallback(
    <K extends keyof MailFormData>(field: K, value: MailFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const setEnabled = useCallback((value: boolean) => updateField("enabled", value), [updateField]);
  const setFromName = useCallback((value: string) => updateField("fromName", value), [updateField]);
  const setFromEmail = useCallback((value: string) => updateField("fromEmail", value), [updateField]);
  const setReplyTo = useCallback((value: string) => updateField("replyTo", value), [updateField]);
  const setBcc = useCallback((value: string) => updateField("bcc", value), [updateField]);
  const setDomain = useCallback((value: string) => updateField("domain", value), [updateField]);
  const setRelayUrl = useCallback((value: string) => updateField("relayUrl", value), [updateField]);
  const setSmtpUser = useCallback((value: string) => updateField("smtpUser", value), [updateField]);
  const setApiKey = useCallback((value: string) => updateField("apiKey", value), [updateField]);
  const setRelayToken = useCallback((value: string) => updateField("relayToken", value), [updateField]);
  const setClearApiKey = useCallback((value: boolean) => updateField("clearApiKey", value), [updateField]);
  const setClearRelayToken = useCallback((value: boolean) => updateField("clearRelayToken", value), [updateField]);

  const handleSave = useCallback(async () => {
    if (!validation.ok) return false;
    setSaving(true);
    try {
      await save({
        provider: formData.provider,
        enabled: formData.enabled,
        fromName: formData.fromName,
        fromEmail: formData.fromEmail,
        replyTo: formData.replyTo,
        bcc: formData.bcc,
        domain: formData.domain,
        relayUrl: formData.relayUrl,
        smtpUser: formData.smtpUser,
        ...(formData.apiKey.trim() === "" ? {} : { apiKey: formData.apiKey.trim() }),
        ...(formData.clearApiKey ? { clearApiKey: true } : {}),
        ...(formData.relayToken.trim() === "" ? {} : { relayToken: formData.relayToken.trim() }),
        ...(formData.clearRelayToken ? { clearRelayToken: true } : {}),
      });
      setFormData((prev) => ({
        ...prev,
        apiKey: "",
        relayToken: "",
        clearApiKey: false,
        clearRelayToken: false,
      }));
      toast.success("Ajustes del correo guardados");
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }, [formData, save, validation.ok]);

  const keyStatus = useCallback(
    (saved: MailServerSettingsDoc) => {
      if (formData.provider === "vly") {
        return saved.envConfigured
          ? `La pasarela usa la clave del deployment (${saved.envVar}).`
          : `La pasarela necesita ${saved.envVar} en el deployment: sin ella no sale ningún correo.`;
      }
      const secret = meta.secretLabel ?? "La clave";
      if (saved.keySource === "guardada") {
        return `${secret}: hay una guardada (${saved.keyHint}).`;
      }
      if (saved.keySource === "entorno") {
        return `${secret}: no hay guardada; se usa la del servidor (${saved.envVar}).`;
      }
      if (saved.envVar === null) {
        return `${secret}: guárdala aquí; este servicio no se configura por variable del servidor.`;
      }
      return `${secret}: guárdala aquí o define ${saved.envVar} en el servidor.`;
    },
    [formData.provider, meta.secretLabel],
  );

  return {
    formData,
    setFormData,
    saving,
    meta,
    needsKey,
    needsDomain,
    needsRelay,
    needsToken,
    needsAccount,
    smtp,
    validation,
    insecureRelay,
    relayHint,
    accountHelp,
    changeProvider,
    updateField,
    setEnabled,
    setFromName,
    setFromEmail,
    setReplyTo,
    setBcc,
    setDomain,
    setRelayUrl,
    setSmtpUser,
    setApiKey,
    setRelayToken,
    setClearApiKey,
    setClearRelayToken,
    handleSave,
    keyStatus,
  };
}
