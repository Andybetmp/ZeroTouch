# Spec 01 — Arquitectura del Sistema y Diagramas de Flujo (SDD)

## 1. Estructura del Monorepo (React + Node.js + MCP + PostgreSQL)

```text
ZeroTrust/
├── docker-compose.yml                  # PostgreSQL 16 + pgAdmin opcional
├── package.json                        # Workspaces (backend, frontend)
├── docs/
│   ├── DOCUMENTO_MAESTRO_BATEAS_ZEROTOUCH.md
│   └── specs/
│       ├── 01-arquitectura-y-flujos.md
│       ├── 02-esquema-postgres-prisma.md
│       ├── 03-motor-ocr-reglas-semaforo.md
│       ├── 04-contratos-api-y-mcp.md
│       └── 05-frontend-react-y-carnet-qr.md
├── packages/
│   ├── backend/                        # Node.js + TypeScript + Prisma + Express + MCP
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Esquema PostgreSQL compatible con Spring Boot JPA
│   │   │   └── seed.ts                 # Maestros de App Bateas v2.1.0 + Lista Negra + Demos
│   │   └── src/
│   │       ├── config/                 # Variables de entorno y conexión Prisma
│   │       ├── services/               # Core Domain (compartido por REST API y MCP Server)
│   │       │   ├── ocr.service.ts      # pdf-parse + tesseract.js + regex DNI/Fechas
│   │       │   ├── rules.service.ts    # Validación de vigencias, DNI y Lista Negra
│   │       │   ├── trafficLight.service.ts # Máquina de estados VERDE/AMBAR/ROJO
│   │       │   ├── elearning.service.ts    # Sesiones y evaluación aleatoria
│   │       │   └── qrBadge.service.ts      # Emisión de Carné Digital QR + Cola PVC
│   │       ├── api/                    # Rutas REST (/api/v1/*) para React
│   │       ├── mcp/                    # Servidor MCP (@modelcontextprotocol/sdk)
│   │       │   └── server.ts           # Tools, Resources y Prompts
│   │       └── index.ts                # Entrypoint HTTP + SSE MCP
│   └── frontend/                       # React 19 + TypeScript + Vite + Tailwind CSS
│       └── src/
│           ├── pages/
│           │   ├── contractor/         # Portal ECM y Aula E-Learning Trabajador
│           │   ├── reviewer/           # Bandeja de Excepciones (SSOMA/Médico/DHO) + KPIs
│           │   └── gatehouse/          # Visor de Carné Digital QR y Cola Fotocheck PVC
│           └── components/
```

---

## 2. Diagrama de Arquitectura de Componentes

```mermaid
flowchart TB
    subgraph Clientes["👥 Usuarios y Clientes IA"]
        ECM["👷 Admin ECM / Trabajador"]
        REV["🛡️ Revisor SSOMA / Médico / DHO"]
        MCP_CLI["🤖 Cliente MCP (Agente IA / IDE)"]
    end

    subgraph Frontend["⚛️ Frontend React (Vite + TypeScript)"]
        UI_ECM["Portal Contratista & E-Learning"]
        UI_REV["Bandeja de Excepciones & Dashboard Semáforo"]
        UI_QR["Carné Digital QR & Monitor Garita PVC"]
    end

    subgraph Backend["🟩 Backend Node.js (TypeScript)"]
        API["🌐 API REST (/api/v1)"]
        MCP["🔌 MCP Server (@modelcontextprotocol/sdk)"]

        subgraph Core["⚙️ Core Domain Layer"]
            SVC_OCR["OCR Service (pdf-parse + Tesseract.js)"]
            SVC_RULES["Rules & Blacklist Service"]
            SVC_TL["TrafficLight Engine (🟢/🟡/🔴)"]
            SVC_LMS["E-Learning Quiz Engine"]
            SVC_QR["QR Badge & PVC Queue Service"]
        end

        ORM["🔷 Prisma ORM"]
    end

    subgraph DB["🐘 PostgreSQL 16"]
        PG[("Base de Datos Relacional\nbateas_zerotouch")]
    end

    ECM --> UI_ECM
    REV --> UI_REV
    REV --> UI_QR
    MCP_CLI <-->|"MCP Protocol (stdio / SSE)"| MCP

    UI_ECM <--> API
    UI_REV <--> API
    UI_QR <--> API

    API --> Core
    MCP --> Core
    Core --> ORM
    ORM <--> PG
```

---

## 3. Flujo Operativo Zero-Touch Puro (To-Be)

```mermaid
sequenceDiagram
    autonumber
    actor ECM as 👷 Admin ECM / Trabajador
    participant UI as ⚛️ React Portal
    participant CORE as 🟩 Node Core (OCR + Reglas + Semáforo)
    participant PG as 🐘 PostgreSQL
    actor REV as 🛡️ Revisor (SSOMA/Médico/DHO)

    ECM->>UI: Registra trabajador (DNI, Nombre, Puesto, Estadía)
    UI->>CORE: POST /api/v1/workers
    CORE->>PG: Verifica DNI en blacklist_entries
    alt DNI en Lista Negra
        CORE->>PG: Guarda trabajador con traffic_light = ROJO
        CORE-->>UI: 🔴 Bloqueo por Lista Negra
    else DNI Limpio
        CORE->>PG: Crea trabajador (ÁMBAR) + slots de documentos según stay_type_requirements
        CORE-->>UI: Checklist personalizado + Código de sesión E-Learning
    end

    par Pilar 1: Carga y Validación OCR
        ECM->>UI: Sube PDF/Imagen de requisito (ej. SCTR, EMO, DNI)
        UI->>CORE: POST /api/v1/workers/:id/documents
        CORE->>CORE: Extrae texto (pdf-parse / Tesseract.js) + DNI + Fecha Vigencia
        alt Legible + DNI coincide + Vigente (o no requiere vigencia)
            CORE->>PG: Documento = VERDE (Zero-Touch)
        else Ilegible / Sin fecha / DNI discrepante
            CORE->>PG: Documento = ÁMBAR + Crea ticket en exception_reviews
            REV->>UI: Abre Bandeja de Excepciones (solo casos ÁMBAR)
            UI->>CORE: PATCH /api/v1/exceptions/:id/resolve
            CORE->>PG: Actualiza documento a VERDE (si aprueba) o ROJO (si observa)
        else Fecha Vencida (< Hoy)
            CORE->>PG: Documento = ROJO (Rechazo inmediato)
        end
    and Pilar 2: Inducción E-Learning Asíncrona 24/7
        ECM->>UI: Ingresa a E-Learning con DNI + Código de Sesión
        ECM->>UI: Completa lectura y envía evaluación (4 preguntas aleatorias)
        UI->>CORE: POST /api/v1/elearning/submit
        CORE->>PG: Registra intento (Si aciertos >= 3 -> elearning_passed = true)
    end

    CORE->>CORE: Recalcula Semáforo Global (TrafficLightEngine)
    opt 100% Docs Obligatorios en VERDE + E-Learning Aprobado + Sin Lista Negra
        CORE->>PG: traffic_light = VERDE + Emite digital_badges_qr + Orden PVC
        CORE-->>UI: 🟢 Habilitado en <48h + Carné Digital QR listo
    end
```
