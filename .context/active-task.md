# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `SEC-FASE3-CSP-SCA-CLEANUP`
- **Objetivo:** Saneamiento de orígenes locales en la CSP de producción (CWE-1188) y depuración de dependencias huérfanas en package.json (SCA).
- **Módulo(s) Afectado(s):** `vite.config.ts`, `package.json`, `tests/cspSecurity.test.ts`.

---

## 2. Archivos Modificados / Creados
- [x] `vite.config.ts`: Limpieza automática de comodines `localhost` y `127.0.0.1` en compilación de producción.
- [x] `package.json`: Eliminación de dependencia no utilizada `dompurify`.
- [x] `tests/cspSecurity.test.ts`: Verificación de CSP limpia y depuración de librerías (2/2 pasados).

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Verificado con `npx tsc --noEmit` -> 0 errores.
- [x] ¿Seguridad en Convex? Preservada.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Limpieza de CSP en `vite.config.ts`.
- [x] **Paso 2:** Depuración en `package.json`.
- [x] **Paso 3:** Test unitario `tests/cspSecurity.test.ts`.
- [x] **Paso 4:** Verificación `npx tsc --noEmit` y suite de seguridad.
- [x] **Paso 5:** Commit de la Fase 3 y continuación con la Fase 4.
