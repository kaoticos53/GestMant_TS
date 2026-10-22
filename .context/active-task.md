# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ASSOCIATE-DIALOG`
- **Objetivo:** Fase 2 - Modularizar subcomponentes visuales de selección de modo, selección de repuesto existente y formulario de alta de nuevo repuesto para `AssociateDialog.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/associate/components/AssociateModeToggle.tsx`
  - `src/pages/dashboard/requests/dialogs/associate/components/AssociateExistingSection.tsx`
  - `src/pages/dashboard/requests/dialogs/associate/components/AssociateNewSection.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/requests/dialogs/associate/components/AssociateModeToggle.tsx`: Conmutador de modo ("existing" vs "new").
- [x] `src/pages/dashboard/requests/dialogs/associate/components/AssociateExistingSection.tsx`: Selector de catálogo, filtro de compatibilidad y cantidad.
- [x] `src/pages/dashboard/requests/dialogs/associate/components/AssociateNewSection.tsx`: Formulario de 11 campos con autocompletados y editor enriquecido.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios? Verificados con Vitest.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** Completada Fase 2. Lista para commit.























