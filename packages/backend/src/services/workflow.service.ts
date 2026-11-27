import crypto from 'crypto';
import { AccessZone, JobPosition, StayType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import {
  extractDocumentContent,
  extractStructuredMetadata,
  generateSyntheticPdfBuffer,
  parseFlexibleDate,
} from './ocr.service.js';
import { analyzeDocumentWithGeminiAi } from './ai.service.js';
import { evaluateDocumentRules } from './rules.service.js';
import { recalculateWorkerTrafficLight } from './trafficLight.service.js';
import { syncWorkerCoursesByArea } from './courseCms.service.js';

export interface RegisterWorkerInput {
  dni: string;
  fullName: string;
  companyName: string;
  contractorRuc?: string;
  jobPosition: JobPosition;
  stayType?: StayType;
  accessZone?: AccessZone;
}

/**
 * Registra un trabajador contratista, verifica automáticamente la Lista Negra,
 * asigna su matriz de documentos requeridos según App Bateas v2.1.0 y retorna el expediente.
 */
export async function registerWorkerWorkflow(input: RegisterWorkerInput) {
  const cleanDni = input.dni.trim();
  const stayType = input.stayType || 'PERMANENTE_CIA';
  const accessZone = input.accessZone || 'SUPERFICIE';
  const ruc =
    input.contractorRuc?.trim() ||
    `20${crypto.createHash('md5').update(input.companyName).digest('hex').replace(/\D/g, '').slice(0, 9).padEnd(9, '1')}`;

  // 1. Asegurar registro de la Empresa Contratista Minera (ECM)
  const contractor = await prisma.contractorEcm.upsert({
    where: { ruc },
    update: { companyName: input.companyName.trim() },
    create: {
      ruc,
      companyName: input.companyName.trim(),
    },
  });

  // 2. Cruce automático con Lista Negra (Blacklist)
  const blacklistRecord = await prisma.blacklistEntry.findUnique({
    where: { dni: cleanDni },
  });
  const isBlacklisted = Boolean(blacklistRecord && blacklistRecord.isActive);

  // 3. Obtener requisitos aplicables desde stay_type_requirements (App Bateas v2.1.0)
  let requirements = await prisma.stayTypeRequirement.findMany({
    where: {
      stayType,
      OR: [{ applicableJob: null }, { applicableJob: input.jobPosition }],
    },
    orderBy: [{ isMandatory: 'desc' }, { name: 'asc' }],
  });

  // Fallback: Si se eligió TEMPORAL o VISITA_TECNICA y aún no hay filas específicas para esa estadía,
  // usar los requisitos base de PERMANENTE_CIA (DNI, SCTR, EMO, CV, etc.) para que siempre permita cargar documentos.
  if (requirements.length === 0) {
    requirements = await prisma.stayTypeRequirement.findMany({
      where: {
        stayType: 'PERMANENTE_CIA',
        OR: [{ applicableJob: null }, { applicableJob: input.jobPosition }],
      },
      orderBy: [{ isMandatory: 'desc' }, { name: 'asc' }],
    });
  }

  const sessionCode = `BZT-${cleanDni.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;

  // 4. Crear o actualizar trabajador
  const existing = await prisma.worker.findUnique({ where: { dni: cleanDni } });
  if (existing) {
    await prisma.worker.delete({ where: { id: existing.id } });
  }

  const worker = await prisma.worker.create({
    data: {
      dni: cleanDni,
      fullName: input.fullName.trim().toUpperCase(),
      contractorId: contractor.id,
      jobPosition: input.jobPosition,
      stayType,
      accessZone,
      isBlacklisted,
      trafficLight: isBlacklisted ? 'ROJO' : 'AMBAR',
      statusSummary: isBlacklisted
        ? `BLOQUEADO EN LISTA NEGRA: ${blacklistRecord?.reason}`
        : 'Expediente creado. Pendiente de carga documental e inducción E-Learning.',
      sessionCode,
      documents: {
        create: requirements.map((req) => ({
          requirementId: req.id,
          status: 'PENDIENTE',
          statusReason: 'Pendiente de carga por la ECM',
        })),
      },
      auditLogs: {
        create: {
          actorArea: 'SISTEMA_ZERO_TOUCH',
          action: isBlacklisted ? 'BLOQUEO_LISTA_NEGRA' : 'REGISTRO_EXPEDIENTE',
          details: isBlacklisted
            ? `Trabajador bloqueado automáticamente por coincidencia en Lista Negra (${blacklistRecord?.reason}).`
            : `Expediente registrado con ${requirements.length} requisitos configurados para ${stayType} / ${input.jobPosition}.`,
        },
      },
    },
  });

  // 5. Asignación automática de cursos obligatorios según el Área de Ingreso seleccionada
  await syncWorkerCoursesByArea(worker.id);

  return recalculateWorkerTrafficLight(worker.id);
}

/**
 * Procesa un documento (archivo binario o texto directo) aplicando el motor OCR,
 * evalúa reglas de vigencia e identidad, abre ticket en Bandeja de Excepciones si es ÁMBAR
 * y recalcula el Semáforo Global sin reiniciar otros documentos en VERDE.
 */
export async function processWorkerDocumentWorkflow(params: {
  workerId: string;
  requirementId: string;
  fileName: string;
  mimeType?: string;
  fileBuffer?: Buffer;
  directSimulatedText?: string;
}) {
  const workerDoc = await prisma.workerDocument.findUnique({
    where: {
      workerId_requirementId: {
        workerId: params.workerId,
        requirementId: params.requirementId,
      },
    },
    include: {
      worker: true,
      requirement: true,
    },
  });

  if (!workerDoc) {
    throw new Error('El requisito especificado no pertenece al expediente del trabajador.');
  }

  // Validación del Primer Filtro de Postulación (Fase 1: DNI + CV Actualizado)
  if (!['DNI', 'CV_DOC'].includes(workerDoc.requirement.code)) {
    const phase1Docs = await prisma.workerDocument.findMany({
      where: {
        workerId: params.workerId,
        requirement: { code: { in: ['DNI', 'CV_DOC'] } },
      },
      include: { requirement: true },
    });
    const phase1Ready =
      phase1Docs.length > 0 && phase1Docs.every((d) => d.status === 'VERDE');
    if (!phase1Ready) {
      throw new Error(
        'Primer Filtro de Postulación pendiente: Primero debe cargar y aprobar el DNI y el CV Actualizado (Fase 1) antes de adjuntar EMO, SCTR u otros certificados.'
      );
    }
  }

  let extractedText = '';
  let extractionMethod: 'PDF_TEXT' | 'TESSERACT_OCR' | 'TEXT_DIRECT' = 'TEXT_DIRECT';
  let ocrConfidence = 99.0;
  let detectedDni: string | null = null;
  let detectedExpiryDate: Date | null = null;
  let fileHashSha256 = '';

  if (params.fileBuffer) {
    fileHashSha256 = crypto.createHash('sha256').update(params.fileBuffer).digest('hex');
    const ocrResult = await extractDocumentContent({
      fileName: params.fileName,
      mimeType: params.mimeType,
      buffer: params.fileBuffer,
    });
    extractedText = ocrResult.extractedText;
    extractionMethod = ocrResult.extractionMethod;
    ocrConfidence = ocrResult.ocrConfidence;
    detectedDni = ocrResult.detectedDni;
    detectedExpiryDate = ocrResult.detectedExpiryDate;
  } else if (params.directSimulatedText !== undefined) {
    extractedText = params.directSimulatedText;
    fileHashSha256 = crypto.createHash('sha256').update(extractedText).digest('hex');
    const meta = extractStructuredMetadata(extractedText);
    detectedDni = meta.detectedDni;
    detectedExpiryDate = meta.detectedExpiryDate;
    ocrConfidence = extractedText.trim().length >= 20 ? 98.0 : 30.0;
  }

  const ruleEval = evaluateDocumentRules({
    workerDni: workerDoc.worker.dni,
    workerJobPosition: workerDoc.worker.jobPosition,
    requirementCode: workerDoc.requirement.code,
    requiresValidity: workerDoc.requirement.requiresValidity,
    extractedText,
    ocrConfidence,
    detectedDni,
    detectedExpiryDate,
  });

  // Fallback Inteligente con Google Gemini IA cuando el regex/OCR tradicional no halló fecha o DNI
  if (
    process.env.GEMINI_API_KEY &&
    ((workerDoc.requirement.requiresValidity && !detectedExpiryDate) || !detectedDni)
  ) {
    try {
      const aiResult = await analyzeDocumentWithGeminiAi({
        requirementName: workerDoc.requirement.name,
        expectedWorkerDni: workerDoc.worker.dni,
        expectedWorkerName: workerDoc.worker.fullName,
        requiresValidity: workerDoc.requirement.requiresValidity,
        extractedText,
        fileBuffer: params.fileBuffer,
        mimeType: params.mimeType,
      });

      if (aiResult.detectedDni && !detectedDni) {
        detectedDni = aiResult.detectedDni;
      }
      if (aiResult.detectedExpiryDate && !detectedExpiryDate) {
        const parsedAiDate = parseFlexibleDate(aiResult.detectedExpiryDate);
        if (parsedAiDate) {
          detectedExpiryDate = parsedAiDate;
        }
      }

      const reEval = evaluateDocumentRules({
        workerDni: workerDoc.worker.dni,
        requiresValidity: workerDoc.requirement.requiresValidity,
        extractedText: extractedText.length >= 20 ? extractedText : aiResult.summaryReason,
        ocrConfidence: Math.max(ocrConfidence, aiResult.confidence),
        detectedDni,
        detectedExpiryDate,
      });

      ruleEval.status = reEval.status;
      ruleEval.statusReason = `[Gemini IA ${aiResult.modelUsed}] ${reEval.statusReason}`;
      ruleEval.shouldCreateException = reEval.shouldCreateException;
      ruleEval.exceptionReason = reEval.exceptionReason;
    } catch {
      // Si Gemini no pudo resolverlo o el documento sigue incompleto, conserva clasificación ÁMBAR original
    }
  }

  // Cerrar tickets de excepción abiertos previos sobre este mismo documento al subir nueva versión
  await prisma.exceptionReview.updateMany({
    where: {
      workerDocumentId: workerDoc.id,
      reviewStatus: 'OPEN',
    },
    data: {
      reviewStatus: 'REJECTED',
      reviewerName: 'SISTEMA',
      reviewerComment: 'Reemplazado por nueva carga documental de la ECM.',
      resolvedAt: new Date(),
    },
  });

  await prisma.workerDocument.update({
    where: { id: workerDoc.id },
    data: {
      fileName: params.fileName,
      fileMimeType: params.mimeType || 'application/pdf',
      fileHashSha256,
      fileData: params.fileBuffer ? new Uint8Array(params.fileBuffer) : null,
      extractedText,
      extractionMethod,
      ocrConfidence,
      detectedDni,
      detectedExpiryDate,
      status: ruleEval.status,
      statusReason: ruleEval.statusReason,
    },
  });

  if (ruleEval.shouldCreateException && ruleEval.exceptionReason) {
    await prisma.exceptionReview.create({
      data: {
        workerDocumentId: workerDoc.id,
        assignedArea: workerDoc.requirement.responsibleArea,
        reviewStatus: 'OPEN',
        reasonTriggered: ruleEval.exceptionReason,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      workerId: workerDoc.workerId,
      actorArea: 'MOTOR_OCR_ZERO_TOUCH',
      action: `OCR_${workerDoc.requirement.code}_${ruleEval.status}`,
      details: `${workerDoc.requirement.name}: ${ruleEval.statusReason}`,
    },
  });

  return recalculateWorkerTrafficLight(workerDoc.workerId);
}

/**
 * Resuelve un ticket de la Bandeja de Excepciones (SSOMA / Área Médica / DHO).
 */
export async function resolveExceptionTicketWorkflow(params: {
  exceptionId: string;
  decision: 'APPROVED' | 'REJECTED';
  reviewerName: string;
  reviewerComment: string;
  manualExpiryDateStr?: string;
}) {
  const ticket = await prisma.exceptionReview.findUnique({
    where: { id: params.exceptionId },
    include: {
      workerDocument: {
        include: { requirement: true },
      },
    },
  });

  if (!ticket) {
    throw new Error(`Ticket de excepción ${params.exceptionId} no encontrado.`);
  }

  const manualExpiry = params.manualExpiryDateStr
    ? parseFlexibleDate(params.manualExpiryDateStr)
    : ticket.workerDocument.detectedExpiryDate;

  const newDocStatus = params.decision === 'APPROVED' ? 'VERDE' : 'ROJO';
  const newStatusReason =
    params.decision === 'APPROVED'
      ? `Validado por Excepción (${ticket.assignedArea} - ${params.reviewerName}): ${params.reviewerComment}`
      : `Observado / Rechazado (${ticket.assignedArea} - ${params.reviewerName}): ${params.reviewerComment}`;

  await prisma.exceptionReview.update({
    where: { id: ticket.id },
    data: {
      reviewStatus: params.decision,
      reviewerName: params.reviewerName,
      reviewerComment: params.reviewerComment,
      manualExpiryDate: manualExpiry,
      resolvedAt: new Date(),
    },
  });

  await prisma.workerDocument.update({
    where: { id: ticket.workerDocumentId },
    data: {
      status: newDocStatus,
      statusReason: newStatusReason,
      detectedExpiryDate: manualExpiry || ticket.workerDocument.detectedExpiryDate,
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: ticket.workerDocument.workerId,
      actorArea: ticket.assignedArea,
      action: `EXCEPCION_${params.decision}`,
      details: `${ticket.workerDocument.requirement.name} -> ${newStatusReason}`,
    },
  });

  return recalculateWorkerTrafficLight(ticket.workerDocument.workerId);
}

/**
 * Registra y califica la evaluación teórica asíncrona del módulo E-Learning.
 */
export async function submitElearningAttemptWorkflow(params: {
  workerId: string;
  scoreObtained: number;
  totalQuestions?: number;
}) {
  const total = params.totalQuestions || 4;
  const passed = params.scoreObtained >= Math.ceil(total * 0.75); // >= 3 de 4 (75%)
  const certCode = passed ? `CERT-BZT-${Date.now().toString().slice(-6)}` : null;

  await prisma.elearningAttempt.create({
    data: {
      workerId: params.workerId,
      materialReviewed: true,
      scoreObtained: params.scoreObtained,
      totalQuestions: total,
      passed,
      certificateCode: certCode,
    },
  });

  if (passed) {
    await prisma.worker.update({
      where: { id: params.workerId },
      data: { elearningPassed: true },
    });
  }

  await prisma.auditLog.create({
    data: {
      workerId: params.workerId,
      actorArea: 'MODULO_ELEARNING',
      action: passed ? 'ELEARNING_APROBADO' : 'ELEARNING_INTENTO_NO_SUPERADO',
      details: `Resultado evaluación asíncrona: ${params.scoreObtained}/${total} respuestas correctas.`,
    },
  });

  return recalculateWorkerTrafficLight(params.workerId);
}

/**
 * Crea uno de los 4 escenarios demostrativos completos con archivos PDF generados y leídos por OCR real.
 */
export async function createDemoScenarioWorkflow(
  scenario: 'ZERO_TOUCH_GREEN' | 'EXCEPTION_AMBER' | 'EXPIRED_RED' | 'BLACKLISTED_RED'
) {
  const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const futureStr = `${String(futureDate.getUTCDate()).padStart(2, '0')}/${String(
    futureDate.getUTCMonth() + 1
  ).padStart(2, '0')}/${futureDate.getUTCFullYear()}`;

  const pastDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const pastStr = `${String(pastDate.getUTCDate()).padStart(2, '0')}/${String(
    pastDate.getUTCMonth() + 1
  ).padStart(2, '0')}/${pastDate.getUTCFullYear()}`;

  if (scenario === 'BLACKLISTED_RED') {
    await prisma.blacklistEntry.upsert({
      where: { dni: '49998887' },
      update: { isActive: true },
      create: {
        dni: '49998887',
        fullName: 'MARCOS VARGAS QUISPE',
        reason: 'Infracción grave de reglamento interno de seguridad en unidad minera (Reporte DHO-2025).',
        isActive: true,
      },
    });

    return registerWorkerWorkflow({
      dni: '49998887',
      fullName: 'MARCOS VARGAS QUISPE',
      companyName: 'CONSTRUCCIONES MINERAS SUR S.A.C.',
      jobPosition: 'OPERARIO',
      stayType: 'PERMANENTE_CIA',
      accessZone: 'SOCAVON',
    });
  }

  const profileMap = {
    ZERO_TOUCH_GREEN: {
      dni: '72458910',
      fullName: 'CARLOS ANTONIO RAMIREZ RAMIREZ',
      companyName: 'INGENIERIA Y SERVICIOS MINEROS S.A.C.',
      jobPosition: 'INGENIERO' as JobPosition,
      accessZone: 'SOCAVON' as AccessZone,
    },
    EXCEPTION_AMBER: {
      dni: '45812034',
      fullName: 'JORGE LUIS HUAMAN CONDORI',
      companyName: 'TRANSPORTES PESADOS ANDINOS S.A.C.',
      jobPosition: 'CONDUCTOR' as JobPosition,
      accessZone: 'SUPERFICIE' as AccessZone,
    },
    EXPIRED_RED: {
      dni: '41209876',
      fullName: 'PEDRO PABLO MENDOZA SALAZAR',
      companyName: 'CONTRATISTAS GENERALES CAYLLOMA S.A.C.',
      jobPosition: 'OPERARIO' as JobPosition,
      accessZone: 'SOCAVON' as AccessZone,
    },
  };

  const cfg = profileMap[scenario];
  const worker = await registerWorkerWorkflow({
    dni: cfg.dni,
    fullName: cfg.fullName,
    companyName: cfg.companyName,
    jobPosition: cfg.jobPosition,
    stayType: 'PERMANENTE_CIA',
    accessZone: cfg.accessZone,
  });

  if (!worker) throw new Error('Error al crear trabajador de demostración');

  // Ordenar para que en los escenarios Demo siempre se procesen primero DNI y CV_DOC (Fase 1) y así desbloqueen Fase 2
  const sortedDocs = [...worker.documents].sort((a, b) => {
    const aP1 = ['DNI', 'CV_DOC'].includes(a.requirement.code) ? 0 : 1;
    const bP1 = ['DNI', 'CV_DOC'].includes(b.requirement.code) ? 0 : 1;
    return aP1 - bP1;
  });

  for (const doc of sortedDocs) {
    if (!doc.requirement.isMandatory) continue;

    let expiryToUse: string | null = doc.requirement.requiresValidity ? futureStr : null;
    let corrupt = false;

    if (scenario === 'EXCEPTION_AMBER' && doc.requirement.code === 'EMO_16') {
      // Simular un EMO donde el escaneo omitió la fecha de vencimiento -> pasa a Bandeja de Excepciones
      expiryToUse = null;
    } else if (scenario === 'EXPIRED_RED' && doc.requirement.code === 'SCTR') {
      // Simular un SCTR vencido -> pasa a ROJO directo
      expiryToUse = pastStr;
    }

    const pdfBuffer = await generateSyntheticPdfBuffer({
      documentTitle: doc.requirement.name,
      workerName: worker.fullName,
      workerDni: worker.dni,
      companyName: cfg.companyName,
      expiryDateStr: expiryToUse,
      corruptOrIllegible: corrupt,
    });

    await processWorkerDocumentWorkflow({
      workerId: worker.id,
      requirementId: doc.requirementId,
      fileName: `${doc.requirement.code}_${worker.dni}.pdf`,
      mimeType: 'application/pdf',
      fileBuffer: pdfBuffer,
    });
  }

  // En ZERO_TOUCH_GREEN y EXCEPTION_AMBER también dejamos el E-Learning aprobado
  if (scenario === 'ZERO_TOUCH_GREEN' || scenario === 'EXCEPTION_AMBER') {
    await submitElearningAttemptWorkflow({
      workerId: worker.id,
      scoreObtained: 4,
      totalQuestions: 4,
    });
  }

  // 5. Asignación automática de cursos obligatorios según el Área de Ingreso seleccionada
  await syncWorkerCoursesByArea(worker.id);

  return recalculateWorkerTrafficLight(worker.id);
}
