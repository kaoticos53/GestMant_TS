# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-MESSAGES-CENTER`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales desacoplados (`MessagesListPopover`, `ChatSheet`, `NewMessageDialog`).
- **Módulo(s) Afectado(s):**
  - `src/components/messages/components/MessagesListPopover.tsx`
  - `src/components/messages/components/ChatSheet.tsx`
  - `src/components/messages/components/NewMessageDialog.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/messages/components/MessagesListPopover.tsx`: Popover anclado con lista de hilos y botón de redacción.
- [x] `src/components/messages/components/ChatSheet.tsx`: Sheet lateral interactivo de conversación en tiempo real.
- [x] `src/components/messages/components/NewMessageDialog.tsx`: Diálogo modal para iniciar una nueva conversación.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `MessagesListPopover.tsx`.
- [x] **Paso 2:** Crear `ChatSheet.tsx`.
- [x] **Paso 3:** Crear `NewMessageDialog.tsx`.
- [x] **Paso 4:** Verificar con `npx tsc -b`.
- [x] **Paso 5:** Commit atómico de Fase 2.
