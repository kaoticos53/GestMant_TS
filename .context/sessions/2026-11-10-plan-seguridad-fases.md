# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-10 21:21
- **Agente / Modelo:** Antigravity
- **Rama / Commit:** working tree

---

## 1. Objetivo Principal de la Sesión
Implementar las 5 fases del plan de mejoras de seguridad (`implementation_plan.md`) aprobado por el usuario, manteniendo las invariantes arquitectónicas (`src/lib/` puro) y la suite de tests en verde.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/lib/upload.ts`, `src/convex/uploads.ts`, `src/convex/reportUploads.ts`, `src/components/richtext/RichTextEditorCore.tsx` | Seguridad (Fase 1.1) | Extracción de `looksLikeImage` a `src/lib/upload.ts` y conversión de `uploads.imageUrl` en `action` que valida tamaño y firma binaria (*magic bytes*) eliminando archivos falsificados de `_storage`. |
| `public/frame-buster.js`, `index.html`, `vite.config.ts`, `docker/synology/security-headers.conf`, `docker/synology/nginx.conf`, `docker/synology/Dockerfile` | Seguridad (Fase 1.2) | Eliminación de `<script>` inline en `index.html`, acotación de `img-src` al origen de la API, herencia de cabeceras HTTP en todos los `location` de Nginx, `Permissions-Policy` y `server_tokens off`. |
| `src/lib/incidentIntake.ts`, `src/convex/incidentIntake.ts`, `src/convex/incidents.ts`, `src/pages/reportIncident/*` | Seguridad (Fase 2) | Cuota global horaria `GLOBAL_INTAKE_LIMIT_PER_HOUR` (`admitGlobalIntake`), lectura acotada en `reportUploads.generateUploadUrl`, honeypot `website` y `limit_req_zone` en Nginx. |
| `src/convex/_auth/secretCrypto.ts`, `src/convex/mailSettings.ts`, `src/convex/schema.ts`, `docker/synology/funciones-lib.sh` | Seguridad (Fase 3.1) | Cifrado AES-256-GCM en reposo para `apiKey` y `relayToken` con pistas visuales (`apiKeyHint`, `relayTokenHint`) y generación automática de `PULSO_SETTINGS_ENCRYPTION_KEY` en Synology. |
| `src/convex/members.ts`, `src/convex/otpLimits.ts`, `src/convex/auth/emailOtp.ts`, `src/convex/crons.ts`, `src/convex/workshopReset.ts` | Seguridad (Fase 3.2) | Revocación inmediata de `authSessions` y `authRefreshTokens` en `setRole` y `revokeSessions`; cooldown anti-OTP bombing (`otpSendLimits`) con limpieza nocturna. |
| `src/convex/audit.ts`, `src/convex/permissions.ts`, `src/convex/trash.ts`, `src/convex/publicLookupLimits.ts`, `src/lib/securityAudit.ts`, `src/pages/dashboard/audit/components/SecurityAuditPanel.tsx`, `src/pages/dashboard/AuditView.tsx` | Seguridad (Fase 4) | Cobertura de eventos administrativos y de umbral global en `securityAuditLog`, alertas tempranas `notifySecurityAlert` con enfriamiento y visor paginado/exportable para administradores en `AuditView`. |
| `docker/synology/docker-compose.yml`, `.github/workflows/security.yml`, `package.json`, `src/convex/_generated/api.d.ts`, `tests/*` | Infra / CI / Tests (Fase 5) | Endurecimiento de contenedores (`read_only`, `cap_drop`, `no-new-privileges`, `nginx:1.27-alpine`), workflow CI `security.yml`, script `security:check` y actualización de `api.d.ts` y tests. |

---

## 3. Decisiones Técnicas y de Diseño Tomadas
- **Sin dependencias externas:** El cifrado en reposo utiliza Web Crypto (`crypto.subtle` AES-256-GCM) nativo y la validación de subidas reutiliza `src/lib/upload.ts`.
- **Compatibilidad de tests y migración:** `secretCrypto.ts` descifra formatos `enc:v1:` y mantiene lectura compatible con secretos heredados en texto plano o entornos efímeros sin clave de cifrado configurada.
- **Trazabilidad en transacciones convex:** Las alertas `global_rate_limit_reached` se registran en la petición que alcanza el último hueco permitido antes del bloqueo, evitando el *rollback* transaccional de `ConvexError`.

---

## 4. Estado de Verificación y Testing
- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Linter (`npm run lint`):** ✅ 0 errores (19 warnings preexistentes).
- **Suite de seguridad, arquitectura y NAS:** ✅ Todas las pruebas pasaron tras el último cambio.

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes para el Siguiente Agente
- [ ] En despliegues ya existentes fuera de `funciones-lib.sh`, configurar `PULSO_SETTINGS_ENCRYPTION_KEY` en el entorno del deployment y volver a guardar las credenciales de correo para re-cifrarlas.
- [ ] Si la instancia queda expuesta a Internet sin VPN/LAN, valorar añadir verificación de reto anti-bot externo (Turnstile o ALTCHA) delante del alta pública.

