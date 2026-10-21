# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE1-MAIL-SERVER-HOOKS`
- **Objetivo:** Fase 1 - Extracción de tipos y custom hooks de dominio (`useMailServerForm`, `useMailPathCheck`) para `MailServerCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/mail/types.ts`
  - `src/pages/dashboard/settings/mail/hooks/useMailServerForm.ts`
  - `src/pages/dashboard/settings/mail/hooks/useMailPathCheck.ts`
  - `tests/mailServerForm.test.ts`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/mail/types.ts`: Tipos del formulario de correo, check de salud y DTOs.
- [x] `src/pages/dashboard/settings/mail/hooks/useMailServerForm.ts`: Estado unificado del formulario, validación reactiva y mutación de guardado.
- [x] `src/pages/dashboard/settings/mail/hooks/useMailPathCheck.ts`: Comprobación automática y manual del relevo HTTP/SMTP.
- [x] `src/pages/dashboard/settings/MailServerCard.tsx`: Integración de los nuevos hooks de dominio.
- [x] `tests/mailServerForm.test.tsx`: Pruebas unitarias de gestión de formulario y validación.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `types.ts`.
- [x] **Paso 2:** Crear `useMailServerForm.ts` y `useMailPathCheck.ts`.
- [x] **Paso 3:** Crear test unitario `tests/mailServerForm.test.tsx`.
- [x] **Paso 4:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 5:** Commit atómico de la Fase 1.
