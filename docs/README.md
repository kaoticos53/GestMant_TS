# Documentación de Pulso Taller (`docs/`)

Bienvenido a la documentación oficial de **Pulso Taller**, sistema de gestión de mantenimiento para entornos broadcast y audiovisuales.

---

## Índice de Documentos

1. **[Tratado Técnico Integral y Manual General Maestro (+25 Páginas)](manual-general-completo.md):**  
   Manual maestro exhaustivo de más de 25 páginas imprimibles con divisiones de página formales (`page-break`), diagramas de arquitectura C4, flujos ASCII, tablas de trazabilidad y 15 capítulos de ingeniería:
   - Control documental formal, histórico de revisiones de ingeniería y aprobación técnica.
   - Vocabulario Ubicuo innegociable (`GLOSARIO.md`) y principios de trazabilidad industrial.
   - Arquitectura C4 desacoplada, motor reactivo Convex y aislamiento estricto de `src/lib/`.
   - Modelo de seguridad RBAC: 4 roles nativos, matriz completa de las 18 capacidades granulares y `securityAuditLog` inmutable.
   - Ciclo de vida completo de incidencias, máquina de estados finita, triaje, Cuaderno Técnico TipTap con diff de versiones y partes en PDF.
   - Inventario serializado de equipos, catálogo normalizado de modelos, hoja de vida y planes periódicos de preventivos (30/90/180/365 días).
   - Gestión integral de almacén de repuestos, codificación P/N, topología física de gavetas (`EST-MOD-CAJ`), stock mínimo y algoritmos de rotura.
   - Circuito de peticiones de repuesto, aprobaciones con deducción atómica de existencias, órdenes de compra consolidadas por proveedor y recepción de albaranes.
   - Centro de documentación técnica, esquemáticos y notas colaborativas de taller.
   - Comunicaciones internas, notificaciones reactivas y búsqueda asistida global (`Ctrl+K`).
   - Configuración corporativa, prevención de "trabajo sin traza", informes semanales y mantenimiento de almacenamiento.
   - Continuidad de negocio, alta disponibilidad en NAS Synology, backups 3-2-1 y parámetros RTO/RPO.
   - Guía exhaustiva campo por campo de todos los formularios de la plataforma.
   - Matriz de troubleshooting técnico para contingencias de red, base de datos y permisos.
   - 7 Procedimientos Operativos Estandarizados (SOPs) para entornos de televisión, platós, CCU, fuentes SMPS y control ESD.
   - Glosario técnico y diccionario de acrónimos de ingeniería broadcast y telecomunicaciones.

2. **[Manual General de Operación y Administración (Edición Ejecutiva)](manual-general.md):**  
   Versión general condensada orientada a consulta rápida de procedimientos y flujos globales.

3. **[Manual de Uso Operativo por Rol](manual-de-uso.md):**  
   Guía ágil enfocada a las tareas diarias de cada perfil de usuario:
   - **Operador de Plató / Público:** Notificación rápida sin cuenta y seguimiento por código.
   - **Técnico:** Diagnóstico, cuaderno enriquecido, petición de repuestos y manuales de servicio.
   - **Responsable de Repuestos:** Aprobación de material, órdenes de compra, albaranes, catálogo y emisión de partes de trabajo en PDF.
   - **Administrador:** Gestión de usuarios, matriz de 18 capacidades, roles personalizados y auditoría.

4. **Documentación de Arquitectura y Desarrollo:**
   - [Gobernanza y Guardrails para Agentes (`AGENTS.md`)](../AGENTS.md)
   - [Vocabulario Ubicuo del Taller (`GLOSARIO.md`)](../GLOSARIO.md)
   - [Bitácora Oficial de Cambios (`CHANGELOG.md`)](../CHANGELOG.md)
   - [Guía de Despliegue en Synology NAS (`SYNOLOGY.md`)](../SYNOLOGY.md)
   - [Entorno Local de Desarrollo (`LOCAL_SETUP.md`)](../LOCAL_SETUP.md)
