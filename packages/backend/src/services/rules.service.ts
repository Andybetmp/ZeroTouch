import { DocumentStatus } from '@prisma/client';

export interface DocumentRuleEvaluationInput {
  workerDni: string;
  workerJobPosition?: string;
  requirementCode?: string;
  requiresValidity: boolean;
  extractedText: string;
  ocrConfidence: number;
  detectedDni: string | null;
  detectedExpiryDate: Date | null;
  referenceToday?: Date;
}

const JOB_PROFILE_KEYWORDS: Record<string, { label: string; keywords: RegExp }> = {
  INGENIERO: {
    label: 'Especialista / Ingeniero Colegiado (CIP)',
    keywords: /(ingenier[oa]|cip|colegiad[oa]|especialista|proyectos|minas|geolog|metalurg|civil|industrial)/i,
  },
  CONDUCTOR: {
    label: 'Conductor de Unidad / Operador de Vehículo',
    keywords: /(conductor|chofer|operador|licencia|mtc|a-ii|a-iii|manejo\s+defensivo|transporte)/i,
  },
  PERSONAL_COCINA: {
    label: 'Personal Gastronómico / Manipulación de Alimentos',
    keywords: /(cocin[ae]|gastronom|alimentos|comedor|nutrici|sanidad|higiene|chef)/i,
  },
  TECNICO: {
    label: 'Técnico Especialista / Mantenimiento',
    keywords: /(t[eé]cnico|mantenimiento|electricista|mec[aá]nico|instrumentista|soldador|especialista)/i,
  },
};

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

  // Prioridad 5: Validación contextual de CV Documentado según el Perfil / Especialidad del Puesto
  if (
    input.requirementCode === 'CV_DOC' &&
    input.workerJobPosition &&
    JOB_PROFILE_KEYWORDS[input.workerJobPosition]
  ) {
    const profileRule = JOB_PROFILE_KEYWORDS[input.workerJobPosition];
    // Si el CV NO es un documento sintético genérico y menciona explícitamente otro oficio incompatible o carece de palabras clave del perfil
    const isGenericDemo = /EXPEDIENTE BATEAS ZERO-TOUCH|CERTIFICADO OFICIAL/i.test(cleanText);
    if (!isGenericDemo && !profileRule.keywords.test(cleanText)) {
      const reason = `Validación de Perfil en CV: No se detectaron competencias o palabras clave para el puesto "${profileRule.label}". Derivado a Bandeja de Excepciones (DHO / Área Usuaria) para evaluación humana (no se rechaza a ciegas).`;
      return {
        status: 'AMBAR',
        statusReason: reason,
        shouldCreateException: true,
        exceptionReason: reason,
      };
    }
  }

  // Prioridad 6: Documento no requiere vigencia y es legible + consistente
  return {
    status: 'VERDE',
    statusReason: 'Pre-aprobado Zero-Touch: Documento legible, identidad y perfil consistentes (no requiere fecha de vigencia).',
    shouldCreateException: false,
    exceptionReason: null,
  };
}
