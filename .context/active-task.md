# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-REQUEST-DETAIL-SHEET`
- **Objetivo:** Fase 1 - Extracción de tipos, helpers deterministas de recorrido, permisos y avisos de `RequestDetailSheet`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/types.ts`
  - `src/pages/dashboard/requests/components/detail/helpers.ts`
  - `tests/requestDetailSheetHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `detail/types.ts`: interfaces de props para banners de estado, notas enriquecidas y tarjeta de recorrido.
- [x] `detail/helpers.ts`: funciones puras `resolveCanManageRequest`, `getRequestNowLabel`, `getRequestNextLabel` y `getRequestNextHint`.
- [x] `tests/requestDetailSheetHelpers.test.ts`: 14 tests unitarios cubriendo permisos de gestión, etiquetas de recorrido y estados clave.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 32 tests pasados (14 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 1 completada y validada. Lista para commit atómico 1.
