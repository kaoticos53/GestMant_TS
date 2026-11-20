# SPEC-0003 — Notificación Pública de Incidencias y Seguimiento

- **ID:** `SPEC-0003`
- **Título:** Formulario público `/reportar`, reto humano, borradores offline, código público y seguimiento `/seguimiento`
- **Estado:** Implementada
- **Fecha:** 2026-11-20
- **Fuentes clave:** `src/pages/ReportIncident.tsx`, `src/pages/FollowIncident.tsx`, `src/pages/Landing.tsx`, `src/convex/incidentIntake.ts`, `src/convex/incidents.ts` (`report`, `byCode`), `src/convex/reportUploads.ts`, `src/convex/publicLookupLimits.ts`, `src/convex/publicStats.ts`, `src/convex/humanChallenge.ts`, `src/lib/incidentIntake.ts`, `src/lib/humanChallenge.ts`, `src/lib/publicCode.ts`, `src/lib/publicLookup.ts`, `src/lib/offlineDrafts.ts`

---

## 1. Contexto y Objetivos

Permite a cualquier persona del centro notificar una incidencia sin necesidad de cuenta desde `/reportar` y consultar su estado desde `/seguimiento/:codigo` mediante un código aleatorio opaco (`A7K2-QX9M`), protegiendo el sistema frente a spam, enumeración y caídas de red.

- **En alcance:** Alta pública con fotos opcionales, reto humano (Turnstile + Proof-of-Work fallback), honeypot, rate limiting de consultas por código, cola offline en navegador, landing con estadísticas agregadas (`publicStats`).
- **Fuera de alcance:** Escáner IA de etiquetas en `/reportar` cuando el usuario es anónimo (estrictamente oculto si `!isAuthenticated`, ver `SPEC-0012`).

---

## 2. Modelo de Dominio

- **`publicCode` (`src/lib/publicCode.ts`):** 8 caracteres sin ambigüedad (`O/0/I/1` excluidos), formateados como `XXXX-XXXX`, sin relación con la referencia correlativa interna `INC-XXXX`.
- **`humanChallenge` (`src/lib/humanChallenge.ts`):** soporta verificación Cloudflare Turnstile y fallback criptográfico Proof-of-Work (SHA-256 firmado con `PULSO_CHALLENGE_SECRET`), con prevención de *replay* en `publicChallengeUsed` y ventana temporal mínima anti-bots.
- **`offlineDrafts` (`src/lib/offlineDrafts.ts`):** almacena avisos en `localStorage` con `clientDraftId` idempotente para envío automático al recuperar red.

---

## 3. Requisitos Funcionales

- **RF-001 (Alta pública `incidents.report` + `incidentIntake`):** Crea la incidencia en estado `reported`, genera `reference` (`INC-XXXX`) y `publicCode`, vincula `reportUploads` acreditados y envía correo de confirmación al notificante si dejó correo.
- **RF-002 (Autocompletado autenticado):** Si quien entra en `/reportar` tiene sesión iniciada, autocompleta nombre, correo, puesto y ubicación desde su perfil y queda exento del reto humano.
- **RF-003 (Seguimiento por código `incidents.byCode`):** Devuelve una proyección pública recortada (estado, fechas, datos del equipo, hitos visibles) sin notas internas ni identidad de técnicos, aplicando límite de tasa en `publicLookupLimits`.
- **RF-004 (Estadísticas públicas `publicStats`):** Mantiene agregados anónimos mostrados en la Landing (`/`) sin exponer registros individuales.

---

## 4. Reglas de Negocio e Invariantes

- **RN-001:** La referencia interna `INC-XXXX` nunca se expone al público anónimo ni en correos públicos; el vínculo externo es exclusivamente `publicCode`.
- **RN-002:** La repetición de un mismo `clientDraftId` es idempotente y no duplica la incidencia.
- **RN-003:** Las subidas de `/reportar` (`reportUploads`) no acreditadas o huérfanas se limpian automáticamente en los crons nocturnos (`03:45` aviso, `04:00` limpieza).

---

## 5. Permisos y Seguridad

- `incidents.report` y `incidents.byCode` son accesibles sin sesión, protegidos por:
  - Honeypot (`website`),
  - Reto humano Turnstile/PoW (`humanChallenge.ts`, `publicChallengeUsed`),
  - Rate limiting por IP/código (`publicLookupLimits`),
  - Validación de *magic bytes* en `reportUploads`.

---

## 6. Requisitos No Funcionales

- **RNF-001:** Resiliencia offline en `/reportar`: el aviso se guarda localmente si no hay red y se sincroniza sin duplicados al reconectar.

---

## 7. Interfaz de Usuario

- `/` (`Landing.tsx`): presentación del sistema, puertas de acceso y métricas agregadas.
- `/reportar` (`ReportIncident.tsx`): formulario de contacto, equipo (con escáner IA solo si autenticado), descripción, reto humano y tarjeta de éxito con código copiable.
- `/seguimiento` (`FollowIncident.tsx`): buscador por código y vista de progreso de la incidencia (incluyendo vista de incidencia retirada).

---

## 8. Criterios de Aceptación (Gherkin)

- **CA-001 — Alta pública con código opaco**
  - **Dado** un usuario anónimo en `/reportar` que supera el reto humano
  - **Cuando** envía el formulario con descripción válida
  - **Entonces** se crea la incidencia en estado `reported` y recibe un `publicCode` de 8 caracteres distinto de `INC-XXXX`

- **CA-002 — Protección contra fuerza bruta en seguimiento**
  - **Dado** múltiples consultas fallidas seguidas en `incidents.byCode`
  - **Cuando** se supera el umbral de `publicLookupLimits`
  - **Entonces** el sistema bloquea temporalmente nuevas consultas

---

## 9. Trazabilidad RF → CA → Tests

| Requisito | Criterio | Cobertura automatizada |
|---|---|---|
| RF-001, RN-002 | Alta pública e idempotencia | `tests/incidentIntake.test.ts`, `tests/offlineDrafts.test.ts`, `tests/reportIncidentHelpers.test.ts` |
| RF-002 | Autocompletado en `/reportar` | `tests/reportIncidentAutofill.test.tsx` |
| RF-003, CA-001, CA-002 | Código público y rate limiting | `tests/publicCode.test.ts`, `tests/publicLookup.test.ts`, `tests/publicLookupSecurity.test.ts`, `tests/followIncident.test.tsx`, `tests/withdrawnSheet.test.tsx` |
| RF-001 (Reto/Uploads) | Turnstile, PoW y fotos públicas | `tests/humanChallenge.test.ts`, `tests/reportUploads.test.ts` |
| RF-004 | Landing y estadísticas | `tests/publicStats.test.ts`, `tests/landingStatsLogic.test.ts`, `tests/landingRitmo.test.tsx` |

---

## 10. Preguntas Abiertas / Deuda Técnica

- Ninguna abierta en el flujo actual.
