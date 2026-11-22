import crypto from 'crypto';
import { DocumentStatus, TrafficLightStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface GlobalTrafficLightEvaluation {
  trafficLight: TrafficLightStatus;
  statusSummary: string;
  shouldIssueQr: boolean;
}

/**
 * Función pura determinista para calcular el Semáforo Operativo Global (Spec 03).
 */
export function computeGlobalTrafficLight(params: {
  isBlacklisted: boolean;
  mandatoryDocs: { status: DocumentStatus; requirementName: string }[];
  elearningPassed: boolean;
}): GlobalTrafficLightEvaluation {
  if (params.isBlacklisted) {
    return {
      trafficLight: 'ROJO',
      statusSummary: 'BLOQUEADO: Trabajador registra restricción activa en Lista Negra de Minera Bateas.',
      shouldIssueQr: false,
    };
  }

  const redDocs = params.mandatoryDocs.filter((d) => d.status === 'ROJO');
  if (redDocs.length > 0) {
    const names = redDocs.map((d) => d.requirementName).join(', ');
    return {
      trafficLight: 'ROJO',
      statusSummary: `REQUISITO INCUMPLIDO: Documentos vencidos o rechazados (${names}).`,
      shouldIssueQr: false,
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
        'HABILITADO ZERO-TOUCH: 100% documentos obligatorios vigentes y E-Learning aprobado. Carné QR emitido.',
      shouldIssueQr: true,
    };
  }

  const reasons: string[] = [];
  if (amberDocs.length > 0) {
    reasons.push(`${amberDocs.length} doc(s) en Bandeja de Excepciones`);
  }
  if (pendingDocs.length > 0) {
    reasons.push(`${pendingDocs.length} doc(s) pendientes de carga`);
  }
  if (!params.elearningPassed) {
    reasons.push('Inducción E-Learning pendiente');
  }

  return {
    trafficLight: 'AMBAR',
    statusSummary: `EN PROCESO / REVISIÓN: ${reasons.join(' · ')}.`,
    shouldIssueQr: false,
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
