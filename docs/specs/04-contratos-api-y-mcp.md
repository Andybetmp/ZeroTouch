# Spec 04 — Contratos de API REST y Servidor MCP (SDD)

## 1. Endpoints de la API REST (`/api/v1`)

Todos los endpoints validan payloads con **Zod** y devuelven respuestas JSON estandarizadas `{ success: boolean, data?: T, error?: string }`.

### 1.1. Maestros y Dashboard KPI
- `GET /api/v1/masters/requirements?stayType=PERMANENTE_CIA&jobPosition=CONDUCTOR`
  - Lista los requisitos aplicables desde `stay_type_requirements`.
- `GET /api/v1/masters/blacklist` / `POST /api/v1/masters/blacklist`
  - Consulta o agrega DNIs en la Lista Negra para pruebas del jurado.
- `GET /api/v1/dashboard/metrics`
  - Retorna KPIs en tiempo real: total de trabajadores, conteo por Semáforo (`VERDE`, `AMBAR`, `ROJO`), tasa de automatización Zero-Touch (`% documentos aprobados sin humanos`), tickets abiertos en Bandeja de Excepciones y órdenes PVC en garita.

### 1.2. Trabajadores y Expedientes
- `POST /api/v1/workers`
  - **Body**: `{ dni, fullName, contractorRuc, companyName, jobPosition, stayType, accessZone }`
  - **Acción**: Cruza con `blacklist_entries`, crea al trabajador, genera los registros en `worker_documents` según `stay_type_requirements`, emite su `sessionCode` para E-Learning y retorna el expediente completo.
- `POST /api/v1/workers/demo-preset`
  - **Body**: `{ scenario: "ZERO_TOUCH_GREEN" | "EXCEPTION_AMBER" | "EXPIRED_RED" | "BLACKLISTED_RED" }`
  - **Acción**: Genera instantáneamente un expediente con PDFs sintéticos procesados por el motor OCR real para demostrar cada escenario en vivo.
- `GET /api/v1/workers` y `GET /api/v1/workers/:id`
  - Retorna el trabajador con sus documentos, estado del Semáforo Operativo, tickets de excepción, intentos de E-Learning y Carné QR.

### 1.3. Carga y Procesamiento OCR de Documentos
- `POST /api/v1/workers/:workerId/documents/:requirementId/upload`
  - **Multipart / Base64**: Recibe archivo PDF/PNG/JPG (`<= 5 MB`).
  - **Acción Zero-Touch**: Ejecuta automáticamente `ocr.service` + `rules.service` + `trafficLight.service` en el mismo request (en `< 3 segundos`) y retorna el estado resultante (`VERDE`, `AMBAR` o `ROJO`).

### 1.4. Bandeja de Excepciones (SSOMA / Área Médica / DHO)
- `GET /api/v1/exceptions?area=SSOMA&status=OPEN`
  - Lista únicamente los documentos en estado `AMBAR` pendientes de revisión humana.
- `PATCH /api/v1/exceptions/:exceptionId/resolve`
  - **Body**: `{ decision: "APPROVED" | "REJECTED", reviewerName, reviewerComment, manualExpiryDate? }`
  - **Acción**: Actualiza el documento a `VERDE` o `ROJO`, cierra el ticket de excepción, registra en `audit_logs` y recalcula el Semáforo Global (emitiendo el Carné QR si era el último requisito pendiente).

### 1.5. Módulo E-Learning Asíncrono y Carné QR
- `GET /api/v1/elearning/questions`
  - Retorna 4 preguntas aleatorias del banco `quiz_questions`.
- `POST /api/v1/elearning/submit`
  - **Body**: `{ dni, sessionCode, answers: [{ questionId, selectedIndex }] }`
  - **Acción**: Califica el intento, marca `elearningPassed = true` si `score >= 3/4` y recalcula el Semáforo Global.
- `GET /api/v1/badges/verify/:badgeCode` y `PATCH /api/v1/badges/:badgeId/print-pvc`
  - Verifica validez en garita y marca el fotocheck físico PVC como impreso.

---

## 2. Contratos del Servidor MCP (`packages/backend/src/mcp/server.ts`)

El servidor MCP se implementa con `@modelcontextprotocol/sdk` soportando tanto transporte **`stdio`** (para ejecución directa desde Antigravity / Claude Desktop) como **HTTP SSE (`/mcp/sse`)**.

### 2.1. Tools Expuestas
1. **`register_worker`**
   - **Input Schema**: `{ dni: string, fullName: string, companyName: string, contractorRuc?: string, jobPosition: "OPERARIO"|"TECNICO"|"INGENIERO"|"CONDUCTOR"|"PERSONAL_COCINA", stayType?: "PERMANENTE_CIA", accessZone?: "SUPERFICIE"|"SOCAVON" }`
   - **Output**: Estado inicial del Semáforo, alerta de Lista Negra y lista de documentos obligatorios generados.
2. **`analyze_worker_document`**
   - **Input Schema**: `{ workerDni: string, requirementCode: string, simulatedTextOrPdfBase64: string, isBase64File?: boolean }`
   - **Output**: Texto extraído, DNI detectado, fecha de vencimiento detectada, estado asignado (`VERDE`/`AMBAR`/`ROJO`) y ticket de excepción creado si aplica.
3. **`get_worker_traffic_light`**
   - **Input Schema**: `{ dni: string }`
   - **Output**: Resumen completo del Semáforo Operativo, desglose por documento, estado del E-Learning y datos del Carné Digital QR.
4. **`list_exception_tray`**
   - **Input Schema**: `{ assignedArea?: "SSOMA"|"AREA_MEDICA"|"DHO"|"AREA_USUARIA", status?: "OPEN"|"APPROVED"|"REJECTED" }`
   - **Output**: Lista de tickets en la Bandeja de Excepciones que requieren intervención humana.
5. **`resolve_exception_ticket`**
   - **Input Schema**: `{ exceptionId: string, decision: "APPROVED"|"REJECTED", reviewerName: string, reviewerComment: string, manualExpiryDate?: string }`
   - **Output**: Nuevo estado del documento, nuevo Semáforo Global del trabajador y confirmación de emisión de Carné QR si corresponde.
6. **`complete_elearning_simulation`**
   - **Input Schema**: `{ dni: string, scoreOutOfFour: number }`
   - **Output**: Registro del intento E-Learning y actualización inmediata del Semáforo Global.
7. **`verify_garita_qr`**
   - **Input Schema**: `{ badgeCodeOrDni: string }`
   - **Output**: Verificación en tiempo real para garita de seguridad (estado del Semáforo, vigencia mínima y estado de impresión del fotocheck físico en PVC).

### 2.2. Resources Expuestos
- `bateas://masters/requirements` → JSON con la matriz `Documentos por estadía` de App Bateas v2.1.0.
- `bateas://masters/blacklist` → JSON con los registros activos de Lista Negra.
- `bateas://metrics/summary` → JSON con los KPIs operativos en tiempo real.
