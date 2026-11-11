# Resumen de Sesión / Handover de Agente

- **Fecha y Hora:** 2026-11-11 21:28
- **Agente / Modelo:** Antigravity
- **Rama / Commit:** working tree sobre `859bfa8`

---

## 1. Objetivo Principal de la Sesión
Implementar la Parte 2 del plan `turnstile_waf_plan.md` para proteger las puertas públicas (`incidents.report` y `reportUploads.generateUploadUrl`) contra ataques automatizados distribuidos multi-IP mediante Cloudflare Turnstile, *fallback* Proof-of-Work criptográfico propio, exención de cuota para usuarios autenticados y soporte opcional de `cloudflared` en Docker/Synology.

---

## 2. Archivos Modificados y Justificación Técnica

| Archivo Modificado / Creado | Tipo de Cambio | Justificación Técnica |
|---|---|---|
| `src/lib/humanChallenge.ts` | Dominio puro | Reglas de PoW SHA-256, firma/verificación HMAC-SHA256 en tiempo constante y *Time-Trap* (`POW_MIN_DELAY_MS = 1500`). |
| `src/convex/humanChallenge.ts`, `src/convex/schema.ts`, `src/convex/crons.ts`, `src/convex/workshopReset.ts`, `src/convex/_generated/api.d.ts` | Backend / Esquema | Emisión de retos PoW, verificación `siteverify` de Turnstile, tabla anti-*replay* `publicChallengeUsed` con purga nocturna y exención de miembros autenticados. |
| `src/convex/incidents.ts`, `src/convex/incidentIntake.ts`, `src/convex/reportUploads.ts` | Backend (`action` -> `internalMutation`) | Puertas públicas convertidas en `action` que exigen `verifyHumanChallenge` para anónimos antes de mutar y eximen a miembros autenticados de las cuotas horarias públicas. |
| `src/pages/reportIncident/hooks/useHumanChallenge.ts`, `HumanChallengeField.tsx`, `ReportIncidentForm.tsx`, `DescriptionField.tsx`, `useReportIncidentState.ts`, `src/pages/ReportIncident.tsx`, `src/components/richtext/*` | Frontend | Carga transparente de Turnstile (si hay `VITE_TURNSTILE_SITE_KEY`) o PoW en segundo plano, compatible con `offlineDrafts` y subidas de imágenes públicas. |
| `index.html`, `docker/synology/security-headers.conf`, `docker/synology/Dockerfile`, `docker/synology/docker-compose.yml`, `docker/synology/funciones-lib.sh`, `docker/synology/.env.example` | CSP / Infraestructura | Autorización explícita de `https://challenges.cloudflare.com` en CSP, soporte de `VITE_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`, generación automática de `PULSO_CHALLENGE_SECRET` y servicio opcional `tunnel` (`cloudflared`) bajo perfil `tunnel`. |
| `tests/humanChallenge.test.ts` y actualización de suites afectadas | Pruebas | Pruebas de Turnstile, PoW + Time-Trap + anti-replay, exención autenticada y actualización de llamadas `.action(...)` en tests de `incidents.report` y `reportUploads.generateUploadUrl`. |

---

## 3. Decisiones Técnicas y de Diseño Tomadas
- **Conversión de puertas públicas a `action` -> `internalMutation`:** Evita que un bot llame por WebSocket a una mutación abierta saltándose la verificación HTTP contra Cloudflare `siteverify`.
- **Fallback PoW sin dependencias:** Usa exclusivamente Web Crypto nativo (`crypto.subtle`) y se activa automáticamente cuando no existe `TURNSTILE_SECRET_KEY` pero sí `PULSO_CHALLENGE_SECRET` o `JWT_PRIVATE_KEY`.
- **Servicio `tunnel` con perfil Compose (`profiles: ["tunnel"]`):** No altera despliegues sin túnel y permite levantar `cloudflared` junto al stack cuando `CLOUDFLARE_TUNNEL_TOKEN` está configurado.

---

## 4. Estado de Verificación y Testing
- **TypeScript (`npx tsc --noEmit`):** ✅ Sin errores.
- **Suites de seguridad, arquitectura, NAS, incidencias, subidas y reto anti-bot:** ✅ 21 archivos ejecutados (433 tests pasados, 19 omitidos propios de `nasSetup.test.ts`).

---

## 5. Deuda Técnica, Riesgos o Tareas Pendientes para el Siguiente Agente
- [ ] En despliegue real, completar los pasos manuales de `turnstile_waf_plan.md` (DNS en Cloudflare, *Public Hostnames* del túnel hacia DSM `:443` con `Origin Server Name`, Origin Certificate de 15 años, reglas WAF Free y claves Turnstile en `.env`).
- [ ] Ejecutar `npm run convex:push` para aplicar la nueva tabla `publicChallengeUsed` en el deployment.

