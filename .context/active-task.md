# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE2-ARCHIVE-VIEW`
- **Objetivo:** Fase 2 - Encapsulación de queries Convex, partición de colecciones y resolución de papelera en `useArchiveData`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/archive/hooks/useArchiveData.ts`

---

## 2. Archivos Modificados / Creados
- [x] `archive/hooks/useArchiveData.ts`: hook orquestador que centraliza las consultas de incidencias, peticiones, catálogo, equipos y papelera polimórfica.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 24 tests pasados (6 helpers + 9 arquitectura + 9 seguridad).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Fase 2 completada y validada. Lista para commit atómico 2.
