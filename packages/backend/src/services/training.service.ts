import { JobPosition, TrainingModality } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { recalculateWorkerTrafficLight } from './trafficLight.service.js';

/**
 * Inicializa o sincroniza los registros de progreso de capacitación de 4 días (32 horas)
 * para un trabajador según su especialidad (D.S. 024-2016-EM / D.S. 023-2017-EM).
 */
export async function ensureWorkerTrainingPlan(workerId: string) {
  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error('Trabajador no encontrado');

  const modules = await prisma.trainingModule.findMany({
    where: {
      isActive: true,
      OR: [{ jobSpecialty: null }, { jobSpecialty: worker.jobPosition }],
    },
    orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }],
  });

  for (const mod of modules) {
    const reqSecs = mod.requiredHours * 3600;
    await prisma.workerTrainingProgress.upsert({
      where: {
        workerId_moduleId: {
          workerId: worker.id,
          moduleId: mod.id,
        },
      },
      update: {
        requiredSeconds: reqSecs,
      },
      create: {
        workerId: worker.id,
        moduleId: mod.id,
        completedSeconds: 0,
        requiredSeconds: reqSecs,
        status: 'PENDING',
      },
    });
  }

  return getWorkerTrainingRoadmap(worker.id);
}

/**
 * Obtiene la ruta completa de capacitación de 4 días (32 horas) con banderas de bloqueo secuencial:
 * - Día 1 (8h E-Learning General): Siempre desbloqueado.
 * - Día 2 (8h E-Learning Específico + Examen >= 75%): Bloqueado hasta completar 100% del Día 1.
 * - Días 3 y 4 (16h Presencial + Práctica >= 14/20 + RV): Bloqueados hasta aprobar Día 1 y Día 2.
 */
export async function getWorkerTrainingRoadmap(workerId: string) {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      contractor: true,
      trainingProgress: {
        include: {
          module: {
            include: {
              questions: { where: { isActive: true } },
            },
          },
        },
        orderBy: [{ module: { dayNumber: 'asc' } }, { module: { orderIndex: 'asc' } }],
      },
      vrSessions: { orderBy: { createdAt: 'desc' } },
      biometricLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });

  if (!worker) throw new Error('Trabajador no encontrado');

  // Filtrar progreso aplicable a la especialidad del trabajador
  const applicableProgress = worker.trainingProgress.filter(
    (p) => p.module.isActive && (!p.module.jobSpecialty || p.module.jobSpecialty === worker.jobPosition)
  );

  const day1Items = applicableProgress.filter((p) => p.module.dayNumber === 1);
  const day2Items = applicableProgress.filter((p) => p.module.dayNumber === 2);
  const day34Items = applicableProgress.filter((p) => p.module.dayNumber === 3 || p.module.dayNumber === 4);

  const day1Completed =
    day1Items.length > 0 &&
    day1Items.every((p) => p.completedSeconds >= p.requiredSeconds && p.status === 'COMPLETED');

  const day2Completed =
    day1Completed &&
    day2Items.length > 0 &&
    day2Items.every(
      (p) =>
        p.completedSeconds >= p.requiredSeconds &&
        (p.examScore ?? 0) >= 75 &&
        p.status === 'COMPLETED'
    );

  const day34Completed =
    day2Completed &&
    day34Items.length > 0 &&
    day34Items.every(
      (p) =>
        p.completedSeconds >= p.requiredSeconds &&
        (p.practicalScore ?? 0) >= 14 &&
        p.status === 'COMPLETED'
    );

  const requiredVrScenarios = ['SCALING_ROCK', 'GAS_VENTILATION', 'HEAVY_MACHINERY', 'LOTO_LOCKOUT'];
  const passedVrCodes = new Set(
    worker.vrSessions.filter((s) => s.passed).map((s) => s.scenarioCode)
  );
  const vrAllPassed = requiredVrScenarios.every((code) => passedVrCodes.has(code));

  const totalRequiredSeconds = applicableProgress.reduce((acc, p) => acc + p.requiredSeconds, 0) || 32 * 3600;
  const totalCompletedSeconds = applicableProgress.reduce(
    (acc, p) => acc + Math.min(p.completedSeconds, p.requiredSeconds),
    0
  );

  return {
    workerId: worker.id,
    dni: worker.dni,
    fullName: worker.fullName,
    jobPosition: worker.jobPosition,
    companyName: worker.contractor.companyName,
    trafficLight: worker.trafficLight,
    statusSummary: worker.statusSummary,
    totalRequiredHours: Math.round(totalRequiredSeconds / 3600),
    totalCompletedHours: Number((totalCompletedSeconds / 3600).toFixed(1)),
    overallPercent: Math.min(100, Math.round((totalCompletedSeconds / totalRequiredSeconds) * 100)),
    gates: {
      day1Completed,
      day2Unlocked: day1Completed,
      day2Completed,
      day34Unlocked: day1Completed && day2Completed,
      day34Completed,
      vrAllPassed,
      allTraining32hCompleted: day1Completed && day2Completed && day34Completed && vrAllPassed,
    },
    modules: applicableProgress.map((p) => {
      const day = p.module.dayNumber;
      const isUnlocked =
        day === 1 ? true : day === 2 ? day1Completed : day1Completed && day2Completed;

      return {
        progressId: p.id,
        moduleId: p.moduleId,
        code: p.module.code,
        title: p.module.title,
        description: p.module.description,
        videoUrl: p.module.videoUrl,
        dayNumber: day,
        modality: p.module.modality,
        requiredHours: p.module.requiredHours,
        jobSpecialty: p.module.jobSpecialty,
        completedSeconds: p.completedSeconds,
        requiredSeconds: p.requiredSeconds,
        completedHours: Number((p.completedSeconds / 3600).toFixed(2)),
        percent: Math.min(100, Math.round((p.completedSeconds / Math.max(1, p.requiredSeconds)) * 100)),
        status: p.status,
        isUnlocked,
        examScore: p.examScore,
        scheduledDate: p.scheduledDate,
        scheduledShift: p.scheduledShift,
        attendanceVerifiedBy: p.attendanceVerifiedBy,
        practicalScore: p.practicalScore,
        observations: p.observations,
        completedAt: p.completedAt,
        questions: p.module.questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: JSON.parse(q.optionsJson),
          correctIndex: q.correctIndex,
        })),
      };
    }),
    vrSummary: {
      requiredScenarios: requiredVrScenarios,
      passedScenarios: Array.from(passedVrCodes),
      vrAllPassed,
      sessions: worker.vrSessions,
    },
    recentBiometricLogs: worker.biometricLogs,
  };
}

/**
 * Incrementa el contador de horas/segundos de visualización de video de capacitación (Días 1 y 2),
 * validando estrictamente el bloqueo secuencial.
 */
export async function recordModuleWatchProgress(params: {
  workerId: string;
  moduleId: string;
  addedSeconds: number;
}) {
  await ensureWorkerTrainingPlan(params.workerId);
  const roadmap = await getWorkerTrainingRoadmap(params.workerId);
  const targetMod = roadmap.modules.find((m) => m.moduleId === params.moduleId);

  if (!targetMod) {
    throw new Error('Módulo de capacitación no asignado a la especialidad del trabajador.');
  }

  if (!targetMod.isUnlocked) {
    throw new Error(
      `Bloqueo Secuencial (D.S. 024-2016-EM): No puede avanzar el Día ${targetMod.dayNumber} sin haber completado al 100% el Día ${targetMod.dayNumber - 1}.`
    );
  }

  const newSeconds = Math.min(
    targetMod.requiredSeconds,
    targetMod.completedSeconds + Math.max(0, Math.round(params.addedSeconds))
  );

  // En Día 1 basta con completar el 100% de las 8 horas; en Día 2 además debe aprobar el examen teórico >= 75%
  const reachedTime = newSeconds >= targetMod.requiredSeconds;
  const hasQuestions = targetMod.questions.length > 0;
  const examPassed = !hasQuestions || (targetMod.examScore ?? 0) >= 75;

  const newStatus = reachedTime && examPassed ? 'COMPLETED' : 'IN_PROGRESS';

  await prisma.workerTrainingProgress.update({
    where: {
      workerId_moduleId: {
        workerId: params.workerId,
        moduleId: params.moduleId,
      },
    },
    data: {
      completedSeconds: newSeconds,
      status: newStatus,
      completedAt: newStatus === 'COMPLETED' ? new Date() : null,
    },
  });

  await recalculateWorkerTrafficLight(params.workerId);
  return getWorkerTrainingRoadmap(params.workerId);
}

/**
 * Evalúa el examen teórico del módulo (Día 1 o Día 2). Nota mínima aprobatoria >= 75%.
 */
export async function submitModuleExam(params: {
  workerId: string;
  moduleId: string;
  answers: number[];
}) {
  await ensureWorkerTrainingPlan(params.workerId);
  const roadmap = await getWorkerTrainingRoadmap(params.workerId);
  const targetMod = roadmap.modules.find((m) => m.moduleId === params.moduleId);

  if (!targetMod) throw new Error('Módulo no encontrado');
  if (!targetMod.isUnlocked) {
    throw new Error(`El Día ${targetMod.dayNumber} está bloqueado hasta completar el día previo.`);
  }
  if (targetMod.completedSeconds < targetMod.requiredSeconds) {
    throw new Error(
      `Debe completar el 100% de las horas de video (${targetMod.requiredHours}h) antes de rendir la evaluación teórica.`
    );
  }

  const questions = targetMod.questions;
  let correct = 0;
  questions.forEach((q, idx) => {
    if (params.answers[idx] === q.correctIndex) correct += 1;
  });

  const scorePercent = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 100;
  const passed = scorePercent >= 75;

  await prisma.workerTrainingProgress.update({
    where: {
      workerId_moduleId: {
        workerId: params.workerId,
        moduleId: params.moduleId,
      },
    },
    data: {
      examScore: scorePercent,
      status: passed ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: passed ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: params.workerId,
      actorArea: 'MOTOR_CAPACITACION_32H',
      action: passed ? `DIA_${targetMod.dayNumber}_APROBADO` : `DIA_${targetMod.dayNumber}_EXAMEN_OBSERVADO`,
      details: `${targetMod.title}: Nota teórica ${scorePercent}% (${correct}/${questions.length}).`,
    },
  });

  await recalculateWorkerTrafficLight(params.workerId);
  return getWorkerTrainingRoadmap(params.workerId);
}

/**
 * Permite a SSOMA programar y calificar la capacitación práctica presencial de campo (Días 3 y 4 — 16 horas).
 */
export async function recordPresentialTrainingBySsoma(params: {
  workerId: string;
  moduleId: string;
  scheduledDate?: string;
  scheduledShift?: string;
  attendanceCompleted: boolean;
  practicalScore: number; // 0-20 (mínimo aprobatorio 14)
  attendanceVerifiedBy: string;
  observations?: string;
}) {
  await ensureWorkerTrainingPlan(params.workerId);
  const roadmap = await getWorkerTrainingRoadmap(params.workerId);

  if (!roadmap.gates.day34Unlocked) {
    throw new Error(
      'Bloqueo Secuencial: No se puede validar asistencia presencial de Días 3 y 4 mientras el trabajador no haya aprobado Día 1 (8h) y Día 2 (8h + Examen).'
    );
  }

  const targetMod = roadmap.modules.find((m) => m.moduleId === params.moduleId);
  if (!targetMod) throw new Error('Módulo presencial no encontrado');

  const completedSecs = params.attendanceCompleted ? targetMod.requiredSeconds : 0;
  const passed = params.attendanceCompleted && params.practicalScore >= 14;

  await prisma.workerTrainingProgress.update({
    where: {
      workerId_moduleId: {
        workerId: params.workerId,
        moduleId: params.moduleId,
      },
    },
    data: {
      scheduledDate: params.scheduledDate || 'Programado en Campo',
      scheduledShift: params.scheduledShift || 'Turno Día (07:00 - 15:00)',
      completedSeconds: completedSecs,
      practicalScore: params.practicalScore,
      attendanceVerifiedBy: params.attendanceVerifiedBy,
      observations: params.observations || 'Evaluación práctica en unidad minera.',
      status: passed ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: passed ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      workerId: params.workerId,
      actorArea: 'SSOMA_CAMPO',
      action: passed ? `PRESENCIAL_DIA_${targetMod.dayNumber}_APROBADO` : `PRESENCIAL_DIA_${targetMod.dayNumber}_OBSERVADO`,
      details: `${targetMod.title}: Asistencia ${params.attendanceCompleted ? '8/8h' : 'Incompleta'}, Nota práctica ${params.practicalScore}/20 por ${params.attendanceVerifiedBy}.`,
    },
  });

  await recalculateWorkerTrafficLight(params.workerId);
  return getWorkerTrainingRoadmap(params.workerId);
}

/**
 * CMS de Capacitación para SSOMA: Crear o actualizar módulos y preguntas.
 */
export async function upsertTrainingModuleCms(params: {
  id?: string;
  code: string;
  title: string;
  description: string;
  videoUrl?: string;
  dayNumber: number;
  modality: TrainingModality;
  requiredHours: number;
  jobSpecialty?: JobPosition | null;
  orderIndex?: number;
  isActive?: boolean;
}) {
  let course = await prisma.trainingCourse.findFirst({ where: { isActive: true } });
  if (!course) {
    course = await prisma.trainingCourse.create({
      data: {
        code: 'DS-024-2016-EM',
        title: 'Programa Oficial de Inducción y Capacitación Minera (32 Horas)',
        description: 'Ruta híbrida de 4 días conforme al D.S. 024-2016-EM y D.S. 023-2017-EM.',
        totalHours: 32,
      },
    });
  }

  return prisma.trainingModule.upsert({
    where: { code: params.code },
    update: {
      title: params.title,
      description: params.description,
      videoUrl: params.videoUrl,
      dayNumber: params.dayNumber,
      modality: params.modality,
      requiredHours: params.requiredHours,
      jobSpecialty: params.jobSpecialty ?? null,
      orderIndex: params.orderIndex ?? params.dayNumber,
      isActive: params.isActive ?? true,
    },
    create: {
      courseId: course.id,
      code: params.code,
      title: params.title,
      description: params.description,
      videoUrl: params.videoUrl,
      dayNumber: params.dayNumber,
      modality: params.modality,
      requiredHours: params.requiredHours,
      jobSpecialty: params.jobSpecialty ?? null,
      orderIndex: params.orderIndex ?? params.dayNumber,
      isActive: params.isActive ?? true,
    },
  });
}
