import { prisma } from '../config/prisma.js';
import { parseFlexibleDate } from './ocr.service.js';

export interface AiOcrAnalysisResult {
  modelUsed: string;
  detectedDni: string | null;
  detectedName: string | null;
  detectedExpiryDate: string | null;
  isDocumentValid: boolean;
  summaryReason: string;
  confidence: number;
}

const GEMINI_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
];

/**
 * Llama a la API de Google Gemini con rotación automática de modelos ante picos 503.
 */
async function callGeminiWithFallback(params: {
  parts: any[];
  responseJsonSchema?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada en el entorno (.env).');
  }

  let lastError = 'Sin respuesta de Gemini';

  for (const model of GEMINI_FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const bodyPayload: any = {
        contents: [{ parts: params.parts }],
        generationConfig: {
          temperature: 0.1,
          ...(params.responseJsonSchema ? { responseMimeType: 'application/json' } : {}),
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!res.ok) {
        const errTxt = await res.text();
        lastError = `[${model} HTTP ${res.status}] ${errTxt.slice(0, 180)}`;
        continue;
      }

      const data: any = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) {
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(`No se pudo completar la consulta a Gemini: ${lastError}`);
}

/**
 * Analiza un documento (PDF/Imagen en buffer o texto extraído) usando Gemini Multimodal
 * para extraer DNI, Nombre del trabajador, Fecha de Vencimiento y dictamen contextual.
 */
export async function analyzeDocumentWithGeminiAi(params: {
  requirementName: string;
  expectedWorkerDni: string;
  expectedWorkerName: string;
  requiresValidity: boolean;
  extractedText?: string | null;
  fileBuffer?: Buffer | null;
  mimeType?: string | null;
}): Promise<AiOcrAnalysisResult> {
  const todayStr = new Date().toISOString().split('T')[0];

  const prompt = `Eres el Motor Auditor IA de Bateas Zero-Touch para Minera Bateas S.A.C.
Analiza el siguiente documento correspondiente al requisito "${params.requirementName}".
Datos esperados del trabajador afiliado:
- DNI esperado: "${params.expectedWorkerDni}"
- Nombre esperado: "${params.expectedWorkerName}"
- ¿Este requisito exige fecha de vigencia?: ${params.requiresValidity ? 'SÍ' : 'NO'}
- Fecha actual de referencia: ${todayStr}

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura exacta:
{
  "detectedDni": "string con el DNI de 8 dígitos encontrado o null",
  "detectedName": "string con el nombre del titular encontrado o null",
  "detectedExpiryDate": "string en formato DD/MM/YYYY con la fecha de vencimiento/vigencia encontrada o null",
  "isDocumentValid": boolean (true si es legible, el DNI coincide y no está vencido),
  "summaryReason": "explicación técnica breve en español del dictamen de auditoría",
  "confidence": number (0 a 100)
}`;

  const parts: any[] = [{ text: prompt }];

  if (params.extractedText && params.extractedText.trim().length > 0) {
    parts.push({
      text: `\nTEXTO EXTRAÍDO DEL DOCUMENTO:\n"""\n${params.extractedText}\n"""`,
    });
  }

  if (
    params.fileBuffer &&
    params.mimeType &&
    (params.mimeType.startsWith('image/') || params.mimeType === 'application/pdf')
  ) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.fileBuffer.toString('base64'),
      },
    });
  }

  const { text, modelUsed } = await callGeminiWithFallback({
    parts,
    responseJsonSchema: true,
  });

  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    modelUsed,
    detectedDni: parsed.detectedDni || null,
    detectedName: parsed.detectedName || null,
    detectedExpiryDate: parsed.detectedExpiryDate || null,
    isDocumentValid: Boolean(parsed.isDocumentValid),
    summaryReason: parsed.summaryReason || 'Analizado por Gemini IA',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 95,
  };
}

/**
 * Copiloto IA de Auditoría para SSOMA / Área Médica / DHO con acceso en tiempo real
 * al estado de los expedientes, Semáforo Operativo y Bandeja de Excepciones en Supabase.
 */
export async function askBateasAiCopilot(question: string): Promise<{
  answer: string;
  modelUsed: string;
}> {
  const [workers, openExceptions, blacklist] = await Promise.all([
    prisma.worker.findMany({
      include: {
        contractor: true,
        documents: { include: { requirement: true } },
        digitalBadge: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exceptionReview.findMany({
      where: { reviewStatus: 'OPEN' },
      include: {
        workerDocument: {
          include: { worker: true, requirement: true },
        },
      },
    }),
    prisma.blacklistEntry.findMany({ where: { isActive: true } }),
  ]);

  const contextSnapshot = {
    resumenOperativo: {
      totalTrabajadores: workers.length,
      semaforoVerde: workers.filter((w) => w.trafficLight === 'VERDE').length,
      semaforoAmbar: workers.filter((w) => w.trafficLight === 'AMBAR').length,
      semaforoRojo: workers.filter((w) => w.trafficLight === 'ROJO').length,
      excepcionesAbiertas: openExceptions.length,
    },
    trabajadores: workers.map((w) => ({
      dni: w.dni,
      nombre: w.fullName,
      empresa: w.contractor.companyName,
      puesto: w.jobPosition,
      semaforo: w.trafficLight,
      diagnostico: w.statusSummary,
      elearningAprobado: w.elearningPassed,
      carnetQr: w.digitalBadge?.badgeCode || null,
      documentosObservadosOPendientes: w.documents
        .filter((d) => d.status !== 'VERDE' && d.requirement.isMandatory)
        .map((d) => ({
          requisito: d.requirement.name,
          estado: d.status,
          motivo: d.statusReason,
        })),
    })),
    bandejaExcepciones: openExceptions.map((ex) => ({
      ticketId: ex.id,
      areaResponsable: ex.assignedArea,
      trabajadorDni: ex.workerDocument.worker.dni,
      trabajadorNombre: ex.workerDocument.worker.fullName,
      documento: ex.workerDocument.requirement.name,
      motivo: ex.reasonTriggered,
    })),
    listaNegraActiva: blacklist.map((b) => ({
      dni: b.dni,
      nombre: b.fullName,
      motivo: b.reason,
    })),
  };

  const systemPrompt = `Eres el Copiloto IA Oficial de "Bateas Zero-Touch" (Equipo MYOPIA) para Minera Bateas S.A.C.
Tu misión es asistir a los administradores de Empresas Contratistas (ECM) y a los especialistas de SSOMA, Área Médica y DHO.
Responde de manera concisa, ejecutiva y estructurada en español basándote en los datos en tiempo real de Supabase PostgreSQL:

DATOS EN TIEMPO REAL DEL SISTEMA:
${JSON.stringify(contextSnapshot, null, 2)}

PREGUNTA DEL USUARIO:
${question}`;

  const { text, modelUsed } = await callGeminiWithFallback({
    parts: [{ text: systemPrompt }],
    responseJsonSchema: false,
  });

  return {
    answer: text,
    modelUsed,
  };
}
