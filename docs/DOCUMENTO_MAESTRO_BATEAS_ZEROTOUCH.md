# Documento Maestro de Arquitectura y Producto — Bateas Zero-Touch
**Proyecto:** Bateas Zero-Touch (Integración sobre App Bateas v2.1.0 / Bateas Mobile 360)  
**Equipo:** MYOPIA — Ideatón William Morris (Copa Emprende 2026 | Minera Bateas S.A.C.)  
**Versión:** 2.0 (Consolidación Corregida + Stack React / Node.js / MCP / PostgreSQL)

---

## 1. Resumen Ejecutivo y Diagnóstico Validado

El proceso de afiliación de **Contratistas Permanentes** (vínculo laboral o de servicio mayor a 30 días, categorizados en el sistema real como `PERMANENTE CIA`) es el flujo más crítico para la continuidad operativa de la Unidad Minera Bateas.

Durante la auditoría empírica del entorno real (**App Bateas v2.1.0**) y las sesiones de validación con el área de Desarrollo Humano y Organización (**DHO**), se evidenció que:
- De un universo de **3,585 trabajadores contratistas registrados**, **3,152 (87.9%)** presentan al menos un documento vencido.
- **51 trabajadores (1.4%)** tienen documentos próximos a vencer en un horizonte de 20 días.
- Solo **382 trabajadores (10.7%)** mantienen la totalidad de su documentación vigente.

### 1.1. Los Dos Cuellos de Botella Estructurales (AS-IS)
1. **Aprobaciones secuenciales y 100% manuales**: El flujo tradicional obligaba a una revisión humana en cadena (`Área Usuaria → SSOMA → Área Médica → DHO`), consumiendo en promedio **2.5 minutos de lectura manual por documento**. Si un documento presentaba un error de forma o vigencia vencida, el rechazo reiniciaba toda la cadena, extendiendo un proceso teórico de 5 días a plazos impredecibles.
2. **Rigidez logística en inducciones presenciales**: Las capacitaciones teóricas transversales dependían de fechas y horarios fijos presenciales, generando inmovilización de personal en campamento.

---

## 2. Propuesta de Valor y Solución TO-BE: "Bateas Zero-Touch"

**Bateas Zero-Touch** transforma el flujo secuencial manual en un **flujo paralelo automatizado con gestión por excepciones**, estableciendo como meta operativa:
- Reducir el tiempo total de habilitación de **> 5 días a un máximo de 48 horas**.
- Reducir el tiempo de lectura y validación documental de **2.5 minutos a menos de 10 segundos por documento**.
- Disminuir en un **80% la carga administrativa** de SSOMA, Área Médica y DHO, derivando a revisión humana únicamente el ~20% de casos atípicos u observados (**Bandeja de Excepciones**).

### 2.1. Los 5 Pilares del Núcleo del MVP
1. **Motor de Reglas por Perfil y Estadía (Acoplado a App Bateas v2.1.0)**: Consume la tabla maestra `Documentos por estadía` respetando las banderas nativas `¿Es obligatorio?` y `¿Requiere vigencia?`, suplementada con los requisitos específicos del puesto (`Conductor`, `Ingeniero`, `Personal de cocina`, `Operario`) y el cruce automático contra la tabla de **Lista Negra**.
2. **Pre-validación Inteligente mediante OCR**: Extrae texto embebido o aplica OCR sobre documentos PDF/imágenes (`DNI`, `SCTR`, `EMO - Anexo 16/16A`, `ISEM`, licencias), identificando **Número de DNI**, **Nombre del titular** y **Fecha de vencimiento** en menos de 10 segundos.
3. **Bandeja de Excepciones (SSOMA / Médico / DHO)**: Los documentos legibles, vigentes y consistentes pasan directamente a estado `VERDE` (**Zero-Touch**). Solo los documentos con lectura incierta, ilegibles o con discrepancias caen en estado `ÁMBAR` y se enrutan a la bandeja del área competente.
4. **Módulo E-Learning Asíncrono 24/7**: Desbloqueo automático de las inducciones teóricas transversales (*Seguridad General* y *Medio Ambiente*) con validación de sesión (`DNI + Código Único de Sesión`) y evaluación aleatoria con nota mínima aprobatoria del **75% (3/4)**.
5. **Semáforo Operativo en Tiempo Real + Carné Digital QR / Orden PVC**: Cuando el 100% de documentos obligatorios alcanza `VERDE`, el E-Learning está aprobado y no existen alertas en Lista Negra, el Semáforo Global pasa a `VERDE`, emitiendo instantáneamente el **Carné Digital con Código QR verificable** y generando la orden de impresión del **Fotocheck físico en PVC** en garita.

---

## 3. Correcciones Críticas sobre el Prototipo Previo

Esta especificación corrige formalmente las desviaciones detectadas entre los Entregables 1–3 y el prototipo exploratorio previo:
- **Eliminación de la cadena secuencial manual de 4 pasos**: Se erradica el bloqueo donde `Área Usuaria → SSOMA → Médico → DHO` debían aprobar manualmente cada expediente sano. Ahora rige el modelo **Zero-Touch Puro**: los documentos conformes se aprueban automáticamente y la intervención humana ocurre **exclusivamente por excepción (estado `ÁMBAR`)**.
- **Reemplazo quirúrgico de documentos observados**: Si un documento cae en `ROJO` (vencido o rechazado), la Empresa Contratista Minera (ECM) solo reemplaza ese archivo puntual sin invalidar ni reiniciar los demás documentos que ya están en `VERDE`.
- **Validación de Identidad y Lista Negra**: El motor ya no se limita a buscar una fecha aislada; verifica que el DNI extraído del documento corresponda al trabajador afiliado y que dicho DNI no registre bloqueo activo en la Lista Negra de Minera Bateas.

---

## 4. Arquitectura Tecnológica e Integración MCP (Fase 1 y Evolución a Fase 2)

### 4.1. Stack Tecnológico de Primera Entrega (MVP Productivo & Agéntico)
- **Frontend**: **React 19 + TypeScript + Vite + Tailwind CSS** (Dos portales integrados: *Portal ECM / Trabajador* y *Portal Revisor Bateas / Bandeja de Excepciones* + *Simulador de Garita QR*).
- **Backend & Core Engine**: **Node.js (TypeScript)** con API REST (**Express / Fastify + Zod**) y servicios de dominio desacoplados.
- **Servidor MCP (Model Context Protocol)**: Integrado en el backend Node.js mediante el SDK oficial `@modelcontextprotocol/sdk`, exponiendo **7 Tools**, **3 Resources** y **2 Prompts** para permitir que agentes de IA operen y auditen la plataforma en tiempo real.
- **Motor OCR en Node.js**: Pipeline híbrido con `pdf-parse` / `pdfjs-dist` para extracción ultrarrápida de texto nativo en PDFs y `tesseract.js` + `sharp` para documentos escaneados o fotografías.
- **Base de Datos Relacional**: **PostgreSQL 16** (orquestada vía Docker Compose) gestionada con **Prisma ORM**, garantizando integridad transaccional ACID y trazabilidad completa.

### 4.2. Hoja de Ruta hacia Fase 2 (Spring Boot Enterprise)
El esquema de base de datos en **PostgreSQL** (`snake_case`, UUIDs nativos, claves foráneas estrictas) y los contratos REST JSON han sido diseñados con compatibilidad 1:1 para que en la Fase 2 el backend pueda migrarse o coexistir con microservicios en **Java / Spring Boot (Spring Data JPA + Hibernate + Spring AI MCP)** sin alterar la base de datos PostgreSQL ni el frontend en React.

---

## 5. Índice de Especificaciones SDD (`docs/specs/`)

El desarrollo del software se rige estrictamente por las siguientes especificaciones técnicas:
1. `docs/specs/01-arquitectura-y-flujos.md` — Diagramas de arquitectura, flujos Zero-Touch E2E y estructura del monorepo.
2. `docs/specs/02-esquema-postgres-prisma.md` — Modelo entidad-relación, `schema.prisma` completo y datos semilla de App Bateas v2.1.0.
3. `docs/specs/03-motor-ocr-reglas-semaforo.md` — Algoritmo del pipeline OCR, expresiones regulares, cruce de Lista Negra y tabla de verdad del Semáforo Operativo.
4. `docs/specs/04-contratos-api-y-mcp.md` — Especificación de endpoints REST y contratos JSON-RPC del Servidor MCP.
5. `docs/specs/05-frontend-react-y-carnet-qr.md` — Especificación de vistas React, experiencia UX/UI, Bandeja de Excepciones y Carné Digital QR.
