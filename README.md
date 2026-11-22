# Bateas Zero-Touch — Onboarding 360 (Equipo MYOPIA)

Plataforma inteligente de pre-validación documental mediante **OCR**, **Motor de Reglas por Perfil**, **Gestión por Excepciones**, **E-Learning Asíncrono 24/7**, **Semáforo Operativo (`VERDE`/`ÁMBAR`/`ROJO`)** y **Emisión Automática de Carné Digital QR + Cola de Fotocheck Físico PVC**, diseñada para reducir el tiempo de afiliación de contratistas permanentes en **Minera Bateas S.A.C.** de >5 días a menos de 48 horas.

---

## Arquitectura (SDD — Spec-Driven Development)

- **Frontend (`packages/frontend`)**: React 19 + TypeScript + Vite + Tailwind CSS + Generador QR (`qrcode.react`).
- **Backend & Core Domain (`packages/backend`)**: Node.js + TypeScript + Express + Zod + Motor OCR Híbrido (`pdf-parse` + `tesseract.js` + `pdf-lib`).
- **Servidor MCP (`packages/backend/src/mcp`)**: Implementado con `@modelcontextprotocol/sdk` (7 Tools + 3 Resources), disponible tanto por `stdio` como por HTTP/SSE (`/mcp/sse`).
- **Base de Datos (`packages/backend/prisma`)**: **Supabase PostgreSQL** gestionado con **Prisma ORM** (esquema normalizado en `snake_case` compatible 1:1 con futura evolución a **Spring Boot / Spring Data JPA**).

---

## Documentación y Especificaciones SDD

- [Documento Maestro Consolidado](docs/DOCUMENTO_MAESTRO_BATEAS_ZEROTOUCH.md)
- [Spec 01 — Arquitectura y Diagramas de Flujo](docs/specs/01-arquitectura-y-flujos.md)
- [Spec 02 — Esquema PostgreSQL y Prisma ORM](docs/specs/02-esquema-postgres-prisma.md)
- [Spec 03 — Motor OCR, Reglas y Semáforo Operativo](docs/specs/03-motor-ocr-reglas-semaforo.md)
- [Spec 04 — Contratos API REST y Servidor MCP](docs/specs/04-contratos-api-y-mcp.md)
- [Spec 05 — Frontend React y Carné Digital QR](docs/specs/05-frontend-react-y-carnet-qr.md)

---

## Comandos Rápidos

```bash
# 1. Instalar dependencias
npm install

# 2. Sincronizar esquema Prisma con Supabase PostgreSQL y cargar datos semilla de App Bateas v2.1.0
npm run db:push
npm run db:seed

# 3. Ejecutar pruebas SDD (Core Domain + Servidor MCP contra Supabase)
npm --workspace=packages/backend run test
npx --workspace=packages/backend tsx src/tests/verify-mcp.ts

# 4. Levantar servidores de desarrollo
npm run dev:backend   # http://localhost:4000/api/v1 y MCP SSE en http://localhost:4000/mcp/sse
npm run dev:frontend  # http://localhost:5173
```
