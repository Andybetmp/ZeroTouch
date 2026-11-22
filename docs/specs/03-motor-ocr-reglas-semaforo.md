# Spec 03 — Motor OCR en Node.js, Reglas de Validación y Semáforo Operativo (SDD)

## 1. Pipeline de Extracción OCR Híbrido en Node.js (`ocr.service.ts`)

Para alcanzar la métrica validada en el **Entregable 2** (**menos de 10 segundos por documento**, frente a los 2.5 minutos de revisión manual), el servicio OCR en Node.js opera en dos niveles:

1. **Nivel 1 — Extracción Nativa de PDF (`pdf-parse`)**:
   - Si el archivo es `application/pdf`, se extraen las primeras 3 páginas en `< 150 ms`.
   - Si el texto limpio extraído tiene `>= 25 caracteres`, se etiqueta como `extractionMethod = "PDF_TEXT"` con `ocrConfidence = 99.0`.
2. **Nivel 2 — Reconocimiento Óptico de Caracteres (`tesseract.js` + `sharp`)**:
   - Si el archivo es una imagen (`image/png`, `image/jpeg`) o un PDF escaneado (`< 25 caracteres`), se pre-procesa con `sharp` (escala de grises, normalización de contraste) y se procesa con un worker persistente en caché de `tesseract.js` (`spa`).
   - Se obtiene el texto y el `confidence` (`0 - 100`).

---

## 2. Extractores Contextuales (`rules.service.ts`)

Sobre el texto extraído se ejecutan tres extractores deterministas:

### 2.1. Extractor de Fecha de Vencimiento / Vigencia
Soporta separadores `/`, `-`, `.` y formatos `DD/MM/YYYY` o `YYYY-MM-DD`:
```typescript
const EXPIRY_REGEX = /(?:fecha\s+(?:de\s+)?vencimiento|vencimiento|vigencia\s+hasta|v[aá]lido\s+hasta|caducidad)\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4}|\d{4}[./\-]\d{1,2}[./\-]\d{1,2})/i;
```

### 2.2. Extractor y Validador de DNI Peruano (8 dígitos)
```typescript
const DNI_REGEX = /(?:dni|documento\s+de\s+identidad|identificaci[oó]n|n[°º.]?\s*doc)\s*[:\-]?\s*(\b\d{8}\b)/i;
```
- **Regla de consistencia de identidad**: Si el documento contiene un DNI explícito y este **no coincide** con `worker.dni`, el documento no puede ser pre-aprobado en `VERDE`; pasa inmediatamente a `AMBAR` con razón `"Discrepancia de DNI detectada en documento"` y se abre un ticket en `exception_reviews`.

---

## 3. Reglas de Clasificación de Documentos (Secciones 3.3 y 3.4 del Entregable 3)

Cada vez que se analiza un documento, se evalúa el árbol de decisión en el siguiente orden estricto:

| Prioridad | Condición | Estado del Documento | Ticket en Bandeja de Excepciones (`exception_reviews`) |
| :---: | :--- | :---: | :--- |
| **1** | Texto extraído vacío (`< 15 chars`) o `ocrConfidence < 65%` | 🟡 `AMBAR` | **SÍ** (`reasonTriggered = "Lectura OCR no satisfactoria / documento ilegible"`) |
| **2** | `detectedDni` presente y `detectedDni !== worker.dni` | 🟡 `AMBAR` | **SÍ** (`reasonTriggered = "Inconsistencia de identidad: DNI en documento no coincide con el trabajador"`) |
| **3** | `requirement.requiresValidity === true` y `detectedExpiryDate === null` | 🟡 `AMBAR` | **SÍ** (`reasonTriggered = "Lectura con incertidumbre: No se identificó fecha de vencimiento"`) |
| **4** | `requirement.requiresValidity === true` y `detectedExpiryDate < HOY (00:00:00)` | 🔴 `ROJO` | **NO** (Rechazo automático directo; la ECM debe subir un documento vigente) |
| **5** | Documento legible + DNI consistente + (`requiresValidity === false` o `detectedExpiryDate >= HOY`) | 🟢 `VERDE` | **NO** (**Pre-aprobación automática Zero-Touch**) |

---

## 4. Algoritmo del Semáforo Operativo Global (`trafficLight.service.ts`)

Cada vez que ocurre cualquiera de estos 4 eventos:
1. Registro del trabajador (cruce con Lista Negra),
2. Carga y análisis OCR de un documento,
3. Resolución manual de una excepción por SSOMA/Médico/DHO,
4. Envío del cuestionario E-Learning,

se ejecuta `recalculateWorkerTrafficLight(workerId)` dentro de una transacción Prisma:

```typescript
export function computeGlobalTrafficLight(params: {
  isBlacklisted: boolean;
  mandatoryDocs: { status: 'PENDIENTE' | 'VERDE' | 'AMBAR' | 'ROJO' }[];
  elearningPassed: boolean;
}): { trafficLight: 'VERDE' | 'AMBAR' | 'ROJO'; summary: string; shouldIssueQr: boolean } {
  if (params.isBlacklisted) {
    return {
      trafficLight: 'ROJO',
      summary: 'Restricción confirmada: Trabajador registrado en Lista Negra.',
      shouldIssueQr: false,
    };
  }

  const hasRedDoc = params.mandatoryDocs.some((d) => d.status === 'ROJO');
  if (hasRedDoc) {
    return {
      trafficLight: 'ROJO',
      summary: 'Requisito incumplido: Uno o más documentos obligatorios están vencidos o rechazados.',
      shouldIssueQr: false,
    };
  }

  const allDocsGreen =
    params.mandatoryDocs.length > 0 &&
    params.mandatoryDocs.every((d) => d.status === 'VERDE');

  if (allDocsGreen && params.elearningPassed) {
    return {
      trafficLight: 'VERDE',
      summary: 'Requisitos 100% cumplidos y E-Learning aprobado. Habilitado Zero-Touch.',
      shouldIssueQr: true,
    };
  }

  return {
    trafficLight: 'AMBAR',
    summary: 'En proceso: Existen documentos pendientes, en Bandeja de Excepciones o E-Learning por completar.',
    shouldIssueQr: false,
  };
}
```

### 4.1. Emisión Automática del Carné Digital QR (`shouldIssueQr === true`)
Cuando `shouldIssueQr` pasa a `true`:
1. Se calcula `validUntil` como la **fecha mínima de vencimiento** entre todos los documentos con vigencia del trabajador (ej. el menor entre `SCTR` y `EMO`).
2. Se genera o actualiza el registro en `digital_badges_qr` con firma HMAC-SHA256 y `pvcPrintStatus = "QUEUED_GARITA"`.
