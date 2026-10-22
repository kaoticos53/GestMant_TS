# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-INCIDENT-PART-REQUESTS-CARD`
- **Objetivo:** Fase 2 - Desacoplamiento de componentes de presentación (`IncidentPartRequestLine`, `IncidentPartRequestItem`) y barril en `partRequests/`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/incidents/components/detail/partRequests/IncidentPartRequestLine.tsx`
  - `src/pages/dashboard/incidents/components/detail/partRequests/IncidentPartRequestItem.tsx`
  - `src/pages/dashboard/incidents/components/detail/partRequests/index.ts`

---

## 2. Archivos Modificados / Creados
- [x] `partRequests/IncidentPartRequestLine.tsx`: componente atómico para el renderizado y desglose cuantitativo de una línea de repuesto.
- [x] `partRequests/IncidentPartRequestItem.tsx`: ficha individual de la petición con cabecera, badges, líneas y notas de entrega/archivo.
- [x] `partRequests/index.ts`: barril unificado para el submódulo partRequests.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 23 tests pasados (5 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
