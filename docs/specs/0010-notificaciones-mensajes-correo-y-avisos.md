# SPEC-0010 — Notificaciones, Mensajería, Correo Saliente y Avisos

- **ID:** `SPEC-0010`
- **Título:** Avisos in-app, mensajería interna, correo saliente, alertas por rol y resumen semanal
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/notifications.ts`, `src/convex/messages.ts`, `src/convex/mailSettings.ts`, `src/convex/mailLog.ts`, `src/convex/_mail/deliver.ts`, `src/convex/alerts.ts`, `src/convex/auditAlerts.ts`, `src/convex/weeklyReport.ts`, `src/lib/mail.ts`, `src/lib/workAlert.ts`, `src/lib/weeklyReport/*`, `scripts/mail-relay.mjs`, `src/components/NotificationBell.tsx`, `src/components/MessagesCenter.tsx`

---

## 1. Contexto y Objetivos

Articula toda la comunicación interna y externa del taller: campana de avisos in-app (`notifications`), mensajería directa entre miembros (`messages`), envío de correos mediante múltiples proveedores (`vly`, `gmail`, `ethereal`, `relay` SMTP local), avisos de trabajo sin constancia, alertas de auditoría y resumen semanal automático.

---

## 2. Modelo de Dominio

- **`notifications`:** avisos por usuario con marca de lectura y enlace opcional a `incidentId`.
- **`messages`:** hilos entre `senderId` y `recipientId` con estado leído.
- **`mailSettings` / `mailLog`:** proveedor activo, credenciales cifradas (`secretCrypto.ts`), estado de último test e historial de envíos.
- **`alertSettings`, `auditAlertSettings`, `reportSettings`, `weeklyReports`:** audiencias por rol para avisos de incidencias sin constancia (`workAlert`), eventos de seguridad y resumen semanal.

---

## 3. Requisitos Funcionales

- **RF-001 (Avisos in-app):** `NotificationBell` lista avisos del usuario, permite marcar leído individual o masivamente y navegar a la incidencia asociada.
- **RF-002 (Mensajería interna):** `MessagesCenter` permite conversar entre miembros activos (`contacts`, `thread`, `send`, `markThreadRead`).
- **RF-003 (Correo saliente y relay SMTP):** `mailSettings` soporta envío vía Resend/Vly, Gmail (contraseña de aplicación), Ethereal (pruebas) y relay HTTP-SMTP (`scripts/mail-relay.mjs`), con prueba de conexión (`check`) y envío de prueba (`sendTest`).
- **RF-004 (Resumen semanal y alertas):** Cron diario `07:00` UTC (`weeklyReport.runScheduled`) que envía el balance semanal el día configurado; `workAlert` avisa cuando un equipo lleva días sin constancia de trabajo.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** Los secretos de correo (`apiKey`, `relayToken`, contraseña SMTP) se cifran con `secretCrypto.ts` y nunca vuelven al navegador.
- **RN-002:** Las cuentas invitadas o dadas de baja no reciben ni pueden enviar mensajes.

---

## 5. Permisos y Seguridad

- Enviar mensajes: `sendMessages`.
- Configurar correo, alertas y resumen semanal: `admin` / capacidades administrativas en Ajustes.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Todo envío de correo queda registrado en `mailLog` con estado y eventual error para diagnóstico.

---

## 7. Interfaz de Usuario

- `NotificationBell.tsx` y `MessagesCenter.tsx` en `SidebarHeader` y `DashboardHeader`.
- `MailServerCard.tsx`, `MailAudienceCard.tsx`, `WorkAlertSettingsCard.tsx`, `AuditAlertSettingsCard.tsx` en Ajustes.
- `WeeklyReportDialog` en Incidencias/Dashboard.

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Cifrado de credenciales de correo**
  - **Dado** un administrador que guarda una clave SMTP o token de relay en `mailSettings.save`
  - **Cuando** consulta `mailSettings.settings`
  - **Entonces** recibe la pista enmascarada y nunca el secreto en claro

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001 | Avisos in-app | `tests/notificationBell.test.tsx`, `tests/notificationBellHelpers.test.ts` |
| RF-002 | Mensajería interna | `tests/messages.test.ts`, `tests/messagesCenter.test.tsx`, `tests/messagesHooks.test.ts` |
| RF-003, CA-001 | Correo y relay SMTP | `tests/mailSettings.test.ts`, `tests/mailRelay.test.ts`, `tests/mailServerCard.test.tsx`, `tests/mailAudienceCard.test.tsx` |
| RF-004 | Alertas y resumen semanal | `tests/alerts.test.ts`, `tests/auditAlerts.test.ts`, `tests/workAlert.test.ts`, `tests/weeklyReport.test.ts`, `tests/weeklyReportBackend.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en este módulo.
