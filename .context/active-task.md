# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-NOTIFICATION-BELL`
- **Objetivo:** Fase 1 - Crear contratos de tipos en `notificationBell/types.ts`, helpers puros en `notificationBell/helpers.ts` y tests unitarios en `tests/notificationBellHelpers.test.ts`.
- **Módulo(s) Afectado(s):**
  - `src/components/notificationBell/types.ts`
  - `src/components/notificationBell/helpers.ts`
  - `tests/notificationBellHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/notificationBell/types.ts`: contratos e interfaces para NotificationBell y sus subcomponentes.
- [x] `src/components/notificationBell/helpers.ts`: funciones puras `countUnread`, `formatBadgeCount` y `getTriggerAriaLabel`.
- [x] `tests/notificationBellHelpers.test.ts`: suite de pruebas unitarias para helpers.
- [ ] `src/components/notificationBell/useNotificationBellDismiss.ts`: pendiente Fase 2.
- [ ] `src/components/notificationBell/components/NotificationTriggerButton.tsx`: pendiente Fase 2.
- [ ] `src/components/notificationBell/components/NotificationItemButton.tsx`: pendiente Fase 2.
- [ ] `src/components/notificationBell/components/NotificationsPanel.tsx`: pendiente Fase 2.
- [ ] `src/components/notificationBell/index.ts`: pendiente Fase 2.
- [ ] `src/components/NotificationBell.tsx`: pendiente Fase 3.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Tests unitarios y de seguridad? Vitest ejecutado sin fallos.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** En ejecución - Fase 1.
