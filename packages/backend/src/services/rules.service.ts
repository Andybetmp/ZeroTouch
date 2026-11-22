import { DocumentStatus } from '@prisma/client';

export interface DocumentRuleEvaluationInput {
  workerDni: string;
  requiresValidity: boolean;
  extractedText: string;
  ocrConfidence: number;
  detectedDni: string | null;
  detectedExpiryDate: Date | null;
  referenceToday?: Date;
}

export interface DocumentRuleEvaluationOutput {
  status: DocumentStatus;
  statusReason: string;
  shouldCreateException: boolean;
  exceptionReason: string | null;
}

/**
 * Evalúa las reglas de negocio de pre-validación documental (Spec 03).
 * Implementa el principio Zero-Touch con Gestión por Excepciones:
 * - VERDE: Pre-aprobado automáticamente sin intervención humana.
 * - AMBAR: Derivado a Bandeja de Excepciones (SSOMA / Médico / DHO).
 * - ROJO: Rechazado automáticamente por documento vencido.
 */
export function evaluateDocumentRules(
  input: DocumentRuleEvaluationInput
): DocumentRuleEvaluationOutput {
  const cleanText = (input.extractedText || '').trim();

  // Prioridad 1: Lectura OCR no satisfactoria o documento ilegible
  if (cleanText.length < 20 || input.ocrConfidence < 65) {
    const reason =
      'Lectura OCR no satisfactoria: texto ilegible o baja calidad de escaneo. Derivado a Bandeja de Excepciones.';
    return {
      status: 'AMBAR',
      statusReason: reason,
      shouldCreateException: true,
      exceptionReason: reason,
    };
  }

  // Prioridad 2: Consistencia de identidad (DNI detectado vs DNI del trabajador)
  if (input.detectedDni && input.detectedDni !== input.workerDni) {
    const reason = `Inconsistencia de identidad: el DNI en el documento (${input.detectedDni}) no coincide con el DNI del trabajador (${input.workerDni}).`;
    return {
      status: 'AMBAR',
      statusReason: reason,
      shouldCreateException: true,
      exceptionReason: reason,
    };
  }

  // Prioridad 3 y 4: Reglas de vigencia según bandera de App Bateas (¿Requiere vigencia?)
  if (input.requiresValidity) {
    if (!input.detectedExpiryDate) {
      const reason =
        'Lectura con incertidumbre: el requisito exige vigencia pero no se identificó una fecha de vencimiento clara.';
      return {
        status: 'AMBAR',
        statusReason: reason,
        shouldCreateException: true,
        exceptionReason: reason,
      };
    }

    const now = input.referenceToday ? new Date(input.referenceToday) : new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    if (input.detectedExpiryDate.getTime() < todayStart.getTime()) {
      const formatted = input.detectedExpiryDate.toISOString().split('T')[0];
      return {
        status: 'ROJO',
        statusReason: `Requisito incumplido: Documento vencido el ${formatted}. La ECM debe cargar un documento vigente.`,
        shouldCreateException: false,
        exceptionReason: null,
      };
    }

    const formatted = input.detectedExpiryDate.toISOString().split('T')[0];
    return {
      status: 'VERDE',
      statusReason: `Pre-aprobado Zero-Touch: Documento legible, DNI consistente y vigente hasta ${formatted}.`,
      shouldCreateException: false,
      exceptionReason: null,
    };
  }

  // Prioridad 5: Documento no requiere vigencia y es legible + consistente
  return {
    status: 'VERDE',
    statusReason: 'Pre-aprobado Zero-Touch: Documento legible y datos consistentes (no requiere fecha de vigencia).',
    shouldCreateException: false,
    exceptionReason: null,
  };
}
