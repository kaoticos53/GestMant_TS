# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-WORKSHOP-SETTINGS-VIEW`
- **Objetivo:** Fase 4 - Verificación exhaustiva (Typecheck, Vitest, Build de Producción) y cierre de la refactorización modular de `WorkshopSettingsView.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/WorkshopSettingsView.tsx`
  - `src/pages/dashboard/settings/view/`
  - `tests/workshopSettingsViewHelpers.test.ts`
  - `tests/workshopSettingsView.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `settings/view/types.ts`: contratos de pestañas, permisos y props.
- [x] `settings/view/helpers.ts`: helpers puros `getAvailableTabs`, `resolveActiveTabId` y permisos derivados.
- [x] `tests/workshopSettingsViewHelpers.test.ts`: suite de tests unitarios verificando la resolución de pestañas (12 tests).
- [x] `settings/view/components/WorkshopSettingsTabsHeader.tsx`: cabecera accesible horizontal con triggers de tabs.
- [x] `settings/view/components/WorkshopSettingsTabsPanels.tsx`: paneles temáticos agrupados y condicionales.
- [x] `settings/view/index.ts`: barril unificado.
- [x] `WorkshopSettingsView.tsx`: reducción de 225 a 53 líneas orquestando limpiamente.

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Tests unitarios y de seguridad? 2.405 tests pasados en 202 suites (0 fallos).
- [x] ¿Compilación de producción? `npm run build` completado con éxito (código 0).
- [x] ¿Vocabulario Ubicuo respetado? Sí (Taller, repuestos, equipos, incidencias, peticiones, almacén).

---

## 4. Estado Actual
- **Estado:** Completada con éxito. Listo para proponer siguiente candidato.
