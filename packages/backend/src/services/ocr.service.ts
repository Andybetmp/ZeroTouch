import zlib from 'node:zlib';
import { createWorker } from 'tesseract.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface OcrExtractionResult {
  extractedText: string;
  extractionMethod: 'PDF_TEXT' | 'TESSERACT_OCR' | 'TEXT_DIRECT';
  ocrConfidence: number;
  detectedDni: string | null;
  detectedExpiryDate: Date | null;
}

const EXPIRY_REGEX =
  /(?:fecha\s+(?:de\s+)?vencimiento|vencimiento|vigencia\s+hasta|v[aá]lido\s+hasta|caducidad)\s*[:\-]?\s*(\d{1,2}[./\-]\d{1,2}[./\-]\d{4}|\d{4}[./\-]\d{1,2}[./\-]\d{1,2})/i;

const DNI_REGEX =
  /(?:dni|documento\s+de\s+identidad|identificaci[oó]n|n[°º.]?\s*doc)\s*[:\-]?\s*(\b\d{8}\b)/i;

/**
 * Parsea una cadena de fecha DD/MM/YYYY o YYYY-MM-DD en un objeto Date válido.
 */
export function parseFlexibleDate(raw: string): Date | null {
  const normalized = raw.trim().replace(/[.\-]/g, '/');
  const parts = normalized.split('/');
  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  } else {
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
  }

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function extractStructuredMetadata(text: string): {
  detectedDni: string | null;
  detectedExpiryDate: Date | null;
} {
  const dniMatch = text.match(DNI_REGEX) || text.match(/\b(\d{8})\b/);
  const detectedDni = dniMatch ? dniMatch[1] : null;

  const expiryMatch = text.match(EXPIRY_REGEX);
  const detectedExpiryDate = expiryMatch ? parseFlexibleDate(expiryMatch[1]) : null;

  return { detectedDni, detectedExpiryDate };
}

function parsePdfOperatorsToText(contentStream: string): string[] {
  const lines: string[] = [];

  for (const m of contentStream.matchAll(/\(([^()]*)\)\s*Tj/g)) {
    if (m[1].trim()) lines.push(m[1].trim());
  }

  for (const m of contentStream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
    try {
      const decoded = Buffer.from(m[1], 'hex').toString('latin1');
      if (decoded.trim()) lines.push(decoded.trim());
    } catch {
      // ignore
    }
  }

  return lines;
}

/**
 * Extrae texto de streams PDF tanto sin comprimir como comprimidos con FlateDecode (zlib).
 */
function extractRawPdfStreamsText(buffer: Buffer): string {
  const rawLatin = buffer.toString('latin1');
  const lines: string[] = [...parsePdfOperatorsToText(rawLatin)];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of rawLatin.matchAll(streamRegex)) {
    const streamBytes = Buffer.from(match[1], 'latin1');
    try {
      const inflated = zlib.inflateSync(streamBytes).toString('latin1');
      lines.push(...parsePdfOperatorsToText(inflated));
    } catch {
      // Stream no era FlateDecode o estaba sin comprimir
    }
  }

  return lines.join('\n').trim();
}

/**
 * Extrae texto de un PDF usando pdf-parse y decodificador nativo de streams FlateDecode,
 * o aplica Tesseract.js para imágenes escaneadas.
 */
export async function extractDocumentContent(params: {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<OcrExtractionResult> {
  const lowerName = params.fileName.toLowerCase();
  const isPdf = lowerName.endsWith('.pdf') || params.mimeType === 'application/pdf';

  if (isPdf) {
    let text = extractRawPdfStreamsText(params.buffer);

    if (text.length < 15) {
      try {
        // @ts-expect-error pdf-parse internal CJS module has no bundled types
        const pdfParseModule: any = await import('pdf-parse/lib/pdf-parse.js');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const parsed = await pdfParse(params.buffer, { max: 3 });
        const parsedText = (parsed?.text || '').trim();
        if (parsedText.length > text.length) {
          text = parsedText;
        }
      } catch {
        // Fallback ya cubierto por extractRawPdfStreamsText
      }
    }

    const { detectedDni, detectedExpiryDate } = extractStructuredMetadata(text);
    return {
      extractedText: text,
      extractionMethod: 'PDF_TEXT',
      ocrConfidence: text.length >= 20 ? 99.0 : 40.0,
      detectedDni,
      detectedExpiryDate,
    };
  }

  // Imagen (PNG / JPG / JPEG) -> Tesseract.js OCR
  const worker = await createWorker('spa');
  try {
    const ret = await worker.recognize(params.buffer);
    const text = (ret.data.text || '').trim();
    const confidence = typeof ret.data.confidence === 'number' ? ret.data.confidence : 75.0;
    const { detectedDni, detectedExpiryDate } = extractStructuredMetadata(text);
    return {
      extractedText: text,
      extractionMethod: 'TESSERACT_OCR',
      ocrConfidence: confidence,
      detectedDni,
      detectedExpiryDate,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Genera un documento PDF real en memoria para pruebas automatizadas y escenarios Demo.
 */
export async function generateSyntheticPdfBuffer(params: {
  documentTitle: string;
  workerName: string;
  workerDni: string;
  companyName: string;
  expiryDateStr?: string | null;
  corruptOrIllegible?: boolean;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 420]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (params.corruptOrIllegible) {
    page.drawText('??? ### ---', { x: 50, y: 350, size: 10, font });
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  const lines = [
    'MINERA BATEAS S.A.C. - EXPEDIENTE BATEAS ZERO-TOUCH',
    'DOCUMENTO DE PRUEBA GENERADO PARA VALIDACION OCR',
    `Requisito: ${params.documentTitle}`,
    `Trabajador: ${params.workerName}`,
    `DNI: ${params.workerDni}`,
    `Empresa Contratista (ECM): ${params.companyName}`,
  ];

  if (params.expiryDateStr) {
    lines.push(`Fecha de vencimiento: ${params.expiryDateStr}`);
  }

  lines.forEach((line, idx) => {
    page.drawText(line, {
      x: 50,
      y: 350 - idx * 28,
      size: idx === 0 ? 13 : 11,
      font: idx < 2 ? boldFont : font,
      color: rgb(0.1, 0.1, 0.15),
    });
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}
