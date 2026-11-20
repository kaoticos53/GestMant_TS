# SPEC-0013 — Auditoría y Seguridad Operativa (AppSec)

- **ID:** `SPEC-0013`
- **Título:** Trazabilidad de seguridad inmutable, cifrado de secretos, validación de subidas, cabeceras HTTP/CSP y suite AppSec
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/convex/audit.ts`, `src/convex/_auth/secretCrypto.ts`, `src/convex/_auth/secureMutation.ts`, `src/convex/uploads.ts`, `src/convex/otpLimits.ts`, `src/lib/securityAudit.ts`, `src/lib/audit.ts`, `src/pages/dashboard/SecurityAuditPanel.tsx`, `docker/synology/security-headers.conf`, `docker/synology/nginx.conf`, `tests/seguridad.test.ts`

---

## 1. Contexto y Objetivos

Garantiza la defensa en profundidad de la aplicación en las capas de transporte (Nginx/CSP), autenticación y límites, persistencia cifrada de secretos, validación binaria de ficheros subidos y registro inmutable de eventos críticos de seguridad.

---

## 2. Modelo de Dominio

- **`securityAuditLog`:** `actorId?`, `action` (`role_change`, `user_status_change`, `permission_change`, `session_revoke`, `login_fail`, `ai_settings_change`, etc.), `target?`, `metadata?`, `createdAt`.
- **Cifrado de secretos (`secretCrypto.ts`):** formato `enc:v1:<iv>:<tag>:<ciphertext>` con AES-256-GCM usando `PULSO_SETTINGS_ENCRYPTION_KEY`.

---

## 3. Requisitos Funcionales

- **RF-001 (Auditoría inmutable):** `logSecurityEvent` registra cambios de roles, bajas de usuarios, permisos, revocación de sesiones, fallos de acceso y cambios de configuración IA/correo; `SecurityAuditPanel.tsx` permite filtrarlos y consultarlos.
- **RF-002 (Cifrado en reposo):** Las claves de DeepSeek (`aiSettings`) y credenciales de correo (`mailSettings`) se cifran antes de guardarse en Convex.
- **RF-003 (Validación de ficheros `uploads.ts`):** Comprueba *magic bytes* reales (JPEG, PNG, WebP, GIF, PDF) y límites de tamaño antes de aceptar adjuntos.
- **RF-004 (Cabeceras y CSP):** `docker/synology/security-headers.conf` y `nginx.conf` aplican `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** `securityAuditLog` no tiene mutaciones de borrado ni forma parte de `RESET_TABLES`.
- **RN-002:** Prohibido `eval()`, `new Function()`, `any` y `dangerouslySetInnerHTML` no autorizado (`tests/seguridad.test.ts`).
- **RN-003:** Prohibido hardcodear correos literales para conceder privilegios de administrador (`INITIAL_ADMIN_EMAIL`).

---

## 5. Permisos y Seguridad

- Consultar `securityAuditLog` y `audit`: requiere capacidad `viewAudit` (bloqueada por defecto al `admin` salvo concesión explícita).

---

## 6. Requisitos No Funcionales

- **RNF-001:** El comando `npm run security:check` ejecuta `npm audit --audit-level=high` junto con los 10 archivos de test de seguridad en un único paso.

---

## 7. Interfaz de Usuario

- `SecurityAuditPanel.tsx` y `AuditView.tsx` (filtros por tipo de evento, usuario y fecha).

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Detección estática de mutaciones sin auth**
  - **Dado** cualquier `export const ... = mutation(...)` en `src/convex/`
  - **Cuando** se ejecuta `tests/seguridad.test.ts`
  - **Entonces** toda mutación pública verifica identidad/capacidad o está en la lista explícita de puertas públicas documentadas

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001, RN-001 | Auditoría inmutable | `tests/audit.test.ts`, `tests/securityAuditLib.test.ts`, `tests/auditAlerts.test.ts`, `tests/auditEntriesLogic.test.ts` |
| RF-002..RF-004, RN-002, CA-001 | Suite AppSec completa | `tests/seguridad.test.ts`, `tests/seguridadHeaders.test.ts`, `tests/cspSecurity.test.ts`, `tests/sessionSecurity.test.ts`, `tests/uploads.test.ts`, `tests/csvSecurity.test.ts` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta; todo cubierto por `npm run security:check`.
