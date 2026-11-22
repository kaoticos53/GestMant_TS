# Pulso Taller (`GestMant_TS`) — Claude Code Instructions

Consulta siempre [AGENTS.md](AGENTS.md) y la carpeta [.context/](.context/) para las directrices arquitectónicas, reglas de estilo y comandos.

## Comandos Principales
- Tipado: `npm run typecheck` (`tsc -b --noEmit` + tsconfig de Convex)
- Tests: `npx vitest run`
- Arquitectura: `npx vitest run tests/arquitectura.test.ts`
- Test individual: `npx vitest run <ruta_test>`
- Linting: `npm run lint`

## Invariantes Críticas
- **Dominio Puro:** NUNCA importar `convex` o `react` en `src/lib/`.
- **Máquinas de Estado:** Consultar siempre `src/lib/incidentFlow.ts`, `requestFlow.ts` y `purchaseFlow.ts` para transiciones de estado.
- **Vocabulario:** Usar siempre *incidencia*, *equipo*, *repuesto*, *petición de repuesto*, *parte de trabajo*, *técnico*.
