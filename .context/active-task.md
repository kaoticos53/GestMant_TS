# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `SEC-FASE2-OTP-CLICKJACKING`
- **Objetivo:** Endurecimiento del tiempo de expiración del token OTP a 5 minutos bajo NIST SP 800-63B e incorporación de protección anti-clickjacking por Frame Busting en capa cliente (CWE-1021).
- **Módulo(s) Afectado(s):** `src/convex/auth/emailOtp.ts`, `index.html`, `tests/sessionSecurity.test.ts`.

---

## 2. Archivos Modificados / Creados
- [x] `src/convex/auth/emailOtp.ts`: Reducir `maxAge` a 5 minutos (`60 * 5`).
- [x] `index.html`: Script de Frame Busting (`window.top !== window.self`).
- [x] `tests/sessionSecurity.test.ts`: Verificación de `maxAge <= 300s`, aleatoriedad de OTP y frame busting (3/3 pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Verificado con `npx tsc --noEmit` -> 0 errores.
- [x] ¿Seguridad en Convex? Sí, endurece la autenticación por OTP.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Reducir `maxAge` de `emailOtp` a 300s.
- [x] **Paso 2:** Añadir Frame Busting a `index.html`.
- [x] **Paso 3:** Test unitario `tests/sessionSecurity.test.ts`.
- [x] **Paso 4:** Verificación `npx tsc --noEmit` y tests de arquitectura/seguridad.
- [x] **Paso 5:** Commit de la Fase 2 y continuación con la Fase 3.
