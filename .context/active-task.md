# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-DECISION-DIALOG`
- **Objetivo:** Fase 2 - Extraer subcomponentes visuales modulares de DecisionDialog en decisionDialog/components/.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/dialogs/decisionDialog/components/DecisionStockApprovalPanel.tsx`
  - `src/pages/dashboard/requests/dialogs/decisionDialog/components/DecisionIssueBatchPanel.tsx`
  - `src/pages/dashboard/requests/dialogs/decisionDialog/components/DecisionNoteField.tsx`
  - `src/pages/dashboard/requests/dialogs/decisionDialog/components/DecisionDialogFooter.tsx`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes visuales de DecisionDialog (`DecisionStockApprovalPanel`, `DecisionIssueBatchPanel`, `DecisionNoteField`, `DecisionDialogFooter`).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? Tests verdes (26 tests pasados).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada exitosamente. Listo para commit atómico 2.
