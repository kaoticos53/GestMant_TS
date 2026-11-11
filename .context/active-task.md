# Tarea Activa (`.context/active-task.md`)

_No hay ninguna tarea en curso._

## Última tarea cerrada

**Protección anti-bot multi-IP (`turnstile_waf_plan.md`):** Cloudflare Turnstile + *fallback* PoW SHA-256 con *Time-Trap* y anti-*replay* (`src/lib/humanChallenge.ts`, `src/convex/humanChallenge.ts`), conversión de `incidents.report` y `reportUploads.generateUploadUrl` a `action` -> `internalMutation`, exención de reto y cuota pública para miembros autenticados, integración transparente en `ReportIncidentForm` y `RichTextEditorCore`, actualización de CSP y empaquetado Docker/Synology con perfil opcional `tunnel` (`cloudflared`). El traspaso está en [`.context/sessions/2026-11-11-turnstile-pow-tunnel.md`](sessions/2026-11-11-turnstile-pow-tunnel.md).
