# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-AUTH`
- **Objetivo:** Fase 1 - Extraer tipos, helper de redirección segura (`resolveRedirectAfterAuth`) y tests unitarios para autenticación.
- **Módulo(s) Afectado(s):**
  - `src/pages/auth/types.ts`
  - `src/pages/auth/helpers.ts`
  - `tests/authHelpers.test.ts`
  - `src/pages/Auth.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/auth/types.ts`: Tipos `AuthProps`, `AuthMethod`, `PasswordFlow`, `OtpStep`.
- [x] `src/pages/auth/helpers.ts`: Función pura `resolveRedirectAfterAuth` con prevención Open Redirect (CWE-601).
- [x] `tests/authHelpers.test.ts`: Batería de 5 tests unitarios verificando rutas relativas, esquemas bloqueados y fallbacks.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio.
- [x] ¿Tests unitarios nuevos? 5 tests pasados al 100%.
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados.
- [ ] ¿Build de producción Vite? (Fase 4)

---

## 4. Estado Actual
- **Estado:** Fase 1 completada. Listo para commit atómico de Fase 1.























