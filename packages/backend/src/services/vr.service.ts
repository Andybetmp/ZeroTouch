import { prisma } from '../config/prisma.js';
import { recalculateWorkerTrafficLight } from './trafficLight.service.js';

export const VR_SOCAVON_SCENARIOS = [
  {
    code: 'SCALING_ROCK',
    title: '1. Desate de Rocas Sueltas en Galería Subterránea',
    description:
      'Inspección de techo y hastiales, uso de barretilla a 45°, ubicación bajo zona sostenida y retiro de planchones.',
    minScore: 80,
  },
  {
    code: 'GAS_VENTILATION',
    title: '2. Monitoreo de Gases y Ventilación en Socavón',
    description:
      'Medición con detector multigás (O2 >= 19.5%, CO < 25 ppm, NO2, H2S) y verificación de manga de ventilación a <= 15m del frente.',
    minScore: 80,
  },
  {
    code: 'HEAVY_MACHINERY',
    title: '3. Interacción Segura con Scooptram / Dumper en Galería',
    description:
      'Uso obligatorio de refugios peatonales cada 50m, comunicación con señales de lámpara minera y respeto de puntos ciegos.',
    minScore: 80,
  },
  {
    code: 'LOTO_LOCKOUT',
    title: '4. Bloqueo y Etiquetado de Energías Peligrosas (LOTO)',
    description:
      'Aplicación de las 5 Reglas de Oro: corte efectivo, bloqueo con candado y tarjeta personal, verificación de energía cero.',
    minScore: 80,
  },
];

/**
 * Genera un código de emparejamiento de 6 dígitos para vincular un visor RV físico (Quest/Pico/WebXR)
 * con el expediente del trabajador.
 */
export async function generateVrPairingCode(workerId: string) {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error('Trabajador no encontrado');

  const pairingCode = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.auditLog.create({
    data: {
      workerId: worker.id,
      actorArea: 'PASARELA_VR_SOCAVON',
      action: 'VR_PAIRING_CODE_ISSUED',
      details: `Código de emparejamiento visor RV emitido: ${pairingCode} (Vigencia 10 min).`,
    },
  });

  return {
    workerId: worker.id,
    dni: worker.dni,
    fullName: worker.fullName,
    pairingCode,
    expiresInMinutes: 10,
    scenarios: VR_SOCAVON_SCENARIOS,
  };
}

/**
 * Recibe la telemetría de un escenario de simulación RV (desde visor físico o simulador WebXR).
 * Regla crítica normativa: Si criticalErrors contiene cualquier falla grave de seguridad,
 * el escenario queda REPROBADO (passed = false) aunque el puntaje numérico sea >= 80.
 */
export async function completeVrSimulationSession(params: {
  workerId: string;
  pairingCode?: string;
  scenarioCode: 'SCALING_ROCK' | 'GAS_VENTILATION' | 'HEAVY_MACHINERY' | 'LOTO_LOCKOUT';
  score: number;
  durationSeconds: number;
  criticalErrors: string[];
}) {
  const worker = await prisma.worker.findUnique({ where: { id: params.workerId } });
  if (!worker) throw new Error('Trabajador no encontrado');

  const hasCriticalErrors = Array.isArray(params.criticalErrors) && params.criticalErrors.length > 0;
  const passed = !hasCriticalErrors && params.score >= 80;

  const session = await prisma.vrSimulationSession.create({
    data: {
      workerId: worker.id,
      pairingCode: params.pairingCode || 'WEBXR-SIM',
      scenarioCode: params.scenarioCode,
      score: Math.max(0, Math.min(100, Math.round(params.score))),
      criticalErrorsJson: JSON.stringify(params.criticalErrors || []),
      passed,
      durationSeconds: params.durationSeconds || 300,
      syncedToPractical: true,
      completedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: worker.id,
      actorArea: 'SIMULADOR_RV_SOCAVON',
      action: passed ? `VR_${params.scenarioCode}_APROBADO` : `VR_${params.scenarioCode}_REPROBADO`,
      details: `Escenario ${params.scenarioCode}: Puntaje ${params.score}/100. ${
        hasCriticalErrors
          ? `REPROBADO por Error Crítico: ${params.criticalErrors.join('; ')}`
          : '0 errores críticos. Sincronizado con expediente práctico Días 3-4.'
      }`,
    },
  });

  const updatedWorker = await recalculateWorkerTrafficLight(worker.id);

  return {
    session,
    passed,
    hasCriticalErrors,
    workerTrafficLight: updatedWorker?.trafficLight,
    workerStatusSummary: updatedWorker?.statusSummary,
  };
}
