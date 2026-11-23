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

  const evaluation = computeGlobalTrafficLight({
    isBlacklisted: worker.isBlacklisted,
    mandatoryDocs,
    elearningPassed: worker.elearningPassed,
  });

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
      verificationStatus: 'DENIED_NO_BADGE',
      reason: workerOnly
        ? `ACCESO DENEGADO EN GARITA: El trabajador ${workerOnly.fullName} (DNI ${workerOnly.dni}) tiene Semáforo en ${workerOnly.trafficLight} (${workerOnly.statusSummary}) y no posee Carné QR habilitado.`
        : `ACCESO DENEGADO EN GARITA: No existe credencial QR ni trabajador afiliado con el código/DNI "${clean}".`,
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

  return {
    accessGranted,
    verificationStatus: accessGranted ? 'ACCESS_GRANTED_GARITA' : 'ACCESS_REVOKED_OR_INVALID',
    reason: accessGranted
      ? `ACCESO AUTORIZADO EN GARITA: Firma HMAC-SHA256 válida, Semáforo VERDE y documentos vigentes hasta ${
          badge.validUntil.toISOString().split('T')[0]
        }. Fotocheck PVC: ${badge.pvcPrintStatus}.`
      : `ACCESO BLOQUEADO EN GARITA: ${
          !signatureValid
            ? 'Firma criptográfica QR inválida.'
            : isExpired
            ? 'Credencial vencida.'
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
