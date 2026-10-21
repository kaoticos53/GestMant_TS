# Tarea Activa (`.context/active-task.md`)

## 1. Definición de la Tarea
- **ID / Nombre de la Tarea:** `REF-FASE3-MAIL-SERVER-FIELDS-LOGS`
- **Objetivo:** Fase 3 - Extracción de `MailProviderSettingsFields.tsx`, `MailRelayCheckSection.tsx`, `MailLogViewer.tsx` y orquestación ultradelgada de `MailServerCard.tsx`.
- **Módulo(s) Afectado(s):**
  - `src/pages/dashboard/settings/mail/components/MailProviderSettingsFields.tsx`
  - `src/pages/dashboard/settings/mail/components/MailRelayCheckSection.tsx`
  - `src/pages/dashboard/settings/mail/components/MailLogViewer.tsx`
  - `src/pages/dashboard/settings/MailServerCard.tsx`
  - `tests/mailServerFields.test.tsx`

---

## 2. Archivos Modificados / Creados
- [x] `src/pages/dashboard/settings/mail/components/MailProviderSettingsFields.tsx`: Configuración reactiva de credenciales y selector de proveedor.
- [x] `src/pages/dashboard/settings/mail/components/MailRelayCheckSection.tsx`: Sección de comprobación HTTP del relevo.
- [x] `src/pages/dashboard/settings/mail/components/MailLogViewer.tsx`: Visor de histórico de envíos con badges y scroll.
- [x] `src/pages/dashboard/settings/MailServerCard.tsx`: Orquestación ultradelgada (<190 líneas).
- [x] `tests/mailServerFields.test.tsx`: Pruebas unitarias de campos, check y logs.

---

## 3. Comprobaciones de Invariantes Previas
- [x] ¿Afecta a `src/lib/`? No.
- [x] ¿TypeScript estricto? Sin `any`.
- [x] ¿Seguridad / Arquitectura? Preservadas.

---

## 4. Checklist de Ejecución
- [x] **Paso 1:** Crear `MailProviderSettingsFields.tsx`.
- [x] **Paso 2:** Crear `MailRelayCheckSection.tsx`.
- [x] **Paso 3:** Crear `MailLogViewer.tsx`.
- [x] **Paso 4:** Orquestar en `MailServerCard.tsx`.
- [x] **Paso 5:** Crear `tests/mailServerFields.test.tsx`.
- [x] **Paso 6:** Validar con `npx tsc --noEmit` y suite de tests.
- [x] **Paso 7:** Commit atómico de la Fase 3.
