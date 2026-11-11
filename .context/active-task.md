# Tarea Activa (`.context/active-task.md`)

_No hay ninguna tarea en curso._

## Última tarea cerrada

**Endurecimiento de dependencias (`npm audit`) y tipado OTP:**
1. Añadidos `overrides` en `package.json` (`@vly-ai/integrations > zod@^4.6.6`, `minimatch@^10.0.0 -> ^11.0.8`, `workbox-build > glob@^14.0.4`) y actualizado `package-lock.json`, eliminando todas las vulnerabilidades `high` y `moderate` (quedando `npm audit --audit-level=high` en verde).
2. Corregido el tipado de `sendVerificationRequest` en `src/convex/auth/emailOtp.ts` (`ctx?: ActionCtx`).
