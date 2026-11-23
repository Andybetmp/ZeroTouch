# ⛏️ Bateas Zero-Touch — Onboarding 360 (Equipo MYOPIA)

> **Ideatón William Morris — Copa Emprende 2026 | Minera Bateas S.A.C.**  
> **Reto:** Optimización, Digitalización y Eficiencia de Procesos Empresariales  
> **Metodología de Ingeniería:** **SDD (Spec-Driven Development)** · **MCP (Model Context Protocol)** · **Zero-Touch Exception Management**

---

## 📋 Tabla de Contenidos
1. [Resumen Ejecutivo y Problemática (AS-IS vs. TO-BE)](#1-resumen-ejecutivo-y-problemática-as-is-vs-to-be)
2. [Propuesta de Valor y Flujo en 2 Etapas (Bateas Zero-Touch)](#2-propuesta-de-valor-y-flujo-en-2-etapas-bateas-zero-touch)
3. [Stack Tecnológico y Herramientas de Desarrollo](#3-stack-tecnológico-y-herramientas-de-desarrollo)
4. [Arquitectura del Sistema y Diagramas Mermaid](#4-arquitectura-del-sistema-y-diagramas-mermaid)
5. [Modelo de Datos Relacional en Supabase PostgreSQL](#5-modelo-de-datos-relacional-en-supabase-postgresql)
6. [Motor OCR Híbrido, Inteligencia Artificial (Google Gemini) y Semáforo Operativo](#6-motor-ocr-híbrido-inteligencia-artificial-google-gemini-y-semáforo-operativo)
7. [Servidor MCP (Model Context Protocol) — Tools y Resources](#7-servidor-mcp-model-context-protocol--tools-y-resources)
8. [Guía de Uso, Credenciales por Rol y Guion de Exposición](#8-guía-de-uso-credenciales-por-rol-y-guion-de-exposición)
9. [Instalación Local, Pruebas Automatizadas y Despliegue en Vercel](#9-instalación-local-pruebas-automatizadas-y-despliegue-en-vercel)
10. [Índice de Documentación SDD y Manual de Usuario en PDF](#10-índice-de-documentación-sdd-y-manual-de-usuario-en-pdf)

---

## 1. Resumen Ejecutivo y Problemática (AS-IS vs. TO-BE)

En **Minera Bateas S.A.C.**, el proceso de afiliación de **Contratistas Permanentes** (`PERMANENTE CIA`, vínculo mayor a 30 días) constituye el flujo más crítico para la continuidad de los proyectos operativos en superficie y socavón.

Durante la auditoría empírica del entorno real (**App Bateas v2.1.0**) y la validación con el área de **Desarrollo Humano y Organización (DHO)**, se demostró que de un padrón de **3,585 trabajadores contratistas registrados**:
- 🔴 **3,152 trabajadores (87.9%)** presentan al menos un documento vencido.
- 🟡 **51 trabajadores (1.4%)** tienen documentos próximos a vencer en un horizonte de 20 días.
- 🟢 Solo **382 trabajadores (10.7%)** cuentan con toda su documentación vigente.

### ¿Por qué colapsaba el flujo tradicional (AS-IS)?
1. **Aprobaciones secuenciales y 100% manuales**: Cada expediente debía pasar por una cadena humana rígida (`Área Usuaria → SSOMA → Área Médica → DHO`), tomando **2.5 minutos de lectura manual por documento**. Si un solo documento presentaba un error o estaba vencido, toda la cadena se reiniciaba.
2. **Sobrecarga documental inicial**: Se exigía subir la totalidad de certificados médicos y pólizas desde el primer momento, incluso a postulantes que aún no habían pasado el filtro básico de perfil/CV o que tenían restricciones en Lista Negra.
3. **Rigidez logística en inducciones**: Las capacitaciones teóricas transversales dependían de fechas presenciales fijas, inmovilizando cuadrillas enteras en campamento.

### Impacto Logrado con **Bateas Zero-Touch (TO-BE)**

| Indicador Operativo (KPI) | Situación Actual (AS-IS) | Con Bateas Zero-Touch (TO-BE) | Impacto en Minera Bateas |
| :--- | :---: | :---: | :--- |
| **Tiempo total de afiliación** | **> 5 días** (impredecible) | **Máximo 48 horas** | Eliminación de lucro cesante por cuadrillas paradas en campamento. |
| **Tiempo de lectura por documento** | **2.5 minutos** (manual) | **< 2 a 10 segundos** (OCR + IA) | Pre-validación automática instantánea al subir el archivo. |
| **Carga operativa de SSOMA / Médico / DHO** | **100%** revisión manual en cadena | **~20%** (Solo Bandeja de Excepciones) | **80% de reducción** en tareas administrativas repetitivas. |
| **Disponibilidad de Inducción Teórica** | Fechas fijas presenciales | **24/7 Asíncrono Web** | El contratista llega a unidad minera con la teoría ya aprobada. |
| **Control en Garita y Campo** | Validación fragmentada | **Carné Digital QR HMAC + Fotocheck PVC** | Trazabilidad criptográfica y credencial física obligatoria para uso con guantes. |

---

## 2. Propuesta de Valor y Flujo en 2 Etapas (Bateas Zero-Touch)

**Bateas Zero-Touch** se acopla directamente a las tablas maestras de **App Bateas v2.1.0** (`Documentos por estadía` y `Lista negra`) e introduce un flujo inteligente dividido en **dos etapas progresivas** más capacitación paralela:

1. **🛡️ Filtro 0 — Cruce Automático con Lista Negra (En el registro)**:
   - Al registrar el DNI del postulante, el sistema verifica instantáneamente en PostgreSQL si registra bloqueo activo en `blacklist_entries`. Si está en Lista Negra, el Semáforo pasa a **🔴 `ROJO`** y bloquea el proceso en el acto.
2. **🟦 Etapa 1 — Primer Filtro de Postulación (`Solo DNI + CV Actualizado`)**:
   - Inicialmente **solo** se solicita al postulante adjuntar su **DNI** y su **CV Documentado**.
   - El **Motor OCR + Google Gemini IA** valida la identidad y evalúa que el CV cumpla con las competencias, formación y **especialidad del puesto** (`Ingeniero CIP`, `Conductor MTC`, `Técnico Especialista`, `Personal de Cocina`, `Operario`).
   - Los demás requisitos (`EMO Anexo 16`, `SCTR`, `Certificados`, `DDJJ`) permanecen **bloqueados con candado (`🔒`)** para no pedir documentación costosa a candidatos que aún no superan el primer filtro.
3. **🔓 Etapa 2 — Desbloqueo Automático de Documentos de Habilitación (`EMO`, `SCTR`, `Certificados`)**:
   - En el instante en que el `DNI` y el `CV Documentado` alcanzan estado **🟢 `VERDE`**, el sistema desbloquea automáticamente la Etapa 2.
   - La Empresa Contratista (ECM) sube los PDFs/imágenes del `SCTR`, `EMO - Anexo 16-16A` (emitido por clínica ocupacional autorizada), licencias y declaraciones.
4. **🟡 Gestión por Excepciones (Bandeja Split-Screen para SSOMA / Área Médica / DHO)**:
   - Los documentos legibles, vigentes y consistentes pasan directamente a **🟢 `VERDE` sin intervención humana**.
   - Si un documento está **vencido**, pasa a **🔴 `ROJO`** (rechazo preventivo directo).
   - Si un documento tiene un **sello sobre la fecha, baja calidad de escaneo o un CV con redacción atípica sin palabra clave exacta**, **NO se rechaza a ciegas**: pasa a **🟡 `ÁMBAR`** y se enruta a la **Bandeja de Excepciones** del área responsable (`SSOMA`, `AREA_MEDICA`, `DHO` o `AREA_USUARIA`), donde el especialista audita el caso con ayuda de **Google Gemini IA**.
5. **📚 Pilar 2 Paralelo — Aula Web E-Learning Asíncrona 24/7**:
   - El trabajador accede con su `DNI + Código Único de Sesión` a los módulos de *Seguridad y Salud Ocupacional (SSOMA)* y *Gestión Ambiental (NTP 900.058)* y rinde una evaluación aleatoria (nota mínima aprobatoria: **≥ 75% / 3 de 4**), emitiendo su Constancia Digital.
6. **🪪 Emisión Automática de Carné Digital QR + Orden de Fotocheck Físico en PVC (Garita)**:
   - Cuando el 100% de documentos obligatorios (Etapas 1 y 2) está en **🟢 `VERDE`** y el E-Learning está aprobado, el **Semáforo Global** cambia a **🟢 `VERDE`**, emitiendo el **Carné Digital con código QR firmado criptográficamente (`HMAC-SHA256`)** y encolando la impresión del **Fotocheck físico en PVC** en Garita (indispensable porque en socavón y planta los trabajadores usan guantes de seguridad y no manipulan celulares).

---

## 3. Stack Tecnológico y Herramientas de Desarrollo

El proyecto está construido como un **Monorepo Full-Stack en TypeScript** bajo arquitectura limpia, preparado en esta **Primera Entrega** sobre **Node.js + React + MCP + Supabase PostgreSQL**, y diseñado con compatibilidad de esquema 1:1 (`snake_case` + UUIDs) para una futura evolución o coexistencia con **Java 21 / Spring Boot 3 (Spring Data JPA + Spring AI)**.

| Capa | Tecnología / Librería | Propósito en Bateas Zero-Touch |
| :--- | :--- | :--- |
| **Frontend Web (SPA)** | **React 19 + TypeScript + Vite 6** | Interfaz Web Desktop de alta fidelidad que replica el layout corporativo de **App Bateas v2.1.0**. |
| **Estilos & UI** | **Tailwind CSS v4 + Lucide Icons + `qrcode.react`** | Diseño del Sidebar `#222d32`, Semáforo Operativo, gráficos de dona CSS, visor Split-Screen y renderizado SVG del código QR. |
| **Backend & Core Engine** | **Node.js 24 + TypeScript + Express + Multer + Zod** | API REST (`/api/v1/*`), validación de esquemas, autenticación por roles (RBAC) y orquestación transaccional. |
| **Motor OCR Híbrido** | **`pdf-parse` + `zlib` FlateDecode + `tesseract.js` + `pdf-lib`** | Extracción de texto nativo en PDFs (`< 150 ms`), OCR óptico en imágenes escaneadas y generador de PDFs sintéticos de prueba. |
| **Inteligencia Artificial** | **Google Gemini API (`gemini-3.1-flash-lite` / `3.6-flash` / `3.5-flash` / `3.8-flash`)** | Fallback multimodal inteligente para lectura de documentos complejos, asistente de dictamen en Bandeja de Excepciones y Copiloto IA en tiempo real. |
| **Servidor MCP** | **`@modelcontextprotocol/sdk` (v1.11+)** | Servidor **Model Context Protocol** con soporte triple: **`stdio`** (local), **Streamable HTTP Stateless (`/api/mcp`)** para Vercel Serverless y **SSE (`/mcp/sse`)**. |
| **Base de Datos & ORM** | **Supabase PostgreSQL 16 + Prisma ORM 6** | Persistencia relacional en la nube con Connection Pooling (`pgbouncer` puerto `6543` + `directUrl` puerto `5432`), integridad referencial ACID y bitácora inmutable `audit_logs`. |
| **Despliegue Cloud** | **Vercel Serverless + GitHub CI/CD** | Despliegue unificado del Frontend estático y el Backend Express/MCP como Serverless Function (`api/index.ts`). |

---

## 4. Arquitectura del Sistema y Diagramas Mermaid

### 4.1. Diagrama de Arquitectura de Componentes

```mermaid
flowchart TB
    subgraph Actores["👥 Usuarios por Rol y Clientes Agénticos"]
        ECM["👷 Admin ECM / Postulante\n(ecm@bateas.pe)"]
        REV["🛡️ Especialistas SSOMA / Médico / DHO\n(ssoma@bateas.pe)"]
        GAR["🚧 Seguridad Patrimonial Garita\n(garita@bateas.pe)"]
        MCP_AGENT["🤖 Cliente MCP / Agente IA\n(Claude / Antigravity / IDE)"]
    end

    subgraph Frontend["⚛️ Frontend Web Corporativo (React 19 + Vite + Tailwind CSS)"]
        UI_LOGIN["🔐 Login RBAC por Rol"]
        UI_HOME["🏠 Inicio App Bateas v2.1.0\n• Acceso Directo\n• Panel de Control (Donas 87.9% vs TO-BE)"]
        UI_AFIL["📋 Afiliados en 2 Etapas\n• Etapa 1: Filtro DNI + CV\n• Etapa 2: Desbloqueo EMO/SCTR"]
        UI_EXC["🟡 Bandeja Excepciones Split-Screen\n• Cola ÁMBAR por Área\n• Auditoría con Gemini IA"]
        UI_LMS["📚 Aula Web E-Learning 24/7\n• Cápsulas SSOMA/Ambiente\n• Quiz + Certificado"]
        UI_QR["🪪 Control Garita QR & PVC\n• Escáner HMAC-SHA256\n• Cola Fotocheck PVC"]
        UI_COPILOT["✨ Copiloto Gemini IA Flotante"]
    end

    subgraph Backend["🟩 Backend Node.js + TypeScript (Express & Vercel Serverless)"]
        REST_API["🌐 API REST (/api/v1/*)"]
        MCP_SRV["🔌 Servidor MCP (@modelcontextprotocol/sdk)\n• /api/mcp (Streamable HTTP)\n• /mcp/sse & stdio\n• 8 Tools + 3 Resources"]

        subgraph CoreDomain["⚙️ Core Domain Services (packages/backend/src/services)"]
            SVC_WORKFLOW["workflow.service.ts\n(Orquestador 2 Etapas)"]
            SVC_OCR["ocr.service.ts\n(pdf-parse + FlateDecode + Tesseract.js)"]
            SVC_RULES["rules.service.ts\n(Vigencias, DNI y Especialidad CV)"]
            SVC_AI["ai.service.ts\n(Google Gemini Multimodal & Copiloto)"]
            SVC_TL["trafficLight.service.ts\n(Semáforo 🟢/🟡/🔴 + Firma QR HMAC)"]
        end

        PRISMA["🔷 Prisma ORM Client"]
    end

    subgraph CloudDB["🐘 Supabase PostgreSQL (AWS us-east-2)"]
        PG_DB[("10 Tablas Relacionales\n• contractors_ecm\n• stay_type_requirements\n• blacklist_entries\n• workers\n• worker_documents\n• exception_reviews\n• quiz_questions\n• elearning_attempts\n• digital_badges_qr\n• audit_logs")]
    end

    ECM & REV & GAR --> UI_LOGIN
    UI_LOGIN --> UI_HOME & UI_AFIL & UI_EXC & UI_LMS & UI_QR & UI_COPILOT
    MCP_AGENT <-->|"JSON-RPC 2.0"| MCP_SRV

    UI_HOME & UI_AFIL & UI_EXC & UI_LMS & UI_QR & UI_COPILOT <-->|"HTTPS JSON"| REST_API

    REST_API --> CoreDomain
    MCP_SRV --> CoreDomain

    SVC_WORKFLOW --> SVC_OCR
    SVC_WORKFLOW --> SVC_RULES
    SVC_WORKFLOW --> SVC_AI
    SVC_WORKFLOW --> SVC_TL

    CoreDomain --> PRISMA
    PRISMA <-->|"Pooler :6543 / Direct :5432"| PG_DB
```

---

### 4.2. Diagrama de Flujo Operativo E2E (Filtro 0 → Etapa 1 DNI+CV → Etapa 2 EMO/SCTR → QR)

```mermaid
flowchart TD
    Start(["🏁 1. Admin ECM registra Postulante\n(DNI, Nombre, ECM, Puesto, Estadía)"]) --> Filter0{"🛡️ FILTRO 0:\n¿DNI en Lista Negra?"}

    Filter0 -- "SÍ (Restricción Activa)" --> RedBL["🔴 SEMÁFORO ROJO\nBloqueo inmediato en registro"]
    Filter0 -- "NO (Limpio)" --> Stage1["🟦 ETAPA 1: Primer Filtro de Postulación\nSe solicita ÚNICAMENTE:\n1. DNI\n2. CV Actualizado\n(EMO, SCTR y Certificados quedan con candado 🔒)"]

    Stage1 --> UploadS1["📄 ECM sube DNI y CV Documentado\nMotor OCR + Gemini IA evalúa identidad y especialidad del puesto"]
    UploadS1 --> CheckS1{"📐 ¿DNI es válido y CV cumple\nperfil/especialidad del puesto?"}

    CheckS1 -- "CV no menciona especialidad\no lectura con incertidumbre" --> AmberS1["🟡 CV en ÁMBAR\nDeriva a Bandeja de Excepciones (DHO / Área Usuaria)\n(NO se rechaza a ciegas)"]
    AmberS1 --> HumanS1{"🛡️ Especialista DHO revisa CV\ncon asistencia de Gemini IA"}
    HumanS1 -- "Rechaza perfil" --> RedS1["🔴 CV en ROJO\nPostulante no califica"]
    HumanS1 -- "Aprueba perfil" --> UnlockS2

    CheckS1 -- "SÍ (DNI 🟢 + CV 🟢)" --> UnlockS2["🔓 ETAPA 2 DESBLOQUEADA AUTOMÁTICAMENTE\nSe habilita la carga de:\n• EMO - Anexo 16-16A\n• Constancia SCTR\n• Certificados (CIP / Licencia MTC / Sanidad)\n• DDJJ y Foto"]

    UnlockS2 --> ParallelFork{"⚡ Ejecución Paralela"}

    %% Rama Documental Etapa 2
    ParallelFork --> UploadS2["📄 Carga de Documentos de Etapa 2\nExtracción OCR (< 2 seg): Vigencia + DNI"]
    UploadS2 --> EvalS2{"📊 Evaluación de Vigencias"}
    EvalS2 -- "Vigente (>= Hoy) y DNI coincide" --> DocGreen["🟢 Documento en VERDE\n(Pre-aprobado Zero-Touch)"]
    EvalS2 -- "Fecha borrosa / Sello encima" --> DocAmber["🟡 Documento en ÁMBAR\nBandeja de Excepciones (SSOMA / Área Médica)"]
    EvalS2 -- "Fecha Vencida (< Hoy)" --> DocRed["🔴 Documento en ROJO\nECM reemplaza solo ese archivo sin reiniciar los demás"]
    DocAmber -->|"Revisor aprueba con Gemini IA"| DocGreen
    DocAmber -->|"Revisor observa"| DocRed
    DocRed --> UploadS2

    %% Rama E-Learning
    ParallelFork --> LMS["📚 Inducción E-Learning Asíncrona 24/7\n(Seguridad SSOMA + Medio Ambiente)\nEvaluación aleatoria >= 75% (3/4)"]
    LMS --> LMSGreen["🟢 E-Learning APROBADO\nDescarga de Constancia Digital"]

    %% Consolidación
    DocGreen --> Consolidate{"🚦 Consolidación Semáforo Operativo"}
    LMSGreen --> Consolidate

    Consolidate -- "100% Docs Obligatorios (Etapas 1 y 2) en 🟢\n+ E-Learning en 🟢 + Sin Lista Negra" --> FinalGreen["🟢 SEMÁFORO GLOBAL: VERDE\n(Habilitado en < 48 Horas)"]
    FinalGreen --> IssueQR["🪪 Emisión Automática:\n1. Carné Digital QR firmado (HMAC-SHA256)\n2. Orden de Impresión Fotocheck Físico PVC en Garita"]
```

---

## 5. Modelo de Datos Relacional en Supabase PostgreSQL

El esquema de base de datos está definido en [`packages/backend/prisma/schema.prisma`](packages/backend/prisma/schema.prisma) utilizando nombres en `snake_case` y claves primarias `UUID` para asegurar compatibilidad directa tanto con **Prisma ORM** como con **Spring Data JPA / Hibernate**:

```mermaid
erDiagram
    CONTRACTORS_ECM ||--o{ WORKERS : "emplea"
    STAY_TYPE_REQUIREMENTS ||--o{ WORKER_DOCUMENTS : "define reglas de"
    WORKERS ||--o{ WORKER_DOCUMENTS : "presenta"
    WORKER_DOCUMENTS ||--o{ EXCEPTION_REVIEWS : "genera ticket (si es AMBAR)"
    WORKERS ||--o{ ELEARNING_ATTEMPTS : "rinde"
    WORKERS ||--o| DIGITAL_BADGES_QR : "obtiene al estar en VERDE"
    WORKERS ||--o{ AUDIT_LOGS : "registra bitacora"

    CONTRACTORS_ECM {
        uuid id PK
        varchar ruc UK
        varchar company_name
        boolean is_active
    }

    BLACKLIST_ENTRIES {
        uuid id PK
        varchar dni UK
        varchar full_name
        text reason
        boolean is_active
    }

    STAY_TYPE_REQUIREMENTS {
        uuid id PK
        varchar code UK "DNI, CV_DOC, SCTR, EMO_16..."
        varchar name
        enum stay_type "PERMANENTE_CIA, TEMPORAL, VISITA"
        enum applicable_job "NULL, INGENIERO, CONDUCTOR, COCINA"
        boolean is_mandatory "¿Es obligatorio?"
        boolean requires_validity "¿Requiere vigencia?"
        enum responsible_area "DHO, SSOMA, AREA_MEDICA, AREA_USUARIA"
    }

    WORKERS {
        uuid id PK
        varchar dni UK
        varchar full_name
        uuid contractor_id FK
        enum job_position
        enum stay_type
        enum access_zone "SUPERFICIE, SOCAVON"
        enum traffic_light "VERDE, AMBAR, ROJO"
        varchar status_summary
        boolean is_blacklisted
        boolean elearning_passed
        varchar session_code
    }

    WORKER_DOCUMENTS {
        uuid id PK
        uuid worker_id FK
        uuid requirement_id FK
        varchar file_name
        text extracted_text
        varchar extraction_method "PDF_TEXT, TESSERACT_OCR"
        float ocr_confidence
        varchar detected_dni
        date detected_expiry_date
        enum status "PENDIENTE, VERDE, AMBAR, ROJO"
        varchar status_reason
    }

    EXCEPTION_REVIEWS {
        uuid id PK
        uuid worker_document_id FK
        enum assigned_area
        enum review_status "OPEN, APPROVED, REJECTED"
        varchar reason_triggered
        varchar reviewer_name
        text reviewer_comment
        date manual_expiry_date
    }

    DIGITAL_BADGES_QR {
        uuid id PK
        uuid worker_id FK
        varchar badge_code UK
        text qr_payload_json
        varchar signature_hash "HMAC-SHA256"
        enum pvc_print_status "QUEUED_GARITA, PRINTED, DELIVERED"
        date valid_until
    }
```

---

## 6. Motor OCR Híbrido, Inteligencia Artificial (Google Gemini) y Semáforo Operativo

### 6.1. Pipeline de Extracción y Reglas ([`ocr.service.ts`](packages/backend/src/services/ocr.service.ts) + [`rules.service.ts`](packages/backend/src/services/rules.service.ts))
1. **Nivel 1 — Decodificación Rápida de PDF (`pdf-parse` + `zlib` FlateDecode)**: Extrae texto embebido de PDFs en `< 150 ms`.
2. **Nivel 2 — Reconocimiento Óptico (`tesseract.js`)**: Procesa imágenes (`PNG`, `JPG`) o PDFs escaneados.
3. **Nivel 3 — Fallback Multimodal con Google Gemini IA ([`ai.service.ts`](packages/backend/src/services/ai.service.ts))**:
   - Si el documento tiene formato complejo y el extractor regex no detecta fecha o DNI, entra automáticamente una cadena de alta disponibilidad con **Google Gemini** (`gemini-3.1-flash-lite` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.8-flash`) que analiza el documento y devuelve JSON tipado (`{ detectedDni, detectedName, detectedExpiryDate, isDocumentValid, summaryReason }`).
4. **Validación Contextual de Especialidad en el CV (`CV_DOC`)**:
   - Verifica que el texto del CV contenga las competencias y especialidad asociadas al puesto registrado (ej. `Ingeniero / CIP / Colegiado` para `INGENIERO`; `Licencia / MTC / Manejo Defensivo` para `CONDUCTOR`; `Gastronomía / Alimentos / Sanidad` para `PERSONAL_COCINA`). Si no las detecta, deriva el CV en **`ÁMBAR`** a la Bandeja de Excepciones sin rechazarlo a ciegas.

---

## 7. Servidor MCP (Model Context Protocol) — Tools y Resources

El backend incluye un servidor **MCP oficial** en [`packages/backend/src/mcp/server.ts`](packages/backend/src/mcp/server.ts) que permite a agentes de IA (como Claude Desktop, Antigravity o copilotos corporativos) operar y auditar el sistema de afiliación:

### 7.1. Las 8 Tools Expuestas por el Servidor MCP

| # | Nombre de la Tool MCP | Descripción Funcional |
| :---: | :--- | :--- |
| **1** | `register_worker` | Registra un trabajador contratista en Supabase PostgreSQL, ejecuta el Filtro 0 contra la Lista Negra y genera su checklist de documentos por estadía y puesto. |
| **2** | `analyze_worker_document` | Procesa un documento (texto o archivo Base64) con el motor OCR + Reglas (respetando el bloqueo de Etapa 1 `DNI + CV` antes de Etapa 2) y actualiza el Semáforo. |
| **3** | `get_worker_traffic_light` | Consulta por DNI el estado completo del Semáforo Operativo (`VERDE`/`ÁMBAR`/`ROJO`), documentos de Etapa 1 y Etapa 2, E-Learning y Carné QR. |
| **4** | `list_exception_tray` | Lista los tickets abiertos (`OPEN`) en estado `ÁMBAR` en la Bandeja de Excepciones filtrados por área (`SSOMA`, `AREA_MEDICA`, `DHO`, `AREA_USUARIA`). |
| **5** | `resolve_exception_ticket` | Permite aprobar (`VERDE`) o rechazar (`ROJO`) un caso de la Bandeja de Excepciones registrando dictamen, fecha manual y trazabilidad en `audit_logs`. |
| **6** | `complete_elearning_simulation` | Registra la calificación del módulo teórico E-Learning (`0 a 4`) y recalcula el Semáforo Global. |
| **7** | `verify_garita_qr` | Verifica criptográficamente en Garita de Seguridad un código de Carné QR o DNI (`HMAC-SHA256`, Semáforo `VERDE`, vigencia y estado de Fotocheck PVC). |
| **8** | `generate_demo_scenario` | Crea en 1 paso cualquiera de los 4 escenarios demostrativos con PDFs reales leídos por el motor OCR (`ZERO_TOUCH_GREEN`, `EXCEPTION_AMBER`, `EXPIRED_RED`, `BLACKLISTED_RED`). |

### 7.2. Los 3 Resources de Contexto MCP
- `bateas://masters/requirements` → Matriz oficial `Documentos por estadía` de App Bateas v2.1.0.
- `bateas://masters/blacklist` → Padrón activo de Lista Negra.
- `bateas://metrics/summary` → Indicadores KPI y tasa de automatización Zero-Touch en vivo.

### 7.3. Ejemplo de Configuración MCP para Clientes (`claude_desktop_config.json` / IDE)

```json
{
  "mcpServers": {
    "bateas-zerotouch": {
      "command": "npx",
      "args": [
        "tsx",
        "C:/Users/andyj/Documents/git1/ZeroTouch/packages/backend/src/mcp/stdio.ts"
      ]
    }
  }
}
```
*(Para clientes MCP remotos sobre la versión desplegada en Vercel, el endpoint Streamable HTTP está expuesto en `https://tu-dominio.vercel.app/api/mcp`).*

---

## 8. Guía de Uso, Credenciales por Rol y Guion de Exposición

### 8.1. Credenciales Corporativas de Prueba (Login RBAC)

| Rol en la Plataforma | Usuario / Correo | Contraseña | Módulos Principales que Utiliza |
| :--- | :---: | :---: | :--- |
| **1. Administrador ECM / Contratista** | `ecm@bateas.pe` | `Bateas2026!` | Afiliar postulantes, subir Etapa 1 (`DNI + CV`), desbloquear Etapa 2 (`EMO`, `SCTR`), rendir E-Learning 24/7. |
| **2. Especialista SSOMA / Médico / DHO** | `ssoma@bateas.pe` | `Bateas2026!` | Panel de Control (Donas 87.9% vs. TO-BE), Bandeja de Excepciones Split-Screen con Gemini IA, Maestros y Lista Negra. |
| **3. Control Patrimonial y Garita** | `garita@bateas.pe` | `Bateas2026!` | Escáner verificador criptográfico de Carné QR (`HMAC-SHA256`) y cola de impresión de Fotocheck físico en PVC. |

---

### 8.2. Guion Recomendado para Exponer el Proyecto ante el Jurado / Cliente (5 Minutos)

1. **Minuto 1 — El Problema Real en Números (`Inicio → Panel de control`)**:
   - Inicia sesión con `ssoma@bateas.pe` (`Bateas2026!`) y abre la pestaña **Panel de control**.
   - Muestra el gráfico de dona izquierdo con el hallazgo real en App Bateas v2.1.0 (**87.9% / 3,152 contratistas con documentos vencidos**) y compáralo con el gráfico derecho en tiempo real conectado a **Supabase PostgreSQL**.
2. **Minuto 2 — El Nuevo Filtro de Postulación en 2 Etapas (`Afiliaciones → ○ Afiliados`)**:
   - Registra un trabajador nuevo en **`+ Nuevo`** (o selecciona uno en proceso).
   - Muestra cómo en la **🟦 Etapa 1 (Primer Filtro de Postulación)** solo se pide **`DNI`** y **`CV Documentado`**, mientras que la **🔒 Etapa 2 (`EMO`, `SCTR`, `Certificados`)** está bloqueada con candado para no pedir trámites médicos costosos antes de validar al candidato.
   - En la fila del `CV DOCUMENTADO`, pulsa **`CV Sin Especialidad (Ámbar)`** para demostrar que si el postulante no tiene la especialidad del puesto, el sistema no lo rechaza a ciegas, sino que lo envía a evaluación humana en `ÁMBAR`. Luego pulsa **`DNI Válido (Verde)`** y **`CV Cumple Perfil (Verde)`** y muestra cómo **se abre automáticamente el candado de la 🔓 Etapa 2**.
3. **Minuto 3 — Caso Zero-Touch vs. Bandeja de Excepciones con Gemini IA (`○ Bandeja Excepciones`)**:
   - Pulsa en la barra superior **`🟡 Excepción EMO (Ámbar)`** y entra a **`○ Bandeja Excepciones`**.
   - Explica que el 80% de documentos sanos jamás pasa por aquí. En el visor **Split-Screen**, haz clic en **`✨ Analizar con Gemini IA`** para que Google Gemini audite el documento observado, y luego pulsa **`✅ Validar y Aprobar Documento (Pasa a VERDE)`**.
4. **Minuto 4 — E-Learning Asíncrono 24/7 (`○ Inducciones E-Learning`)**:
   - Muestra las cápsulas de *Seguridad SSOMA* y *Medio Ambiente*, la evaluación de 4 preguntas y el botón **`📥 Descargar Constancia`**.
5. **Minuto 5 — Escaneo Criptográfico QR en Garita, Fotocheck PVC y Copiloto IA (`Control de accesos / QR`)**:
   - Entra a **`Control de accesos / QR`**, pulsa **`Escanear QR`** en la credencial de *Carlos Antonio Ramírez* para demostrar la verificación de firma `HMAC-SHA256` (`✅ PASE AUTORIZADO EN GARITA`), pulsa **`Imprimir PVC`** y finalmente abre el **`✨ Copiloto Gemini IA`** arriba a la derecha para pedirle un resumen ejecutivo en vivo.

---

## 9. Instalación Local, Pruebas Automatizadas y Despliegue en Vercel

### 9.1. Variables de Entorno (`packages/backend/.env`)

```env
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
PORT=4000
QR_SIGNING_SECRET="bateas-zerotouch-myopia-2026-secret-key"
GEMINI_API_KEY="TU_GEMINI_API_KEY"
```

### 9.2. Comandos de Ejecución y Verificación SDD

```bash
# 1. Instalar dependencias de todo el monorepo
npm install

# 2. Sincronizar esquema Prisma con Supabase PostgreSQL y sembrar maestros de App Bateas v2.1.0
npm run db:push
npm run db:seed

# 3. Ejecutar suite de pruebas SDD (Motor OCR + Reglas + Semáforo + Servidor MCP E2E)
npm --workspace=packages/backend run test
npx --workspace=packages/backend tsx src/tests/verify-mcp.ts

# 4. Levantar servidores en modo desarrollo
npm run dev:backend   # API REST en http://localhost:4000/api/v1 y MCP en http://localhost:4000/api/mcp
npm run dev:frontend  # Web App en http://localhost:5173
```

---

## 10. Índice de Documentación SDD y Manual de Usuario en PDF

Toda la ingeniería documental del proyecto se encuentra en la carpeta [`docs/`](docs/):

- 📘 **[Manual y Guía Visual de Usuario con Capturas y Flechas (PDF)](docs/Guia_Usuario_Bateas_ZeroTouch_Equipo_Myopia.pdf)** — Documento de 10 páginas listo para entregar al cliente y jurado.
- 📗 **[Documento Maestro Consolidado de Arquitectura y Producto](docs/DOCUMENTO_MAESTRO_BATEAS_ZEROTOUCH.md)** — Unificación corregida de los Entregables 1, 2 y 3.
- 📐 **Especificaciones Técnicas SDD (`docs/specs/`)**:
  - [Spec 01 — Arquitectura del Sistema y Diagramas de Flujo](docs/specs/01-arquitectura-y-flujos.md)
  - [Spec 02 — Esquema PostgreSQL y Prisma ORM (Compatible con Spring Boot JPA)](docs/specs/02-esquema-postgres-prisma.md)
  - [Spec 03 — Motor OCR, Reglas de Perfil/Vigencia y Semáforo Operativo](docs/specs/03-motor-ocr-reglas-semaforo.md)
  - [Spec 04 — Contratos API REST y Servidor MCP](docs/specs/04-contratos-api-y-mcp.md)
  - [Spec 05 — Frontend Web Corporativo React (App Bateas v2.1.0) y Carné QR](docs/specs/05-frontend-react-y-carnet-qr.md)
- 📄 **Entregables Originales de Referencia**:
  - [Entregable 1 — Diagnóstico y Propuesta Conceptual](docs/Entregable_1_Equipo_Myopia.pdf)
  - [Entregable 2 — Business Model Canvas y Evidencia Empírica (87.9% Vencidos)](docs/entregable%202%20equipo%20Myopia.pdf)
  - [Entregable 3 — Matriz de Construcción del MVP y Acoplamiento App Bateas v2.1.0](docs/Entregable_3%20Equipo%20Myopia.pdf)
