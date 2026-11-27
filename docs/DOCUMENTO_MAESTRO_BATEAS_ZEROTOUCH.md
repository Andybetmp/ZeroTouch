# Documento Maestro de Arquitectura y Producto — Bateas Zero-Touch
**Proyecto:** Bateas Zero-Touch (Integración sobre App Bateas v2.1.0 / Cumplimiento D.S. 024-2016-EM)  
**Equipo:** MYOPIA — Ideatón William Morris (Copa Emprende 2026 | Minera Bateas S.A.C.)  
**Versión:** 3.0 (Actualización Funcional y UI/UX: Estado de Habilitación por DNI sin QR, Cursos Automáticos por Área de Ingreso y Portal Minimalista del Trabajador)

---

## 1. Resumen Ejecutivo y Diagnóstico Validado

El proceso de afiliación de **Contratistas Permanentes** (`PERMANENTE CIA`) es crítico para la continuidad operativa de Minera Bateas. De un padrón real de **3,585 trabajadores contratistas** auditados en **App Bateas v2.1.0**:
- **3,152 (87.9%)** presentan al menos un documento vencido.
- **51 (1.4%)** tienen documentos próximos a vencer en menos de 20 días.
- Solo **382 (10.7%)** cuentan con toda su documentación vigente.

---

## 2. Propuesta de Valor y Solución TO-BE (Versión 3.0)

**Bateas Zero-Touch** reduce el ciclo de afiliación de **> 5 días a ≤ 48 horas** y recorta en **80%** la revisión manual mediante 6 pilares integrados:

1. **Filtro 0 (Lista Negra) + Filtro Documental en 2 Etapas**: Cruce automático por DNI contra Lista Negra; **Etapa 1** solicita solo `DNI + CV` (con **Perfil CV Estructurado** de 6 secciones editables + autocompletado opcional con Gemini IA) antes de desbloquear **Etapa 2** (`EMO`, `SCTR`, certificaciones).
2. **Pre-validación OCR Híbrida + Bandeja de Excepciones IA**: Lectura `< 2s` por documento (`pdf-parse` + `FlateDecode` + `Tesseract.js` + fallback Google Gemini). Los archivos conformes pasan directo a `VERDE`; solo el ~20% incierto cae en `ÁMBAR` en la Bandeja Split-Screen.
3. **Asignación 100% Automática de Capacitaciones por Área de Ingreso**:
   - Áreas soportadas: **Interior Mina / Socavón** (`SOCAVON`), **Planta Concentradora** (`PLANTA_CONCENTRADORA`), **Superficie / Talleres** (`SUPERFICIE`) y **Oficinas Administrativas** (`OFICINAS_ADMINISTRATIVAS`).
   - Al registrar al trabajador o cambiar su área de ingreso, el sistema asigna automáticamente **Etapa 1: Inducción General** + **Etapa 2: Capacitación Específica del Área**, eliminando cualquier inscripción manual.
4. **Portal Aislado y Minimalista del Trabajador (RBAC Estricto)**:
   - Encabezado resumido con nombre, empresa contratista, área asignada y barra de progreso (`"X de Y cursos completados"`).
   - Tarjetas minimalistas organizadas en 2 bloques (*Etapa 1* y *Etapa 2*) con únicamente título, horas, modalidad (`E-learning` / `Presencial`), etiqueta de estado suave y un botón principal (`Iniciar` / `Continuar`).
5. **Estado de Habilitación por DNI y Área (Sin Códigos QR)**:
   - Se elimina por completo el generador y visualización de códigos QR / "Pase de Garita".
   - El cierre de flujo muestra una tarjeta clara de **Estado de Habilitación** (`Habilitado` / `Pendiente`) vinculada al **DNI** y al **Área de Ingreso**, verificable directamente por DNI en el rol **Control de Acceso** junto a la orden de Fotocheck físico PVC.
6. **Seguimiento, Reportes Corporativos y Constancias PDF**:
   - Matriz filtrable en `SSOMA` con exportación real a **Excel `.xlsx`** (2 hojas), **PDF Corporativo** y **Constancia Oficial PDF** con código de validación textual (sin QR).

---

## 3. Arquitectura Tecnológica

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Lucide Icons + `xlsx` + `jspdf` + `jspdf-autotable`.
- **Backend & MCP:** Node.js 24 + TypeScript + Express + Multer + Zod + `@modelcontextprotocol/sdk` (`stdio`, Streamable HTTP `/api/mcp`, SSE `/mcp/sse`).
- **Base de Datos:** Supabase PostgreSQL 16 + Prisma ORM 6 (`snake_case` + UUIDs, compatible 1:1 con futura evolución a Spring Boot JPA).
- **IA & OCR:** Google Gemini API + `pdf-parse` + `zlib` + `tesseract.js` (`cachePath: '/tmp'` en Vercel Serverless).

---

## 4. Índice de Especificaciones SDD (`docs/specs/`)

1. `docs/specs/01-arquitectura-y-flujos.md` — Diagramas de arquitectura, flujos Zero-Touch E2E y estructura del monorepo.
2. `docs/specs/02-esquema-postgres-prisma.md` — Modelo entidad-relación y `schema.prisma`.
3. `docs/specs/03-motor-ocr-reglas-semaforo.md` — Pipeline OCR, reglas de perfil/vigencia y Semáforo Operativo.
4. `docs/specs/04-contratos-api-y-mcp.md` — Endpoints REST (`/api/v1/*`) y contratos MCP.
5. `docs/specs/05-frontend-react-y-carnet-qr.md` — Vistas React, Portal del Trabajador minimalista, CMS por Áreas y Estado de Habilitación por DNI (sin QR).
