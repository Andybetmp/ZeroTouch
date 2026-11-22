# Spec 05 — Especificación Frontend React y Carné Digital QR (SDD)

## 1. Arquitectura Visual y Experiencia de Usuario

El frontend en **React 19 + TypeScript + Tailwind CSS + Lucide Icons** emula la identidad visual corporativa de **App Bateas v2.1.0** (mostrada en el Entregable 3, Figuras 2 y 3) con una barra lateral oscura y tarjetas de estado de alto contraste para el **Semáforo Operativo**.

La aplicación cuenta con un selector rápido de vista en el encabezado para alternar durante las demostraciones entre los **3 roles clave**:
1. **👷 Portal Empresa Contratista (ECM) / Trabajador**
2. **🛡️ Portal Interno Minera Bateas (SSOMA / Área Médica / DHO — Bandeja de Excepciones)**
3. **🚧 Control de Garita (Verificador QR y Cola de Impresión Fotocheck PVC)**

---

## 2. Especificación de Pantallas y Componentes

### 2.1. Vista 1: Portal Empresa Contratista (ECM) y Trabajador
- **Generador Rápido de Escenarios Demo (1-Click)**:
  - Botones para crear casos completos con PDFs reales analizados por el motor OCR:
    1. *Caso Zero-Touch (`VERDE`)*: Todos los documentos vigentes y legibles → pre-aprobación automática sin humanos.
    2. *Caso con Excepción (`ÁMBAR`)*: SCTR vigente pero EMO sin fecha legible → envía solo el EMO a la Bandeja de Excepciones del Área Médica.
    3. *Caso Documento Vencido (`ROJO`)*: SCTR con fecha vencida → bloqueo automático.
    4. *Caso Lista Negra (`ROJO`)*: DNI con restricción en Lista Negra → bloqueo inmediato en registro.
- **Módulo de Registro y Checklist Dinámico**:
  - Formulario con DNI (8 dígitos), Nombre completo, ECM, Puesto (`Operario`, `Conductor`, `Ingeniero`, `Personal de cocina`), Estadía (`PERMANENTE CIA`) y Zona (`Superficie`, `Socavón`).
  - Muestra la tabla de requisitos con las etiquetas reales de App Bateas: badge `¿Es obligatorio?: Sí/No` y badge `¿Requiere vigencia?: Sí/No`.
- **Tarjetas de Carga Documental con OCR Instantáneo**:
  - Al subir un PDF o imagen, se ejecuta el análisis OCR automáticamente sin requerir un segundo botón manual.
  - Muestra: Estado (`🟢 VERDE`, `🟡 ÁMBAR`, `🔴 ROJO`), Fecha de vencimiento extraída, DNI detectado, Método (`Texto PDF` o `Tesseract OCR`), Confianza `%` y acordeón para inspeccionar el texto extraído.
  - **Reemplazo sin reinicio**: Si un documento queda en `ROJO`, la ECM puede subir el archivo corregido y solo se re-evalúa ese requisito, manteniendo intactos los demás documentos en `VERDE`.
- **Aula Móvil E-Learning Asíncrono 24/7**:
  - Tarjetas interactivas de lectura (*Seguridad General* y *Medio Ambiente*) + Cuestionario de 4 preguntas aleatorias con calificación inmediata y emisión de certificado.

### 2.2. Vista 2: Portal Revisor Minera Bateas (Gestión por Excepciones)
- **Dashboard Semáforo Operativo**:
  - Indicadores KPI superiores: Total Expedientes, `🟢 Habilitados Zero-Touch`, `🟡 En Bandeja de Excepciones`, `🔴 Bloqueados (Vencidos / Lista Negra)`, y `% Ahorro de Carga Manual`.
  - Tabla maestra filtrable por Semáforo (`VERDE`, `ÁMBAR`, `ROJO`), Empresa Contratista y Puesto.
- **Bandeja de Excepciones (`ExceptionTray`)**:
  - Filtro por área responsable: `SSOMA`, `Área Médica`, `DHO`, `Área Usuaria`.
  - **Regla de Oro Zero-Touch**: Aquí **no** aparecen los documentos `VERDE`. Solo aparecen los tickets `OPEN` cuyos documentos cayeron en `ÁMBAR` (por baja legibilidad, fecha ambigua o discrepancia de DNI).
  - El revisor visualiza el texto extraído/archivo, puede ingresar la fecha de vigencia verificada manualmente y pulsar **Aprobar Excepción (Pasa a `VERDE`)** o **Rechazar con Observación (Pasa a `ROJO`)**.
- **Administrador de Maestros (App Bateas v2.1.0)**:
  - Vista de la tabla `Documentos por estadía` (réplica de la Figura 3 del Entregable 3) y gestión de la tabla `Lista Negra`.

### 2.3. Vista 3: Carné Digital QR y Cola de Fotocheck PVC en Garita
- **Tarjeta de Carné Digital (`DigitalBadgeCard`)**:
  - Se desbloquea automáticamente en cuanto el Semáforo Global alcanza `🟢 VERDE`.
  - Renderiza un código QR real (SVG/Canvas) que codifica el JSON firmado (`badgeCode`, `dni`, `fullName`, `companyName`, `jobPosition`, `accessZone`, `validUntil`, `signatureHash`).
- **Cola de Impresión Física en PVC (Protocolo de Garita)**:
  - Cumpliendo el requisito validado con DHO en los Entregables 2 y 3 (los trabajadores usan guantes de seguridad en campo y requieren su credencial física en PVC además del QR digital), muestra el estado de impresión física (`En cola de Garita` → botón `Imprimir y Entregar Fotocheck PVC`).
