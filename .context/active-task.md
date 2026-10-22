# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-REQUEST-CARD`
- **Objetivo:** Fase 4 - Verificación de compilación, suite de pruebas completa y cierre de `RequestCard`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/RequestCard.tsx`
  - `src/pages/dashboard/requests/components/card/`
  - `tests/requestCardHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Subcomponentes modulares (`RequestCardHeader`, `RequestCardBody`, `RequestCardLines`, `RequestCardAttachments`, `RequestCardFooter`), helpers y tipos en `card/`.
- [x] `RequestCard.tsx` refactorizado de 297 a 96 líneas (-67.7% de reducción).
- [x] Suite de pruebas y build de producción verificados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 2.281 tests pasados (187 archivos pasados, 0 fallos).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.
- [x] Compilación Vite de producción: Exitosa en 5.12s.

---

## 4. Estado Actual
- **Estado:** Completada y verificada. Lista para commit atómico de cierre de Fase 4.












