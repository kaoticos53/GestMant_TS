# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-NOTIFICATION-BELL`
- **Objetivo:** Fase 3 - Reducir y orquestar limpiamente `src/components/NotificationBell.tsx` delegando en `notificationBell/index` (hook `useNotificationBellDismiss`, `NotificationTriggerButton` y `NotificationsPanel`) reduciendo el componente de 207 a ~65 líneas.
- **Módulo(s) Afectado(s):**
  - `src/components/NotificationBell.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/notificationBell/types.ts`: interfaces tipadas.
- [x] `src/components/notificationBell/helpers.ts`: funciones puras de formato y accesibilidad.
- [x] `tests/notificationBellHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [x] `src/components/notificationBell/useNotificationBellDismiss.ts`: hook para click outside, Escape y foco.
- [x] `src/components/notificationBell/components/NotificationTriggerButton.tsx`: botón disparador con badge reactivo.
- [x] `src/components/notificationBell/components/NotificationItemButton.tsx`: fila de notificación con fecha relativa.
- [x] `src/components/notificationBell/components/NotificationsPanel.tsx`: panel flotante con cabecera y listado.
- [x] `src/components/notificationBell/index.ts`: barril unificado.
- [ ] `src/components/NotificationBell.tsx`: orquestación de alto nivel limpia.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 3.
