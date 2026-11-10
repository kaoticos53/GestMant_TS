# Tarea Activa (`.context/active-task.md`)

_No hay ninguna tarea en curso._

## Última tarea cerrada

**Plan por fases de seguridad (Fases 1 a 5):** validación binaria de subidas autenticadas (`uploads.ts`), corrección de herencia de cabeceras en Nginx (`security-headers.conf`), eliminación de script inline en `index.html` y acotación de `img-src`, cuotas globales anti-flooding y honeypot en puertas públicas (`incidentIntake`, `reportUploads`), cifrado AES-256-GCM en reposo para credenciales de `mailSettings` (`_auth/secretCrypto.ts`), revocación inmediata de sesiones al cambiar rol o manualmente (`members.ts`), freno anti-OTP bombing (`otpLimits.ts`), ampliación de `securityAuditLog` + alertas tempranas (`notifySecurityAlert`) + visor para administradores (`AuditView.tsx` / `SecurityAuditPanel.tsx`), endurecimiento Docker (`docker-compose.yml`, `Dockerfile`) y workflow CI (`security.yml`). El traspaso está en [`.context/sessions/2026-11-10-plan-seguridad-fases.md`](sessions/2026-11-10-plan-seguridad-fases.md).
