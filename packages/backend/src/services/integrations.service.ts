import { ExternalProviderType } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { recalculateWorkerTrafficLight } from './trafficLight.service.js';

export interface ClinicEmoSyncInput {
  dni: string;
  clinicName?: string;
  status: 'APTO' | 'APTO_CON_RESTRICCIONES' | 'NO_APTO';
  restrictions?: string | null;
  expiresAtStr: string; // YYYY-MM-DD
}

export interface InsurerPolicySyncInput {
  dni: string;
  providerType: 'SCTR_SALUD' | 'SCTR_PENSION' | 'VIDA_LEY';
  insurerName?: string;
  policyNumber?: string;
  status: 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA';
  expiresAtStr: string; // YYYY-MM-DD
}

/**
 * Inicializa las 4 integraciones externas en modo Sandbox (EMO + SCTR Salud + SCTR Pensión + Vida Ley)
 * para un trabajador si aún no existen registros.
 */
export async function ensureWorkerExternalIntegrations(workerId: string) {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error('Trabajador no encontrado');

  const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

  const defaults: {
    providerType: ExternalProviderType;
    providerName: string;
    status: string;
    restrictions: string | null;
    policyNumber: string;
  }[] = [
    {
      providerType: 'CLINIC_EMO',
      providerName: 'Clínica Ocupacional Pulso Salud Arequipa (API v2)',
      status: 'APTO',
      restrictions: 'Ninguna restricción para trabajos en altura ni socavón.',
      policyNumber: `EMO-ANX16-${worker.dni}`,
    },
    {
      providerType: 'SCTR_SALUD',
      providerName: 'Rímac Seguros SCTR Salud',
      status: 'ACTIVA',
      restrictions: null,
      policyNumber: `POL-SALUD-${worker.dni.slice(-4)}-2026`,
    },
    {
      providerType: 'SCTR_PENSION',
      providerName: 'Pacífico Seguros SCTR Pensión',
      status: 'ACTIVA',
      restrictions: null,
      policyNumber: `POL-PENS-${worker.dni.slice(-4)}-2026`,
    },
    {
      providerType: 'VIDA_LEY',
      providerName: 'La Positiva Vida Ley D.L. 688',
      status: 'ACTIVA',
      restrictions: null,
      policyNumber: `POL-VIDALEY-${worker.dni.slice(-4)}-2026`,
    },
  ];

  for (const item of defaults) {
    await prisma.externalIntegrationRecord.upsert({
      where: {
        workerId_providerType: {
          workerId: worker.id,
          providerType: item.providerType,
        },
      },
      update: {},
      create: {
        workerId: worker.id,
        providerType: item.providerType,
        providerName: item.providerName,
        status: item.status,
        restrictions: item.restrictions,
        policyNumber: item.policyNumber,
        expiresAt: futureDate,
        rawPayloadJson: JSON.stringify({
          mode: process.env.INTEGRATION_MODE || 'SANDBOX',
          dni: worker.dni,
          ...item,
        }),
      },
    });
  }

  return prisma.externalIntegrationRecord.findMany({
    where: { workerId: worker.id },
    orderBy: { providerType: 'asc' },
  });
}

/**
 * Webhook / Sincronización en tiempo real con Clínica Ocupacional (EMO Anexo 16).
 * Si el estado es NO_APTO o la fecha está vencida, dispara revocación automática del Semáforo y Carné QR.
 */
export async function syncClinicEmoRecord(input: ClinicEmoSyncInput) {
  const worker = await prisma.worker.findUnique({ where: { dni: input.dni.trim() } });
  if (!worker) throw new Error(`No existe trabajador afiliado con DNI ${input.dni}`);

  await ensureWorkerExternalIntegrations(worker.id);
  const expiresAt = new Date(input.expiresAtStr);

  const rec = await prisma.externalIntegrationRecord.upsert({
    where: {
      workerId_providerType: {
        workerId: worker.id,
        providerType: 'CLINIC_EMO',
      },
    },
    update: {
      providerName: input.clinicName || 'Clínica Ocupacional Pulso Salud (Webhook)',
      status: input.status,
      restrictions: input.restrictions ?? null,
      expiresAt,
      lastSyncedAt: new Date(),
      rawPayloadJson: JSON.stringify(input),
    },
    create: {
      workerId: worker.id,
      providerType: 'CLINIC_EMO',
      providerName: input.clinicName || 'Clínica Ocupacional Pulso Salud (Webhook)',
      status: input.status,
      restrictions: input.restrictions ?? null,
      policyNumber: `EMO-${worker.dni}`,
      expiresAt,
      rawPayloadJson: JSON.stringify(input),
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: worker.id,
      actorArea: 'WEBHOOK_CLINICA_EMO',
      action: `SYNC_EMO_${input.status}`,
      details: `Clínica reportó aptitud médica '${input.status}' (Vigencia: ${input.expiresAtStr}). ${
        input.restrictions ? `Restricciones: ${input.restrictions}` : ''
      }`,
    },
  });

  const updatedWorker = await recalculateWorkerTrafficLight(worker.id);
  return { record: rec, worker: updatedWorker };
}

/**
 * Webhook / Sincronización en tiempo real con Aseguradoras (SCTR Salud, SCTR Pensión y Vida Ley).
 */
export async function syncInsurerPolicyRecord(input: InsurerPolicySyncInput) {
  const worker = await prisma.worker.findUnique({ where: { dni: input.dni.trim() } });
  if (!worker) throw new Error(`No existe trabajador afiliado con DNI ${input.dni}`);

  await ensureWorkerExternalIntegrations(worker.id);
  const expiresAt = new Date(input.expiresAtStr);

  const rec = await prisma.externalIntegrationRecord.upsert({
    where: {
      workerId_providerType: {
        workerId: worker.id,
        providerType: input.providerType,
      },
    },
    update: {
      providerName: input.insurerName || `Aseguradora ${input.providerType} (Webhook)`,
      status: input.status,
      policyNumber: input.policyNumber || `POL-${input.providerType}-${worker.dni.slice(-4)}`,
      expiresAt,
      lastSyncedAt: new Date(),
      rawPayloadJson: JSON.stringify(input),
    },
    create: {
      workerId: worker.id,
      providerType: input.providerType,
      providerName: input.insurerName || `Aseguradora ${input.providerType} (Webhook)`,
      status: input.status,
      policyNumber: input.policyNumber || `POL-${input.providerType}-${worker.dni.slice(-4)}`,
      expiresAt,
      rawPayloadJson: JSON.stringify(input),
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: worker.id,
      actorArea: 'WEBHOOK_ASEGURADORA',
      action: `SYNC_${input.providerType}_${input.status}`,
      details: `Póliza ${input.providerType} actualizada a '${input.status}' (Vence: ${input.expiresAtStr}).`,
    },
  });

  const updatedWorker = await recalculateWorkerTrafficLight(worker.id);
  return { record: rec, worker: updatedWorker };
}

/**
 * Evalúa si las 4 integraciones externas de un trabajador están conformes y vigentes al día de hoy.
 */
export function evaluateExternalIntegrationsHealth(
  records: { providerType: ExternalProviderType; status: string; expiresAt: Date }[]
): { allHealthy: boolean; blockingReasons: string[] } {
  if (!records || records.length === 0) {
    return { allHealthy: true, blockingReasons: [] };
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const blockingReasons: string[] = [];

  for (const r of records) {
    const isExpired = r.expiresAt.getTime() < todayStart.getTime();
    if (r.providerType === 'CLINIC_EMO') {
      if (r.status === 'NO_APTO') {
        blockingReasons.push('Clínica EMO reporta estado NO_APTO');
      } else if (isExpired) {
        blockingReasons.push(`Certificado Médico EMO vencido (${r.expiresAt.toISOString().split('T')[0]})`);
      }
    } else {
      if (r.status !== 'ACTIVA') {
        blockingReasons.push(`Póliza ${r.providerType} en estado ${r.status}`);
      } else if (isExpired) {
        blockingReasons.push(`Póliza ${r.providerType} vencida (${r.expiresAt.toISOString().split('T')[0]})`);
      }
    }
  }

  return {
    allHealthy: blockingReasons.length === 0,
    blockingReasons,
  };
}
