import crypto from 'node:crypto';
import { JobPosition } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { recalculateWorkerTrafficLight } from './trafficLight.service.js';

export type CourseModalityType = 'VIRTUAL' | 'PRESENCIAL';
export type CourseResourceTypeValue = 'VIDEO' | 'PDF' | 'PRESENTATION' | 'QUIZ';

export const DAY_SCHEDULE_METADATA: Record<
  number,
  { title: string; defaultModality: CourseModalityType; description: string }
> = {
  1: {
    title: 'Día 1 — Inducción General de la Empresa',
    defaultModality: 'VIRTUAL',
    description: 'Políticas internas, cultura de seguridad, RIT y estándares de Minera Bateas (D.S. 024-2016-EM).',
  },
  2: {
    title: 'Día 2 — Conocimientos Técnicos y Seguridad',
    defaultModality: 'VIRTUAL',
    description: 'IPERC, estándares operativos por puesto, MATPEL, LOTO y prevención de riesgos específicos.',
  },
  3: {
    title: 'Día 3 — Capacitación Presencial y Actividades Prácticas',
    defaultModality: 'PRESENCIAL',
    description: 'Prácticas en campo, uso de EPP, rescate minero, manejo defensivo y verificación presencial SSOMA.',
  },
  4: {
    title: 'Día 4 — Simulaciones Presenciales y Evaluación Final',
    defaultModality: 'PRESENCIAL',
    description: 'Simulacros de emergencia, evaluación práctica en terreno y cierre de habilitación 4 jornadas.',
  },
};

export async function listCmsCourses(includeInactive = true) {
  const courses = await prisma.trainingCourse.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      resources: { orderBy: { orderIndex: 'asc' } },
      questions: { orderBy: { id: 'asc' } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
  });

  const daySubtotals: Record<
    number,
    { dayNumber: number; title: string; modality: CourseModalityType; totalHours: number; courseCount: number }
  > = {
    1: { dayNumber: 1, title: DAY_SCHEDULE_METADATA[1].title, modality: 'VIRTUAL', totalHours: 0, courseCount: 0 },
    2: { dayNumber: 2, title: DAY_SCHEDULE_METADATA[2].title, modality: 'VIRTUAL', totalHours: 0, courseCount: 0 },
    3: { dayNumber: 3, title: DAY_SCHEDULE_METADATA[3].title, modality: 'PRESENCIAL', totalHours: 0, courseCount: 0 },
    4: { dayNumber: 4, title: DAY_SCHEDULE_METADATA[4].title, modality: 'PRESENCIAL', totalHours: 0, courseCount: 0 },
  };

  let grandTotalHours = 0;
  for (const c of courses) {
    if (!c.isActive) continue;
    const d = Math.min(4, Math.max(1, c.dayNumber || 1));
    daySubtotals[d].totalHours = Number((daySubtotals[d].totalHours + (c.durationHours || 0)).toFixed(2));
    daySubtotals[d].courseCount += 1;
    grandTotalHours = Number((grandTotalHours + (c.durationHours || 0)).toFixed(2));
  }

  return {
    courses: courses.map((c) => ({
      ...c,
      resources: c.resources.map((r) => ({
        ...r,
        contentUrl: r.fileUrl,
      })),
      questions: c.questions.map((q) => ({
        ...q,
        prompt: q.questionText,
      })),
    })),
    daySubtotals: Object.values(daySubtotals),
    grandTotalHours,
  };
}

export async function createCmsCourse(input: {
  code?: string;
  title: string;
  description?: string;
  dayNumber: number;
  modality?: CourseModalityType;
  durationHours: number;
  minPassScore?: number;
  maxAttempts?: number;
  jobSpecialty?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}) {
  const dayNumber = Math.min(4, Math.max(1, Number(input.dayNumber) || 1));
  const modality: CourseModalityType =
    input.modality ?? (dayNumber <= 2 ? 'VIRTUAL' : 'PRESENCIAL');
  const code =
    input.code?.trim() ||
    `CURSO-D${dayNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  return prisma.trainingCourse.create({
    data: {
      code,
      title: input.title.trim(),
      description: input.description?.trim() || input.title.trim(),
      dayNumber,
      modality,
      durationHours: Math.max(0.25, Number(input.durationHours) || 1),
      minPassScore: Math.min(100, Math.max(1, Number(input.minPassScore) || 75)),
      maxAttempts: Math.max(1, Number(input.maxAttempts) || 3),
      jobSpecialty: input.jobSpecialty?.trim() ? (input.jobSpecialty.trim() as JobPosition) : null,
      orderIndex: Number(input.orderIndex) || 1,
      isActive: input.isActive ?? true,
    },
    include: { resources: true, questions: true },
  });
}

export async function updateCmsCourse(
  courseId: string,
  input: Partial<{
    title: string;
    description: string | null;
    dayNumber: number;
    modality: CourseModalityType;
    durationHours: number;
    minPassScore: number;
    maxAttempts: number;
    jobSpecialty: string | null;
    orderIndex: number;
    isActive: boolean;
  }>
) {
  const data: any = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || '';
  if (input.dayNumber !== undefined) data.dayNumber = Math.min(4, Math.max(1, Number(input.dayNumber)));
  if (input.modality !== undefined) data.modality = input.modality;
  if (input.durationHours !== undefined) data.durationHours = Math.max(0.25, Number(input.durationHours));
  if (input.minPassScore !== undefined) data.minPassScore = Math.min(100, Math.max(1, Number(input.minPassScore)));
  if (input.maxAttempts !== undefined) data.maxAttempts = Math.max(1, Number(input.maxAttempts));
  if (input.jobSpecialty !== undefined) {
    data.jobSpecialty = input.jobSpecialty?.trim() ? (input.jobSpecialty.trim() as JobPosition) : null;
  }
  if (input.orderIndex !== undefined) data.orderIndex = Number(input.orderIndex);
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);

  return prisma.trainingCourse.update({
    where: { id: courseId },
    data,
    include: { resources: { orderBy: { orderIndex: 'asc' } }, questions: true },
  });
}

export async function deleteCmsCourse(courseId: string) {
  return prisma.trainingCourse.delete({ where: { id: courseId } });
}

export async function addCourseResource(
  courseId: string,
  input: {
    type: CourseResourceTypeValue;
    title: string;
    contentUrl?: string | null;
    fileName?: string | null;
    durationMinutes?: number;
    orderIndex?: number;
  }
) {
  return prisma.trainingResource.create({
    data: {
      courseId,
      type: input.type,
      title: input.title.trim(),
      fileUrl: input.contentUrl?.trim() || null,
      fileName: input.fileName?.trim() || null,
      durationMinutes: Math.max(1, Number(input.durationMinutes) || 15),
      orderIndex: Number(input.orderIndex) || 1,
    },
  });
}

export async function deleteCourseResource(resourceId: string) {
  return prisma.trainingResource.delete({ where: { id: resourceId } });
}

export async function addCourseQuestion(
  courseId: string,
  input: {
    prompt: string;
    options: string[];
    correctIndex: number;
    points?: number;
  }
) {
  return prisma.trainingQuestion.create({
    data: {
      courseId,
      questionText: input.prompt.trim(),
      optionsJson: JSON.stringify(input.options),
      correctIndex: Math.max(0, Number(input.correctIndex) || 0),
      points: Math.max(1, Number(input.points) || 2),
    },
  });
}

export async function deleteCourseQuestion(questionId: string) {
  return prisma.trainingQuestion.delete({ where: { id: questionId } });
}

export async function assignCoursesToWorkers(input: {
  courseIds: string[];
  workerIds?: string[];
  jobPosition?: string;
  contractorId?: string;
  assignedBy?: string;
}) {
  let targetWorkerIds = input.workerIds ?? [];

  if (targetWorkerIds.length === 0 && (input.jobPosition || input.contractorId)) {
    const workers = await prisma.worker.findMany({
      where: {
        ...(input.jobPosition ? { jobPosition: input.jobPosition as JobPosition } : {}),
        ...(input.contractorId ? { contractorId: input.contractorId } : {}),
      },
      select: { id: true },
    });
    targetWorkerIds = workers.map((w) => w.id);
  }

  if (targetWorkerIds.length === 0 || input.courseIds.length === 0) {
    return { createdCount: 0, workerCount: targetWorkerIds.length };
  }

  let createdCount = 0;
  for (const workerId of targetWorkerIds) {
    for (const courseId of input.courseIds) {
      const existing = await prisma.workerCourseAssignment.findUnique({
        where: { workerId_courseId: { workerId, courseId } },
      });
      if (!existing) {
        await prisma.workerCourseAssignment.create({
          data: {
            workerId,
            courseId,
            status: 'PENDING',
            notes: input.assignedBy ? `Asignado por ${input.assignedBy}` : null,
          },
        });
        createdCount += 1;
      }
    }
    await recalculateWorkerTrafficLight(workerId);
  }

  return { createdCount, workerCount: targetWorkerIds.length };
}

export async function getWorkerCourseDashboard(workerId: string) {
  const assignments = await prisma.workerCourseAssignment.findMany({
    where: { workerId },
    include: {
      course: {
        include: {
          resources: { orderBy: { orderIndex: 'asc' } },
          questions: { orderBy: { id: 'asc' } },
        },
      },
    },
    orderBy: [{ course: { dayNumber: 'asc' } }, { course: { orderIndex: 'asc' } }],
  });

  const daySummary = [1, 2, 3, 4].map((day) => {
    const dayAssignments = assignments.filter((a) => a.course.dayNumber === day);
    const requiredHours = Number(
      dayAssignments.reduce((acc, a) => acc + (a.course.durationHours || 0), 0).toFixed(2)
    );
    const completedHours = Number(
      dayAssignments
        .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
        .toFixed(2)
    );
    const allCompleted =
      dayAssignments.length > 0 && dayAssignments.every((a) => a.status === 'COMPLETED');

    return {
      dayNumber: day,
      title: DAY_SCHEDULE_METADATA[day].title,
      modality: DAY_SCHEDULE_METADATA[day].defaultModality,
      description: DAY_SCHEDULE_METADATA[day].description,
      requiredHours,
      completedHours,
      totalCourses: dayAssignments.length,
      completedCourses: dayAssignments.filter((a) => a.status === 'COMPLETED').length,
      allCompleted,
    };
  });

  const dayUnlocked: Record<number, boolean> = { 1: true, 2: false, 3: false, 4: false };
  for (let d = 2; d <= 4; d++) {
    const prev = daySummary[d - 2];
    dayUnlocked[d] = dayUnlocked[d - 1] && (prev.totalCourses === 0 || prev.allCompleted);
  }

  const enriched = assignments.map((a) => ({
    ...a,
    isDayUnlocked: dayUnlocked[a.course.dayNumber] ?? true,
    course: {
      ...a.course,
      resources: a.course.resources.map((r) => ({
        ...r,
        contentUrl: r.fileUrl,
      })),
      questions: a.course.questions.map((q) => ({
        id: q.id,
        prompt: q.questionText,
        options: JSON.parse(q.optionsJson) as string[],
        points: q.points,
      })),
    },
  }));

  const pendingCourses = enriched.filter((a) => a.status !== 'COMPLETED');
  const completedCourses = enriched.filter((a) => a.status === 'COMPLETED');

  const totalRequiredHours = Number(
    daySummary.reduce((acc, d) => acc + d.requiredHours, 0).toFixed(2)
  );
  const totalCompletedHours = Number(
    daySummary.reduce((acc, d) => acc + d.completedHours, 0).toFixed(2)
  );
  const overallProgressPercent =
    totalRequiredHours > 0
      ? Math.min(100, Math.round((totalCompletedHours / totalRequiredHours) * 100))
      : 0;

  const cert = await prisma.trainingCertificate.findFirst({
    where: { workerId },
    orderBy: { issuedAt: 'desc' },
  });

  return {
    pendingCourses,
    completedCourses,
    daySummary,
    dayUnlocked,
    totalRequiredHours,
    totalCompletedHours,
    overallProgressPercent,
    allFourDaysCompleted:
      assignments.length > 0 && daySummary.every((d) => d.totalCourses === 0 || d.allCompleted),
    certificate: cert
      ? {
          ...cert,
          verificationCode: cert.certificateCode,
        }
      : null,
  };
}

export async function recordCourseWatchProgress(input: {
  workerId: string;
  courseId: string;
  deltaSeconds: number;
  demoAccelerated?: boolean;
}) {
  const assignment = await prisma.workerCourseAssignment.findUnique({
    where: { workerId_courseId: { workerId: input.workerId, courseId: input.courseId } },
    include: { course: { include: { questions: true } } },
  });

  if (!assignment) {
    throw new Error('El trabajador no tiene asignada esta capacitación.');
  }

  const requiredSeconds = Math.max(60, Math.round(assignment.course.durationHours * 3600));
  const effectiveDelta = input.demoAccelerated
    ? Math.max(requiredSeconds, input.deltaSeconds)
    : Math.max(1, input.deltaSeconds);

  const nextWatched = Math.min(requiredSeconds, assignment.watchedSeconds + effectiveDelta);
  const nextHours = Number((nextWatched / 3600).toFixed(2));
  const nextPercent = Math.min(100, Math.round((nextWatched / requiredSeconds) * 100));

  const hasQuiz = assignment.course.questions.length > 0;
  const isVirtual = assignment.course.modality === 'VIRTUAL';
  const autoComplete = isVirtual && !hasQuiz && nextPercent >= 100;

  const updated = await prisma.workerCourseAssignment.update({
    where: { id: assignment.id },
    data: {
      watchedSeconds: nextWatched,
      hoursCompleted: autoComplete ? assignment.course.durationHours : nextHours,
      progressPercent: nextPercent,
      status: autoComplete
        ? 'COMPLETED'
        : assignment.status === 'PENDING'
        ? 'IN_PROGRESS'
        : assignment.status,
      completedAt: autoComplete ? new Date() : assignment.completedAt,
    },
  });

  if (autoComplete) {
    await recalculateWorkerTrafficLight(input.workerId);
  }

  return updated;
}

export async function submitCourseExam(input: {
  workerId: string;
  courseId: string;
  answers: Record<string, number>;
}) {
  const assignment = await prisma.workerCourseAssignment.findUnique({
    where: { workerId_courseId: { workerId: input.workerId, courseId: input.courseId } },
    include: { course: { include: { questions: true } } },
  });

  if (!assignment) {
    throw new Error('Capacitación no asignada al trabajador.');
  }

  if (assignment.attemptsUsed >= assignment.course.maxAttempts && assignment.status !== 'COMPLETED') {
    throw new Error(`Se alcanzó el límite máximo de ${assignment.course.maxAttempts} intentos.`);
  }

  const questions = assignment.course.questions;
  if (questions.length === 0) {
    throw new Error('Esta capacitación no tiene preguntas configuradas.');
  }

  let totalPoints = 0;
  let earnedPoints = 0;
  for (const q of questions) {
    const pts = q.points || 1;
    totalPoints += pts;
    if (input.answers[q.id] === q.correctIndex) {
      earnedPoints += pts;
    }
  }

  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = score >= assignment.course.minPassScore;

  const updated = await prisma.workerCourseAssignment.update({
    where: { id: assignment.id },
    data: {
      attemptsUsed: assignment.attemptsUsed + 1,
      examScore: score,
      status: passed ? 'COMPLETED' : 'FAILED',
      progressPercent: passed ? 100 : Math.max(assignment.progressPercent, 85),
      hoursCompleted: passed ? assignment.course.durationHours : assignment.hoursCompleted,
      completedAt: passed ? new Date() : null,
    },
  });

  await recalculateWorkerTrafficLight(input.workerId);

  return {
    score,
    passed,
    minPassScore: assignment.course.minPassScore,
    attemptsUsed: updated.attemptsUsed,
    maxAttempts: assignment.course.maxAttempts,
    assignment: updated,
  };
}

export async function recordCoursePresentialAttendance(input: {
  workerId: string;
  courseId: string;
  attended: boolean;
  presentialScore: number;
  notes?: string;
  recordedBy: string;
}) {
  const assignment = await prisma.workerCourseAssignment.findUnique({
    where: { workerId_courseId: { workerId: input.workerId, courseId: input.courseId } },
    include: { course: true },
  });

  if (!assignment) {
    throw new Error('Capacitación no asignada al trabajador.');
  }

  const passed = input.attended && input.presentialScore >= assignment.course.minPassScore;

  const updated = await prisma.workerCourseAssignment.update({
    where: { id: assignment.id },
    data: {
      examScore: Math.round(input.presentialScore),
      instructorName: input.recordedBy,
      attendanceDate: new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || (input.attended ? 'Asistencia presencial validada por SSOMA' : 'Inasistencia'),
      status: passed ? 'COMPLETED' : 'FAILED',
      progressPercent: passed ? 100 : input.attended ? 70 : 0,
      hoursCompleted: passed ? assignment.course.durationHours : 0,
      completedAt: passed ? new Date() : null,
    },
  });

  await recalculateWorkerTrafficLight(input.workerId);

  const dashboard = await getWorkerCourseDashboard(input.workerId);
  if (dashboard.allFourDaysCompleted && !dashboard.certificate) {
    await issueTrainingCertificate(input.workerId, input.recordedBy);
  }

  return updated;
}

export async function issueTrainingCertificate(workerId: string, issuedBy: string) {
  const assignments = await prisma.workerCourseAssignment.findMany({
    where: { workerId },
    include: { course: true },
  });

  const virtualHours = Number(
    assignments
      .filter((a) => a.course.modality === 'VIRTUAL')
      .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
      .toFixed(2)
  );
  const presentialHours = Number(
    assignments
      .filter((a) => a.course.modality === 'PRESENCIAL')
      .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
      .toFixed(2)
  );
  const totalHours = Number((virtualHours + presentialHours).toFixed(2));

  const scores = assignments
    .map((a) => a.examScore)
    .filter((s): s is number => typeof s === 'number');
  const averageScore =
    scores.length > 0
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
      : 100;

  const certificateCode = `BAT-CERT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const created = await prisma.trainingCertificate.create({
    data: {
      workerId,
      certificateCode,
      virtualHours,
      presentialHours,
      totalHours,
      averageScore,
      issuedBy,
    },
  });

  return {
    ...created,
    verificationCode: created.certificateCode,
  };
}

export async function getTrainingTrackingReport(filters?: {
  contractorId?: string;
  jobPosition?: string;
  status?: string;
  search?: string;
}) {
  const workers = await prisma.worker.findMany({
    where: {
      ...(filters?.contractorId ? { contractorId: filters.contractorId } : {}),
      ...(filters?.jobPosition ? { jobPosition: filters.jobPosition as JobPosition } : {}),
      ...(filters?.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: 'insensitive' } },
              { dni: { contains: filters.search } },
            ],
          }
        : {}),
    },
    include: {
      contractor: true,
      courseAssignments: { include: { course: true } },
      certificates: { orderBy: { issuedAt: 'desc' }, take: 1 },
    },
    orderBy: { fullName: 'asc' },
  });

  const rows = workers.map((w) => {
    const totalCourses = w.courseAssignments.length;
    const completedCourses = w.courseAssignments.filter((a) => a.status === 'COMPLETED').length;
    const requiredHours = Number(
      w.courseAssignments.reduce((acc, a) => acc + (a.course.durationHours || 0), 0).toFixed(2)
    );
    const completedHours = Number(
      w.courseAssignments
        .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
        .toFixed(2)
    );
    const virtualHours = Number(
      w.courseAssignments
        .filter((a) => a.course.modality === 'VIRTUAL')
        .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
        .toFixed(2)
    );
    const presentialHours = Number(
      w.courseAssignments
        .filter((a) => a.course.modality === 'PRESENCIAL')
        .reduce((acc, a) => acc + (a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted), 0)
        .toFixed(2)
    );
    const progressPercent =
      requiredHours > 0 ? Math.min(100, Math.round((completedHours / requiredHours) * 100)) : 0;

    const scores = w.courseAssignments
      .map((a) => a.examScore)
      .filter((s): s is number => typeof s === 'number');
    const averageScore =
      scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null;

    const dayBreakdown = [1, 2, 3, 4].map((d) => {
      const items = w.courseAssignments.filter((a) => a.course.dayNumber === d);
      const done = items.length > 0 && items.every((a) => a.status === 'COMPLETED');
      return {
        dayNumber: d,
        total: items.length,
        completed: items.filter((a) => a.status === 'COMPLETED').length,
        done,
      };
    });

    const overallStatus =
      totalCourses === 0
        ? 'SIN_ASIGNACION'
        : completedCourses === totalCourses
        ? 'COMPLETADO'
        : completedCourses > 0 || w.courseAssignments.some((a) => a.status === 'IN_PROGRESS')
        ? 'EN_PROGRESO'
        : 'PENDIENTE';

    const cert = w.certificates[0] ?? null;

    return {
      workerId: w.id,
      dni: w.dni,
      fullName: w.fullName,
      jobPosition: w.jobPosition,
      contractorId: w.contractorId,
      contractorName: w.contractor.companyName,
      trafficLightStatus: w.trafficLight,
      totalCourses,
      completedCourses,
      requiredHours,
      completedHours,
      virtualHours,
      presentialHours,
      progressPercent,
      averageScore,
      overallStatus,
      dayBreakdown,
      certificate: cert
        ? {
            ...cert,
            verificationCode: cert.certificateCode,
          }
        : null,
      assignments: w.courseAssignments.map((a) => ({
        assignmentId: a.id,
        courseId: a.courseId,
        courseTitle: a.course.title,
        dayNumber: a.course.dayNumber,
        modality: a.course.modality,
        durationHours: a.course.durationHours,
        hoursCompleted: a.status === 'COMPLETED' ? a.course.durationHours : a.hoursCompleted,
        progressPercent: a.progressPercent,
        status: a.status,
        examScore: a.examScore,
        presentialScore: a.course.modality === 'PRESENCIAL' ? a.examScore : null,
        completedAt: a.completedAt,
      })),
    };
  });

  const filteredRows =
    filters?.status && filters.status !== 'ALL'
      ? rows.filter((r) => r.overallStatus === filters.status)
      : rows;

  const kpis = {
    totalWorkers: filteredRows.length,
    completedWorkers: filteredRows.filter((r) => r.overallStatus === 'COMPLETADO').length,
    inProgressWorkers: filteredRows.filter((r) => r.overallStatus === 'EN_PROGRESO').length,
    pendingWorkers: filteredRows.filter((r) => r.overallStatus === 'PENDIENTE').length,
    averageCompliancePercent:
      filteredRows.length > 0
        ? Math.round(
            filteredRows.reduce((acc, r) => acc + r.progressPercent, 0) / filteredRows.length
          )
        : 0,
  };

  return { kpis, rows: filteredRows };
}
