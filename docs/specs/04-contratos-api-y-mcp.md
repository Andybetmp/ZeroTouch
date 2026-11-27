# Spec 04 — Contratos de API REST y Servidor MCP (SDD — v3.0)

## 1. Endpoints de la API REST (`/api/v1`)

Todos los endpoints devuelven respuestas JSON estandarizadas `{ success: boolean, data?: T, error?: string }` y aplican middleware RBAC `requireRole(['SSOMA' | 'ECM' | 'GARITA' | 'TRABAJADOR'])`.

### 1.1. Autenticación RBAC y Maestros
- `POST /api/v1/auth/login` — Valida credenciales (`ssoma@bateas.pe`, `ecm@bateas.pe`, `garita@bateas.pe`, `trabajador@bateas.pe`), retorna token de sesión y rol estricto.
- `GET /api/v1/masters/requirements` — Lista requisitos de `stay_type_requirements`.
- `GET /api/v1/masters/blacklist` / `POST /api/v1/masters/blacklist` — Gestión de Lista Negra.
- `GET /api/v1/dashboard/metrics` — KPIs en tiempo real (totales, Semáforo, tasa OCR Zero-Touch, alertas `< 20 días`).

### 1.2. Trabajadores, Área de Ingreso y Perfil CV Estructurado
- `POST /api/v1/workers`
  - **Body**: `{ dni, fullName, contractorRuc?, companyName, jobPosition, stayType, accessZone }`
  - **Valores válidos de `accessZone`**: `SOCAVON` (*Interior Mina / Socavón*), `PLANTA_CONCENTRADORA` (*Planta Concentradora*), `SUPERFICIE` (*Superficie / Talleres*), `OFICINAS_ADMINISTRATIVAS` (*Oficinas Administrativas*).
  - **Acción**: Cruza Lista Negra, crea checklist por estadía y **asigna automáticamente** los cursos obligatorios correspondientes al `accessZone` seleccionado (`syncWorkerCoursesByArea`).
- `PATCH /api/v1/workers/:workerId/area` (`requireRole(['SSOMA', 'ECM'])`)
  - **Body**: `{ accessZone }`
  - **Acción**: Actualiza el Área de Ingreso del trabajador, registra auditoría y sincroniza automáticamente sus cursos obligatorios (mantiene Etapa 1 General y reemplaza Etapa 2 pendiente por la del área nueva).
- `GET /api/v1/workers/:workerId/cv-profile` / `PUT /api/v1/workers/:workerId/cv-profile`
  - Consulta o guarda las 6 secciones estructuradas del CV (Formación, Experiencia general, Experiencia minera, Especializaciones, Certificaciones, Cursos).
- `POST /api/v1/workers/:workerId/cv-profile/pdf` — Adjunta/reemplaza PDF sin sobrescribir campos manuales.
- `POST /api/v1/workers/:workerId/cv-profile/autofill` — Extrae y autocompleta las 6 secciones desde el PDF usando Google Gemini IA.

### 1.3. Carga OCR y Bandeja de Excepciones
- `POST /api/v1/workers/:workerId/documents/:requirementId/upload` — Procesa PDF/imagen con OCR + Reglas (respetando candado Etapa 1 `DNI + CV` → Etapa 2).
- `GET /api/v1/exceptions` / `PATCH /api/v1/exceptions/:exceptionId/resolve` — Bandeja Split-Screen de excepciones `ÁMBAR`.
- `POST /api/v1/ai/audit-document/:workerDocumentId` / `POST /api/v1/ai/copilot` — Auditoría documental y Copiloto Google Gemini IA.

### 1.4. Gestión de Capacitaciones por Área (CMS) y Portal del Trabajador
- `GET /api/v1/courses` — Lista cursos con recursos, preguntas y resumen por Área de Ingreso (`areaSummary`).
- `POST /api/v1/courses` / `PUT /api/v1/courses/:id` / `DELETE /api/v1/courses/:id` (`requireRole(['SSOMA'])`)
  - Permite asociar `targetArea` (`null` = Etapa 1 Inducción General; `SOCAVON | PLANTA_CONCENTRADORA | SUPERFICIE | OFICINAS_ADMINISTRATIVAS` = Etapa 2 Específica del Área) y sincroniza automáticamente a los trabajadores impactados.
- `POST /api/v1/courses/sync-areas` (`requireRole(['SSOMA'])`) — Re-sincroniza masivamente las asignaciones de todos los trabajadores según su Área de Ingreso.
- `POST /api/v1/courses/:id/resources` / `POST /api/v1/courses/:id/questions` — Gestión de Videos, PDFs, Presentaciones y preguntas de opción múltiple.
- `GET /api/v1/courses/worker/:workerId/dashboard` (`requireRole(['SSOMA', 'ECM', 'TRABAJADOR'])`)
  - Sincroniza automáticamente cursos del área y retorna `workerInfo` (incluyendo `areaLabel` e `isEnabled`), `stage1Courses` (*Etapa 1: Inducción General*), `stage2Courses` (*Etapa 2: Capacitación Específica del Área*), `completedCount`, `totalCount`, `overallProgressPercent` y `certificate`.
- `POST /api/v1/courses/worker/:workerId/watch` — Registra avance de visualización virtual.
- `POST /api/v1/courses/worker/:workerId/exam` — Evalúa respuestas del curso respetando nota mínima e intentos máximos.
- `POST /api/v1/courses/worker/:workerId/presential` (`requireRole(['SSOMA'])`) — Registra asistencia y nota presencial.

### 1.5. Control de Acceso por DNI (Sin QR), Reportes y Constancias
- `GET /api/v1/badges/verify/:dni` — Consulta directa del **Estado de Habilitación** (`Habilitado` / `Pendiente` / `Bloqueado`) por DNI de 8 dígitos y Área de Ingreso.
- `PATCH /api/v1/badges/:badgeId/print-pvc` — Actualiza estado de impresión del fotocheck físico PVC.
- `GET /api/v1/reports/training` (`requireRole(['SSOMA'])`) — Matriz consolidada para reportes y exportación `.xlsx` / `.pdf`.
- `POST /api/v1/certificates/worker/:workerId/issue` (`requireRole(['SSOMA'])`) — Emite Constancia Oficial con código textual de verificación (sin QR).

---

## 2. Contratos del Servidor MCP (`packages/backend/src/mcp/server.ts`)

Soporta transporte **`stdio`**, **Streamable HTTP Stateless (`/api/mcp`)** y **SSE (`/mcp/sse`)**, exponiendo:
- **8 Tools:** `register_worker`, `analyze_worker_document`, `get_worker_traffic_light`, `list_exception_tray`, `resolve_exception_ticket`, `complete_elearning_simulation`, `verify_garita_qr` (compatible con DNI), `generate_demo_scenario`.
- **3 Resources:** `bateas://masters/requirements`, `bateas://masters/blacklist`, `bateas://metrics/summary`.
