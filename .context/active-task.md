# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-PROFILE-VIEW`
- **Objetivo:** Fase 1 - Extraer tipos de dominio, helpers puros (`helpers.ts`), tests unitarios y custom hook `useProfileData` para `ProfileView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/profile/types.ts`
  - `src/pages/dashboard/profile/helpers.ts`
  - `src/pages/dashboard/profile/hooks/useProfileData.ts`
  - `tests/profileHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [ ] `src/pages/dashboard/profile/types.ts`: Contratos de props y modelos de métricas y chips de contacto.
- [ ] `src/pages/dashboard/profile/helpers.ts`: Funciones puras de filtrado de incidencias del técnico, peticiones y cálculo de métricas.
- [ ] `tests/profileHelpers.test.ts`: Pruebas unitarias para la lógica de dominio del perfil de usuario.
- [ ] `src/pages/dashboard/profile/hooks/useProfileData.ts`: Custom hook que centraliza queries de Convex y derivación de datos.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [ ] ¿Afecta a `src/lib/`? No.
- [ ] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [ ] ¿Tests unitarios? Verificados con Vitest.
- [ ] ¿Guardrails de Arquitectura y Seguridad? Verificados.

---

## 4. Estado Final
- **Estado:** En progreso (Fase 1).
