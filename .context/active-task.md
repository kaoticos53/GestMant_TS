# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE4-REQUEST-ACTIONS-FOOTER`
- **Objetivo:** Fase 4 - Validación integral, suite completa de pruebas, verificación de build de producción y cierre de la refactorización de `RequestActionsFooter.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/requests/components/detail/RequestActionsFooter.tsx`
  - `src/pages/dashboard/requests/components/detail/actions/`
  - `tests/requestActionsFooterHelpers.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] Submódulo desacoplado en `src/pages/dashboard/requests/components/detail/actions/`:
  - `types.ts`: interfaces de props y de flags de acciones tipadas.
  - `helpers.ts`: funciones puras de cálculo de botones y sanitización de motivos.
  - `RequestWithdrawDialog.tsx`: diálogo accesible con captura de motivo para papelera.
  - `RequestWorkflowButtons.tsx`: barra completa de acciones de flujo de trabajo.
  - `index.ts`: barril unificado.
- [x] `tests/requestActionsFooterHelpers.test.ts`: 9 tests unitarios cubriendo los estados clave de la máquina de peticiones.
- [x] `RequestActionsFooter.tsx`: orquestador declarativo reducido de 262 a 65 líneas (-75%).

---

## 3. Comprobaciones de Invariantes y Guardrails
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`, `tsc -b` limpio sin errores.
- [x] ¿Suite completa de tests? 2.313 tests pasados en 191 suites de Vitest.
- [x] ¿Compilación de producción? Vite build completado con éxito (5.29s).
- [x] ¿Guardrails de Arquitectura y Seguridad? Verificados y cumplidos.

---

## 4. Estado Actual
- **Estado:** Tarea completada y cerrada con éxito.
