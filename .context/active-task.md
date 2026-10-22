# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-AUDIT-VIEW`
- **Objetivo:** Fase 1 - Extraer tipos de dominio, hook `useAuditEntries` y tests unitarios de lógica pura para `AuditView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/audit/types.ts`
  - `src/pages/dashboard/audit/hooks/useAuditEntries.ts`
  - `tests/auditEntriesLogic.test.ts`

---

## 2. Archivos Modificados / Creados
- [ ] `src/pages/dashboard/audit/types.ts`: Contratos de props y opciones de ordenación del rastro documental.
- [ ] `src/pages/dashboard/audit/hooks/useAuditEntries.ts`: Custom hook con gestión de filtros, búsqueda, orden, paginación, agrupación y exportación CSV.
- [ ] `tests/auditEntriesLogic.test.ts`: Pruebas unitarias para filtrado, búsqueda por texto, ordenación por fecha y generación de resumen.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [ ] ¿Afecta a `src/lib/`? No.
- [ ] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [ ] ¿Tests unitarios? Verificados con Vitest.
- [ ] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** En progreso (Fase 1).
