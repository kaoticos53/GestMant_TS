# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MESSAGES-CENTER`
- **Objetivo:** Fase 1 - Extraer tipos, hooks de dominio (`useMessageThreads`, `useChatThread`, `useNewMessageForm`) y pruebas unitarias para `MessagesCenter`.
- **Módulo(s) Afectado(s):**
  - `src/components/messages/types.ts`
  - `src/components/messages/hooks/useMessageThreads.ts`
  - `src/components/messages/hooks/useChatThread.ts`
  - `src/components/messages/hooks/useNewMessageForm.ts`
  - `tests/messagesHooks.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/components/messages/types.ts`: Definición de tipos de contacto, resúmenes de hilos y constantes.
- [x] `src/components/messages/hooks/useMessageThreads.ts`: Agrupación y cálculo de no leídos de hilos.
- [x] `src/components/messages/hooks/useChatThread.ts`: Hook para ciclo de vida de conversación en Sheet.
- [x] `src/components/messages/hooks/useNewMessageForm.ts`: Hook para formulario de nuevo mensaje.
- [x] `tests/messagesHooks.test.ts`: Pruebas unitarias de agrupación y lógica de hilos.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `types.ts` y hooks en `src/components/messages/`.
- [x] **Paso 2:** Crear test unitario `tests/messagesHooks.test.ts`.
- [x] **Paso 3:** Verificar compilación con `npx tsc -b`.
- [x] **Paso 4:** Ejecutar pruebas con Vitest (10 tests verdes).
- [x] **Paso 5:** Commit atómico de Fase 1.
