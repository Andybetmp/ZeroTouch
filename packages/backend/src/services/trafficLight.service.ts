import crypto from 'crypto';
import { DocumentStatus, TrafficLightStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface GlobalTrafficLightEvaluation {
  trafficLight: TrafficLightStatus;
  statusSummary: string;
  shouldIssueQr: boolean;
  phase1Passed: boolean;
}

export const PHASE1_FILTER_CODES = new Set(['DNI', 'CV_DOC']);

/**
 * Función pura determinista para calcular el Semáforo Operativo Global en 2 Fases (Filtro 1: Postulación DNI + CV -> Fase 2: Habilitación SCTR/EMO/E-Learning).
 */
export function computeGlobalTrafficLight(params: {
  isBlacklisted: boolean;
  mandatoryDocs: { code?: string; status: DocumentStatus; requirementName: string }[];
  elearningPassed: boolean;
}): GlobalTrafficLightEvaluation {
  if (params.isBlacklisted) {
    return {
      trafficLight: 'ROJO',
      statusSummary: 'BLOQUEADO (Filtro 0): Trabajador registra restricción activa en Lista Negra de Minera Bateas.',
      shouldIssueQr: false,
      phase1Passed: false,
    };
  }

  // Evaluar Fase 1 (Primer Filtro de Postulación: DNI + CV Documentado)
  const phase1Docs = params.mandatoryDocs.filter((d) =>
    d.code ? PHASE1_FILTER_CODES.has(d.code) : /DNI|CV/i.test(d.requirementName)
  );
  const phase1Passed =
    phase1Docs.length === 0 || phase1Docs.every((d) => d.status === 'VERDE');

  const redDocs = params.mandatoryDocs.filter((d) => d.status === 'ROJO');
  if (redDocs.length > 0) {
    const names = redDocs.map((d) => d.requirementName).join(', ');
    return {
      trafficLight: 'ROJO',
      statusSummary: `REQUISITO INCUMPLIDO: Documentos vencidos o rechazados (${names}).`,
      shouldIssueQr: false,
      phase1Passed,
    };
  }

  if (!phase1Passed) {
    const phase1Amber = phase1Docs.filter((d) => d.status === 'AMBAR');
    if (phase1Amber.length > 0) {
      return {
        trafficLight: 'AMBAR',
        statusSummary:
          'FASE 1 (FILTRO DE POSTULACIÓN EN REVISIÓN): DNI o CV Documentado derivado a Bandeja de Excepciones para validar perfil/especialidad antes de solicitar EMO/SCTR.',
        shouldIssueQr: false,
        phase1Passed: false,
      };
    }
    return {
      trafficLight: 'AMBAR',
      statusSummary:
        'FASE 1 (PRIMER FILTRO DE POSTULACIÓN): Solicitud inicial activa. Adjunte solo DNI y CV Actualizado para evaluar perfil antes de desbloquear EMO, SCTR y demás documentos.',
      shouldIssueQr: false,
      phase1Passed: false,
    };
  }

  const amberDocs = params.mandatoryDocs.filter((d) => d.status === 'AMBAR');
  const pendingDocs = params.mandatoryDocs.filter((d) => d.status === 'PENDIENTE');
  const allDocsGreen =
    params.mandatoryDocs.length > 0 &&
    params.mandatoryDocs.every((d) => d.status === 'VERDE');

  if (allDocsGreen && params.elearningPassed) {
    return {
      trafficLight: 'VERDE',
      statusSummary:
        'HABILITADO ZERO-TOUCH (Fase 1 y 2 Completas): Perfil aprobado, 100% documentos vigentes y E-Learning superado. Carné QR emitido.',
      shouldIssueQr: true,
      phase1Passed: true,
    };
  }

  const reasons: string[] = ['Fase 1 (DNI + CV) Aprobada ✅'];
  if (amberDocs.length > 0) {
    reasons.push(`${amberDocs.length} doc(s) de Fase 2 en Bandeja de Excepciones`);
  }
  if (pendingDocs.length > 0) {
    reasons.push(`${pendingDocs.length} doc(s) de Fase 2 desbloqueados pendientes de carga`);
  }
  if (!params.elearningPassed) {
    reasons.push('Inducción E-Learning pendiente');
  }

  return {
    trafficLight: 'AMBAR',
    statusSummary: `FASE 2 DESBLOQUEADA: ${reasons.join(' · ')}.`,
    shouldIssueQr: false,
    phase1Passed: true,
  };
}

/**
 * Recalcula el Semáforo Global de un trabajador en PostgreSQL y emite automáticamente
 * el Carné Digital QR + Orden de Fotocheck PVC cuando pasa a VERDE.
 */
export async function recalculateWorkerTrafficLight(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      contractor: true,
      documents: {
        include: { requirement: true },
      },
      digitalBadge: true,
      integrationRecords: true,
      trainingProgress: {
        include: { module: true },
      },
      courseAssignments: {
        include: { course: true },
      },
      vrSessions: true,
    },
  });

  if (!worker) {
    throw new Error(`Trabajador con ID ${workerId} no encontrado.`);
  }

  const mandatoryDocs = worker.documents
    .filter((doc) => doc.requirement.isMandatory)
    .map((doc) => ({
      code: doc.requirement.code,
      status: doc.status,
      requirementName: doc.requirement.name,
      detectedExpiryDate: doc.detectedExpiryDate,
    }));

  // 1. Verificar estado de la Capacitación Híbrida de 4 días (32 horas) si tiene módulos asignados
  let training32hReady = worker.elearningPassed;
  let trainingPendingMessage = '';

  const applicableProgress = worker.trainingProgress.filter(
    (p) => p.module.isActive && (!p.module.jobSpecialty || p.module.jobSpecialty === worker.jobPosition)
  );

  if (applicableProgress.length > 0) {
    const d1Ok = applicableProgress
      .filter((p) => p.module.dayNumber === 1)
      .every((p) => p.completedSeconds >= p.requiredSeconds && p.status === 'COMPLETED');
    const d2Ok = applicableProgress
      .filter((p) => p.module.dayNumber === 2)
      .every((p) => p.completedSeconds >= p.requiredSeconds && (p.examScore ?? 0) >= 75 && p.status === 'COMPLETED');
    const d34Ok = applicableProgress
      .filter((p) => p.module.dayNumber === 3 || p.module.dayNumber === 4)
      .every((p) => p.completedSeconds >= p.requiredSeconds && (p.practicalScore ?? 0) >= 14 && p.status === 'COMPLETED');

    const reqVr = ['SCALING_ROCK', 'GAS_VENTILATION', 'HEAVY_MACHINERY', 'LOTO_LOCKOUT'];
    const passedVr = new Set(worker.vrSessions.filter((s) => s.passed).map((s) => s.scenarioCode));
    const vrOk = worker.vrSessions.length === 0 ? worker.elearningPassed : reqVr.every((c) => passedVr.has(c));

    training32hReady = (d1Ok && d2Ok && d34Ok && vrOk) || (worker.elearningPassed && applicableProgress.every((p) => p.status === 'COMPLETED'));

    if (!training32hReady) {
      const missingSteps: string[] = [];
      if (!d1Ok) missingSteps.push('Día 1 (8h)');
      else if (!d2Ok) missingSteps.push('Día 2 (8h + Examen)');
      else if (!d34Ok) missingSteps.push('Días 3-4 (16h Presencial)');
      if (!vrOk && worker.vrSessions.length > 0) missingSteps.push('Simulación RV Socavón');
      if (missingSteps.length > 0) {
        trainingPendingMessage = `Capacitación 32h pendiente (${missingSteps.join(', ')})`;
      }
    }
  }

  // 1b. Verificar asignaciones CMS de Capacitación 4 Días (si el trabajador tiene asignaciones explícitas)
  if (worker.courseAssignments && worker.courseAssignments.length > 0) {
    const activeAssignments = worker.courseAssignments.filter((a) => a.course.isActive);
    const pendingCourses = activeAssignments.filter((a) => a.status !== 'COMPLETED');
    if (pendingCourses.length > 0) {
      training32hReady = false;
      const pendingDays = Array.from(new Set(pendingCourses.map((a) => `Día ${a.course.dayNumber}`))).sort();
      trainingPendingMessage = `Capacitación 4 días pendiente (${pendingDays.join(', ')})`;
    }
  }

  let evaluation = computeGlobalTrafficLight({
    isBlacklisted: worker.isBlacklisted,
    mandatoryDocs,
    elearningPassed: training32hReady,
  });

  if (trainingPendingMessage && evaluation.trafficLight === 'AMBAR') {
    evaluation = {
      ...evaluation,
      statusSummary: `${evaluation.statusSummary} · ${trainingPendingMessage}`,
    };
  }

  // 2. Verificar Integraciones API Externas en Tiempo Real (Clínicas EMO y Pólizas SCTR Salud/Pensión/Vida Ley)
  if (worker.integrationRecords && worker.integrationRecords.length > 0) {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const integrationBlocks: string[] = [];

    for (const rec of worker.integrationRecords) {
      const exp = rec.expiresAt.getTime() < todayStart.getTime();
      if (rec.providerType === 'CLINIC_EMO') {
        if (rec.status === 'NO_APTO') {
          integrationBlocks.push('Clínica EMO reporta NO_APTO');
        } else if (exp) {
          integrationBlocks.push(`EMO vencido (${rec.expiresAt.toISOString().split('T')[0]})`);
        }
      } else {
        if (rec.status !== 'ACTIVA') {
          integrationBlocks.push(`Póliza ${rec.providerType} en estado ${rec.status}`);
        } else if (exp) {
          integrationBlocks.push(`Póliza ${rec.providerType} vencida (${rec.expiresAt.toISOString().split('T')[0]})`);
        }
      }
    }

    if (integrationBlocks.length > 0) {
      evaluation = {
        trafficLight: 'ROJO',
        statusSummary: `REVOCACIÓN AUTOMÁTICA API EN TIEMPO REAL: ${integrationBlocks.join(' · ')}. Carné QR inhabilitado en Garita.`,
        shouldIssueQr: false,
        phase1Passed: evaluation.phase1Passed,
      };
    }
  }

  await prisma.worker.update({
    where: { id: worker.id },
    data: {
      trafficLight: evaluation.trafficLight,
      statusSummary: evaluation.statusSummary,
    },
  });

  if (evaluation.shouldIssueQr) {
    // Calcular vigencia mínima entre los documentos con fecha de vencimiento
    const expiryDates = mandatoryDocs
      .map((d) => d.detectedExpiryDate)
      .filter((d): d is Date => d !== null);

    const minExpiry =
      expiryDates.length > 0
        ? new Date(Math.min(...expiryDates.map((d) => d.getTime())))
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    const badgeCode = worker.digitalBadge?.badgeCode || `BZT-${worker.dni}-${Date.now().toString().slice(-4)}`;
    const payloadObj = {
      badgeCode,
      dni: worker.dni,
      fullName: worker.fullName,
      companyName: worker.contractor.companyName,
      jobPosition: worker.jobPosition,
      stayType: worker.stayType,
      accessZone: worker.accessZone,
      trafficLight: 'VERDE',
      validUntil: minExpiry.toISOString().split('T')[0],
    };
    const qrPayloadJson = JSON.stringify(payloadObj);
    const secret = process.env.QR_SIGNING_SECRET || 'bateas-zerotouch-myopia-2026';
    const signatureHash = crypto.createHmac('sha256', secret).update(qrPayloadJson).digest('hex');

    await prisma.digitalBadgeQr.upsert({
      where: { workerId: worker.id },
      update: {
        qrPayloadJson,
        signatureHash,
        validUntil: minExpiry,
      },
      create: {
        workerId: worker.id,
        badgeCode,
        qrPayloadJson,
        signatureHash,
        pvcPrintStatus: 'QUEUED_GARITA',
        validUntil: minExpiry,
      },
    });
  }

  return prisma.worker.findUnique({
    where: { id: worker.id },
    include: {
      contractor: true,
      documents: {
        include: {
          requirement: true,
          exceptionReviews: { orderBy: { createdAt: 'desc' } },
        },
      },
      elearningAttempts: { orderBy: { attemptedAt: 'desc' } },
      digitalBadge: true,
      integrationRecords: { orderBy: { providerType: 'asc' } },
      trainingProgress: { include: { module: true } },
      vrSessions: { orderBy: { createdAt: 'desc' } },
      biometricLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      auditLogs: { orderBy: { createdAt: 'desc' } },
    },
  });
}

/**
 * Permite a SSOMA emitir o revocar manualmente la habilitación y el Pase QR desde la Torre de Control.
 */
export async function manualOverrideWorkerTrafficLight(params: {
  workerId: string;
  action: 'GRANT_GREEN' | 'REVOKE_RED';
  reviewerName: string;
  reason: string;
}) {
  const worker = await prisma.worker.findUnique({
    where: { id: params.workerId },
    include: { contractor: true, digitalBadge: true },
  });
  if (!worker) throw new Error('Trabajador no encontrado');

  if (params.action === 'REVOKE_RED') {
    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        trafficLight: 'ROJO',
        statusSummary: `REVOCADO POR TORRE DE CONTROL SSOMA (${params.reviewerName}): ${params.reason}`,
      },
    });
  } else {
    const minExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
    const badgeCode = worker.digitalBadge?.badgeCode || `BZT-${worker.dni}-${Date.now().toString().slice(-4)}`;
    const payloadObj = {
      badgeCode,
      dni: worker.dni,
      fullName: worker.fullName,
      companyName: worker.contractor.companyName,
      jobPosition: worker.jobPosition,
      stayType: worker.stayType,
      accessZone: worker.accessZone,
      trafficLight: 'VERDE',
      validUntil: minExpiry.toISOString().split('T')[0],
    };
    const qrPayloadJson = JSON.stringify(payloadObj);
    const secret = process.env.QR_SIGNING_SECRET || 'bateas-zerotouch-myopia-2026';
    const signatureHash = crypto.createHmac('sha256', secret).update(qrPayloadJson).digest('hex');

    await prisma.digitalBadgeQr.upsert({
      where: { workerId: worker.id },
      update: { qrPayloadJson, signatureHash, validUntil: minExpiry },
      create: {
        workerId: worker.id,
        badgeCode,
        qrPayloadJson,
        signatureHash,
        pvcPrintStatus: 'QUEUED_GARITA',
        validUntil: minExpiry,
      },
    });

    await prisma.worker.update({
      where: { id: worker.id },
      data: {
        trafficLight: 'VERDE',
        elearningPassed: true,
        statusSummary: `HABILITADO POR TORRE DE CONTROL SSOMA (${params.reviewerName}): ${params.reason}`,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      workerId: worker.id,
      actorArea: 'TORRE_CONTROL_SSOMA',
      action: params.action === 'GRANT_GREEN' ? 'EMISION_MANUAL_PASE_QR' : 'REVOCACION_MANUAL_PASE_QR',
      details: `${params.reviewerName}: ${params.reason}`,
    },
  });

  return prisma.worker.findUnique({
    where: { id: worker.id },
    include: {
      contractor: true,
      documents: { include: { requirement: true } },
      digitalBadge: true,
      integrationRecords: true,
      trainingProgress: { include: { module: true } },
      vrSessions: true,
      auditLogs: { orderBy: { createdAt: 'desc' } },
    },
  });
}

/**
 * Verifica criptográficamente un Carné Digital QR o DNI en Garita (Spec 04 y Spec 05).
 * Comprueba:
 * 1. Existencia del trabajador y su credencial QR.
 * 2. Firma HMAC-SHA256 del payload QR (integridad anti-falsificación).
 * 3. Que el Semáforo Global esté actualmente en VERDE y no esté en Lista Negra.
 * 4. Que ningún documento obligatorio haya vencido al día de hoy y alerta si vence en <= 20 días.
 */
export async function verifyGaritaBadgeOrDni(badgeCodeOrDni: string) {
  const clean = badgeCodeOrDni.trim();
  const badge = await prisma.digitalBadgeQr.findFirst({
    where: {
      OR: [{ badgeCode: clean }, { worker: { dni: clean } }],
    },
    include: {
      worker: {
        include: {
          contractor: true,
          documents: { include: { requirement: true } },
        },
      },
    },
  });

  if (!badge) {
    const workerOnly = await prisma.worker.findUnique({
      where: { dni: clean },
      include: { contractor: true },
    });

    return {
      accessGranted: false,
      verificationStatus: workerOnly ? 'DENIED_NO_BADGE' : 'DENIED_NOT_REGISTERED',
      reason: workerOnly
        ? `ACCESO DENEGADO EN GARITA: El trabajador ${workerOnly.fullName} (DNI ${workerOnly.dni}) presenta estado ${workerOnly.trafficLight} (${workerOnly.statusSummary}).`
        : `No existe trabajador afiliado con el DNI ${clean}.`,
      signatureValid: false,
      worker: workerOnly || null,
      badge: null,
      expiringSoonDocs: [],
    };
  }

  const secret = process.env.QR_SIGNING_SECRET || 'bateas-zerotouch-myopia-2026';
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(badge.qrPayloadJson)
    .digest('hex');
  const signatureValid = expectedSig === badge.signatureHash;

  const now = new Date();
  const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

  const expiringSoonDocs = badge.worker.documents
    .filter(
      (d) =>
        d.detectedExpiryDate &&
        d.detectedExpiryDate.getTime() >= now.getTime() &&
        d.detectedExpiryDate.getTime() <= in20Days.getTime()
    )
    .map((d) => ({
      name: d.requirement.name,
      expiryDate: d.detectedExpiryDate?.toISOString().split('T')[0],
    }));

  const isExpired = badge.validUntil.getTime() < now.getTime();
  const isGreen = badge.worker.trafficLight === 'VERDE' && !badge.worker.isBlacklisted;
  const accessGranted = signatureValid && isGreen && !isExpired;

  const pvcLabelMap: Record<string, string> = {
    QUEUED_GARITA: 'En cola de impresión',
    PRINTED: 'Impreso',
    DELIVERED: 'Entregado',
  };
  const pvcLabel = pvcLabelMap[badge.pvcPrintStatus] || badge.pvcPrintStatus;

  return {
    accessGranted,
    verificationStatus: accessGranted ? 'ACCESS_GRANTED_GARITA' : 'ACCESS_REVOKED_OR_INVALID',
    reason: accessGranted
      ? `ACCESO AUTORIZADO EN GARITA: Semáforo VERDE y documentos vigentes hasta ${
          badge.validUntil.toISOString().split('T')[0]
        }. Fotocheck PVC: ${pvcLabel}.`
      : `ACCESO BLOQUEADO EN GARITA: ${
          !signatureValid
            ? 'Validación de seguridad inválida.'
            : isExpired
            ? 'Habilitación vencida.'
            : `Semáforo actual en ${badge.worker.trafficLight}.`
        }`,
    signatureValid,
    pvcPrintStatus: badge.pvcPrintStatus,
    validUntil: badge.validUntil.toISOString().split('T')[0],
    expiringSoonDocs,
    worker: {
      id: badge.worker.id,
      dni: badge.worker.dni,
      fullName: badge.worker.fullName,
      companyName: badge.worker.contractor.companyName,
      jobPosition: badge.worker.jobPosition,
      stayType: badge.worker.stayType,
      accessZone: badge.worker.accessZone,
      trafficLight: badge.worker.trafficLight,
    },
    badge: {
      id: badge.id,
      badgeCode: badge.badgeCode,
      signatureHash: badge.signatureHash,
      pvcPrintStatus: badge.pvcPrintStatus,
    },
  };
}
