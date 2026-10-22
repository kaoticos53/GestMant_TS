# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-INCIDENT-DETAIL-SHEET`
- **Objetivo:** Fase 3 - Reensamblado de `IncidentDetailSheet.tsx` con el hook `useIncidentDetailState`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/IncidentDetailSheet.tsx`
  - `src/pages/dashboard/incidents/components/detail/useIncidentDetailState.ts`
  - `src/pages/dashboard/incidents/components/detail/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `useIncidentDetailState.ts`: encapsula consulta reactiva de expediente documental, cálculo de acciones siguientes, permisos de trabajo y estados de modales.
- [x] `IncidentDetailSheet.tsx` refactorizado de 314 a 163 líneas (-48.1% de reducción).
- [x] Integración declarativa limpia con subcomponentes especializados.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios y de seguridad? 47 tests pasados (18 unitarios + 11 integración + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 3 completada y validada. Lista para commit atómico 3.







