# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-NOTIFICATION-BELL`
- **Objetivo:** Fase 4 - Validación completa (2.454 tests de Vitest pasados, build de producción exitoso) y cierre de la refactorización modular de `NotificationBell.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/components/NotificationBell.tsx`
  - `src/components/notificationBell/`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/notificationBell/types.ts`: interfaces tipadas estrictas.
- [x] `src/components/notificationBell/helpers.ts`: funciones puras `countUnread`, `formatBadgeCount` y `getTriggerAriaLabel`.
- [x] `tests/notificationBellHelpers.test.ts`: suite de pruebas unitarias para helpers (7 tests pasados).
- [x] `src/components/notificationBell/useNotificationBellDismiss.ts`: hook para click outside, Escape y foco.
- [x] `src/components/notificationBell/components/NotificationTriggerButton.tsx`: botón disparador con badge reactivo.
- [x] `src/components/notificationBell/components/NotificationItemButton.tsx`: fila de notificación con fecha relativa.
- [x] `src/components/notificationBell/components/NotificationsPanel.tsx`: panel flotante con cabecera y listado.
- [x] `src/components/notificationBell/index.ts`: barril unificado.
- [x] `src/components/NotificationBell.tsx`: orquestación de alto nivel reducida de 207 a 80 líneas.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`. `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.454 tests pasados en Vitest.
- [x] ¿Vocabulario Ubicuo respetado? Sí.

---

## 4. Estado Actual
- **Estado:** Completada y validada con éxito.
