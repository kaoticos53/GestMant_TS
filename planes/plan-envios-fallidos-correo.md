# Plan de Implementación: Gestión Resiliente de Envíos Fallidos de Correo

**Objetivo:** Evitar que los correos salientes del taller (avisos de incidencias, resúmenes semanales, etc.) se pierdan silenciosamente ante fallos de red, caídas temporales del relevo o errores SMTP, combinando **reintentos automáticos con backoff** (Opción 1), **cola persistente con reenvío manual** (Opción 2) y **notificación interna al administrador** (Opción 3).

---

## Arquitectura General

```
[Mutación / Cron] ──▶ [deliverMailLogged]
                             │
                ┌────────────┴────────────┐
                ▼ (Éxito)                 ▼ (Fallo)
        mailLog (ok: true)      ¿Error transitorio?
                                  ├── SÍ ──▶ mailOutbox (status: "retrying")
                                  │           └─ ctx.scheduler (1m → 5m → 30m)
                                  │                └─ Si agota 3 intentos:
                                  │                     status: "failed" + notifyUsers(admins)
                                  └── NO ──▶ mailOutbox (status: "failed") + notifyUsers(admins)
```

---

## Fase 1: Clasificación Pura de Errores y Política de Reintentos (`src/lib/`)
*Objetivo: Definir en dominio puro qué errores son transitorios, los tiempos de espera y los metadatos de estado de la cola.*

- **Archivos a modificar / crear:**
  - `src/lib/mailRetry.ts` (nuevo módulo puro, sin importar React ni Convex)
- **Acciones específicas:**
  1. **Clasificación de fallos (`classifyMailFailure`):**
     - **Transitorios** (`retryable: true`): errores de red/conexión (`ECONNREFUSED`, `ETIMEDOUT`, `fetch failed`, `No se pudo hablar con el servicio...`), respuestas HTTP `408`, `429`, `500`, `502`, `503`, `504`, o códigos SMTP temporales `4xx`.
     - **Permanentes** (`retryable: false`): correo saliente apagado en ajustes, falta de `VLY_INTEGRATION_KEY` / credenciales, HTTP `400`, `401`, `403`, `404`, `422`, o rechazo SMTP permanente `5xx` (ej. `535`, `550`).
  2. **Política de *backoff* (`MAX_MAIL_ATTEMPTS = 3`, `RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000]`):**
     - Función pura `nextRetryDelayMs(attempt: number): number | null` (1 min, 5 min, 30 min; `null` si ya alcanzó `MAX_MAIL_ATTEMPTS`).
  3. **Metadatos de UI (`OUTBOX_STATUS_META`):**
     - Estados: `"retrying"` (*Reintentando*), `"failed"` (*Fallido*), `"sent"` (*Enviado*), `"discarded"` (*Descartado*).
- **Verificación:**
  - `npm run typecheck`
  - `npx vitest run tests/mailRetry.test.ts tests/arquitectura.test.ts`

---

## Fase 2: Cola `mailOutbox`, Reintentos Automáticos y Notificación al Admin (Backend)
*Objetivo: Persistir los correos fallidos en Convex, programar reintentos automáticos en segundo plano y avisar al administrador cuando un envío quede definitivamente fallido.*

- **Archivos a crear / modificar:**
  - `src/convex/schema.ts`
  - `src/convex/mailOutbox.ts` (nuevo módulo de queries, mutations e internalActions)
  - `src/convex/_mail/deliver.ts`
  - `src/convex/crons.ts`
  - `src/convex/workshopReset.ts`
- **Acciones específicas:**
  1. **Tabla `mailOutbox` en `src/convex/schema.ts`:**
     - Campos: `origin` (`"incidencia" | "equipo" | "resumen" | "prueba"`), `what`, `relatedId` (opcional), `to` (`v.array(v.string())`), `subject`, `text`, `html`, `status` (`"retrying" | "failed" | "sent" | "discarded"`), `attempts` (`v.number()`), `maxAttempts` (`v.number()`), `nextRetryAt` (`v.optional(v.number())`), `lastError` (`v.optional(v.string())`), `lastAttemptAt` (`v.number()`), `createdAt` (`v.number()`).
     - Índices: `.index("by_status_created", ["status", "createdAt"])`, `.index("by_createdAt", ["createdAt"])`, `.index("by_related", ["relatedId"])`.
     - Añadir `"mailOutbox"` a `RESET_TABLES` en `src/convex/workshopReset.ts` (respetando la inmutabilidad de `securityAuditLog`).
  2. **Integración en `deliverMailLogged` (`src/convex/_mail/deliver.ts`):**
     - Cuando `deliverMail` falla (y no es un reintento ya en curso ni un envío de tipo `"prueba"` si se prefiere evitar ruido, o configurable):
       - Clasifica el error con `classifyMailFailure(result.error)`.
       - Encola en `mailOutbox` mediante `internal.mailOutbox.enqueueFailure`.
       - Si es transitorio, `enqueueFailure` programa `internal.mailOutbox.attemptSend` con `ctx.scheduler.runAfter(delayMs, ...)`.
       - Si es permanente (o al agotar `MAX_MAIL_ATTEMPTS`), marca `status: "failed"` y llama a `notifyAdminsOfMailFailure(ctx, ...)` usando `notifyUsers` (`src/convex/notify.ts`) para avisar a los administradores activos.
  3. **Mutaciones y acciones de gestión en `src/convex/mailOutbox.ts`:**
     - `list` (`query` protegida con `requireAdmin`): devuelve los envíos en `"retrying"` y `"failed"` ordenados por fecha descendente.
     - `retryOne` y `retryAllFailed` (`mutation` protegida con `secureMutation` / `requireAdmin`): cambian el estado a `"retrying"`, reinician el contador si procede y programan `internal.mailOutbox.attemptSend` de inmediato (`runAfter(0, ...)`).
     - `discard` (`mutation` protegida con `secureMutation` / `requireAdmin`): marca un envío fallido como `"discarded"` para sacarlo de la bandeja de pendientes.
     - `purgeOld` (`internalMutation` llamada desde `crons.ts`): limpia entradas `"sent"` o `"discarded"` con más de 14 días.
- **Verificación:**
  - `npm run typecheck`
  - `npx vitest run tests/mailOutbox.test.ts tests/crons.test.ts tests/workshopReset.test.ts tests/seguridad.test.ts tests/arquitectura.test.ts`

---

## Fase 3: Interfaz de Gestión y Reenvío Manual (`MailLogViewer` y Ficha de Incidencia)
*Objetivo: Dar visibilidad inmediata al administrador sobre los envíos en reintento o fallidos y permitir reenviarlos o descartarlos con un clic.*

- **Archivos a modificar:**
  - `src/pages/dashboard/settings/mail/components/MailLogViewer.tsx`
  - `src/pages/dashboard/settings/MailServerCard.tsx` (o componente contenedor que consulta `api.mailLog.history` y `api.mailOutbox.list`)
  - (Opcional) Banner/acción rápida en la ficha de incidencia cuando `incident.emailError` esté presente y exista una entrada pendiente/fallida en `mailOutbox` para esa incidencia.
- **Acciones específicas:**
  1. **Sección / Pestaña «Cola de fallidos y reintentos» en `MailLogViewer.tsx`:**
     - Mostrar contador de correos en `"retrying"` / `"failed"`.
     - Por cada correo fallido: mostrar destinatarios, asunto, nº de intentos (`2/3`), próximo reintento (si aplica), último error y botones **Reintentar** y **Descartar**.
     - En cabecera, botón **Reintentar todos los fallidos** cuando haya más de 1 en estado `"failed"`.
  2. **Feedback en tiempo real:**
     - Al pulsar **Reintentar**, mostrar toast de confirmación y actualizar reactivamente en cuanto `attemptSend` termine (si tiene éxito pasa a `mailLog` con `ok: true` y desaparece de la lista de fallidos; si vuelve a fallar, actualiza `lastError`).
- **Verificación:**
  - `npm run typecheck`
  - `npx vitest run tests/mailSettings.test.ts tests/mailLogViewer.test.tsx tests/finalesDeLinea.test.ts`

---

## Fase 4: Actualización de `_generated/api.d.ts` y Validación Integral
*Objetivo: Dejar el índice de módulos y la suite completa en verde.*

- **Acciones específicas:**
  - Actualizar `src/convex/_generated/api.d.ts` (con `npx convex codegen` o registro del módulo `mailOutbox` si se ejecuta offline) para que `tests/nasSetup.test.ts` valide todos los módulos.
  - Ejecutar `npm run typecheck` y toda la batería de tests de correo, arquitectura y seguridad.
- **Verificación:**
  - `npm run typecheck`
  - `npx vitest run tests/mailRetry.test.ts tests/mailOutbox.test.ts tests/mailSettings.test.ts tests/nasSetup.test.ts tests/arquitectura.test.ts tests/seguridad.test.ts tests/finalesDeLinea.test.ts`
