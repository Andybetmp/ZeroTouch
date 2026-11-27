import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import {
  createDemoScenarioWorkflow,
  processWorkerDocumentWorkflow,
  registerWorkerWorkflow,
  resolveExceptionTicketWorkflow,
  submitElearningAttemptWorkflow,
} from '../services/workflow.service.js';
import {
  manualOverrideWorkerTrafficLight,
  verifyGaritaBadgeOrDni,
} from '../services/trafficLight.service.js';
import { analyzeDocumentWithGeminiAi, askBateasAiCopilot } from '../services/ai.service.js';
import {
  encodeAuthToken,
  extractAuthMiddleware,
  requireRole,
} from '../middleware/rbac.middleware.js';
import {
  ensureWorkerTrainingPlan,
  getWorkerTrainingRoadmap,
  recordModuleWatchProgress,
  recordPresentialTrainingBySsoma,
  submitModuleExam,
  upsertTrainingModuleCms,
} from '../services/training.service.js';
import {
  listBiometricAuditLogs,
  verifyBiometricFrame,
} from '../services/biometrics.service.js';
import {
  addCourseQuestion,
  addCourseResource,
  assignCoursesToWorkers,
  createCmsCourse,
  deleteCmsCourse,
  deleteCourseQuestion,
  deleteCourseResource,
  getAreaLabel,
  getTrainingTrackingReport,
  getWorkerCourseDashboard,
  issueTrainingCertificate,
  listCmsCourses,
  recordCoursePresentialAttendance,
  recordCourseWatchProgress,
  submitCourseExam,
  syncWorkerCoursesByArea,
  syncWorkersForArea,
  updateCmsCourse,
  VALID_ACCESS_AREAS,
} from '../services/courseCms.service.js';
import {
  autofillCvFromPdf,
  getWorkerCvProfile,
  uploadWorkerCvPdf,
  upsertWorkerCvProfile,
} from '../services/cvProfile.service.js';
import {
  ensureWorkerExternalIntegrations,
  syncClinicEmoRecord,
  syncInsurerPolicyRecord,
} from '../services/integrations.service.js';
import {
  completeVrSimulationSession,
  generateVrPairingCode,
  VR_SOCAVON_SCENARIOS,
} from '../services/vr.service.js';

export const apiRouter = Router();
apiRouter.use(extractAuthMiddleware);

// Cuentas corporativas autorizadas para demostración y pruebas (RBAC: SSOMA, ECM, GARITA, TRABAJADOR)
const DEMO_USERS = [
  {
    username: 'ecm@bateas.pe',
    password: process.env.DEMO_PASSWORD_ECM || 'Bateas2026!',
    role: 'ECM' as const,
    legacyRoleLabel: 'ADMIN_ECM',
    fullName: 'Ing. Roberto Salazar (Admin ECM)',
    areaLabel: 'Empresa Contratista Minera (ECM)',
    defaultWorkerDni: null,
  },
  {
    username: 'ssoma@bateas.pe',
    password: process.env.DEMO_PASSWORD_SSOMA || 'Bateas2026!',
    role: 'SSOMA' as const,
    legacyRoleLabel: 'SSOMA_DHO',
    fullName: 'Esp. Víctor Cayata (DHO / SSOMA)',
    areaLabel: 'Auditoría Interna Minera Bateas (SSOMA / Médico / DHO)',
    defaultWorkerDni: null,
  },
  {
    username: 'garita@bateas.pe',
    password: process.env.DEMO_PASSWORD_GARITA || 'Bateas2026!',
    role: 'GARITA' as const,
    legacyRoleLabel: 'GARITA',
    fullName: 'Sup. Control Patrimonial Garita',
    areaLabel: 'Control de Accesos y Fotocheck PVC',
    defaultWorkerDni: null,
  },
  {
    username: 'trabajador@bateas.pe',
    password: process.env.DEMO_PASSWORD_WORKER || 'Bateas2026!',
    role: 'TRABAJADOR' as const,
    legacyRoleLabel: 'TRABAJADOR',
    fullName: 'Jorge Luis Huamán Condori (Trabajador Contratista)',
    areaLabel: 'Portal Exclusivo del Trabajador (Ruta 32h / Biometría / RV)',
    defaultWorkerDni: '45812034',
  },
];

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const emailClean = String(username || '').trim().toLowerCase();
    const passClean = String(password || '').trim();

    // 1. Buscar en tabla User de PostgreSQL
    let dbUser = await prisma.user.findUnique({
      where: { email: emailClean },
      include: { worker: true },
    });

    const preset = DEMO_USERS.find((u) => u.username.toLowerCase() === emailClean);

    if (!dbUser && !preset) {
      res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
      });
      return;
    }

    const expectedPassword = dbUser ? dbUser.passwordHash : preset!.password;
    if (passClean !== expectedPassword) {
      res.status(401).json({
        success: false,
        error: 'Contraseña incorrecta para la cuenta corporativa seleccionada.',
      });
      return;
    }

    let workerId = dbUser?.workerId || null;
    let workerDni = dbUser?.worker?.dni || preset?.defaultWorkerDni || null;

    if (!workerId && preset?.role === 'TRABAJADOR') {
      const targetWorker =
        (workerDni ? await prisma.worker.findUnique({ where: { dni: workerDni } }) : null) ||
        (await prisma.worker.findFirst({ orderBy: { createdAt: 'desc' } }));
      if (targetWorker) {
        workerId = targetWorker.id;
        workerDni = targetWorker.dni;
      }
    }

    const role = dbUser ? dbUser.role : preset!.role;
    const fullName = dbUser ? dbUser.fullName : preset!.fullName;
    const areaLabel = dbUser ? dbUser.areaLabel : preset!.areaLabel;

    const token = encodeAuthToken({
      email: emailClean,
      role,
      workerId,
      fullName,
    });

    res.json({
      success: true,
      data: {
        username: emailClean,
        role: preset ? preset.legacyRoleLabel : role,
        strictRole: role,
        workerId,
        workerDni,
        requiresBiometricLogin: role === 'TRABAJADOR',
        fullName,
        areaLabel,
        token,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 1. Dashboard KPIs & Métricas Zero-Touch
apiRouter.get('/dashboard/metrics', async (_req, res) => {
  try {
    const now = new Date();
    const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

    const [
      totalWorkers,
      greenCount,
      amberCount,
      redCount,
      openExceptions,
      totalAnalyzedDocs,
      zeroTouchDocs,
      queuedPvcCount,
      expiringSoonDocsCount,
      biometricIncidentsCount,
    ] = await Promise.all([
      prisma.worker.count(),
      prisma.worker.count({ where: { trafficLight: 'VERDE' } }),
      prisma.worker.count({ where: { trafficLight: 'AMBAR' } }),
      prisma.worker.count({ where: { trafficLight: 'ROJO' } }),
      prisma.exceptionReview.count({ where: { reviewStatus: 'OPEN' } }),
      prisma.workerDocument.count({ where: { status: { not: 'PENDIENTE' } } }),
      prisma.workerDocument.count({
        where: {
          status: 'VERDE',
          statusReason: { contains: 'Zero-Touch' },
        },
      }),
      prisma.digitalBadgeQr.count({ where: { pvcPrintStatus: 'QUEUED_GARITA' } }),
      prisma.workerDocument.count({
        where: {
          detectedExpiryDate: {
            gte: now,
            lte: in20Days,
          },
        },
      }),
      prisma.biometricAuditLog.count({
        where: { eventType: { not: 'VERIFIED_OK' } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalWorkers,
        greenCount,
        amberCount,
        redCount,
        openExceptions,
        totalAnalyzedDocs,
        zeroTouchDocs,
        automationRatePercent:
          totalAnalyzedDocs > 0 ? Math.round((zeroTouchDocs / totalAnalyzedDocs) * 100) : 0,
        queuedPvcCount,
        expiringSoonDocsCount,
        biometricIncidentsCount,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Maestros: Documentos por Estadía (App Bateas v2.1.0) y Lista Negra
apiRouter.get('/masters/requirements', async (_req, res) => {
  try {
    const data = await prisma.stayTypeRequirement.findMany({
      orderBy: [{ isMandatory: 'desc' }, { name: 'asc' }],
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/masters/blacklist', async (_req, res) => {
  try {
    const data = await prisma.blacklistEntry.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/masters/blacklist', requireRole(['SSOMA']), async (req, res) => {
  try {
    const { dni, fullName, reason } = req.body;
    const entry = await prisma.blacklistEntry.upsert({
      where: { dni: String(dni).trim() },
      update: { fullName, reason, isActive: true },
      create: { dni: String(dni).trim(), fullName, reason, isActive: true },
    });
    res.json({ success: true, data: entry });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Trabajadores y Expedientes
apiRouter.get('/workers', async (req, res) => {
  try {
    // Si el usuario autenticado es TRABAJADOR, filtrar estrictamente solo su propio registro
    const whereClause =
      req.authUser?.role === 'TRABAJADOR' && req.authUser.workerId
        ? { id: req.authUser.workerId }
        : undefined;

    const workers = await prisma.worker.findMany({
      where: whereClause,
      include: {
        contractor: true,
        documents: {
          include: {
            requirement: true,
            exceptionReviews: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { requirement: { name: 'asc' } },
        },
        elearningAttempts: { orderBy: { attemptedAt: 'desc' } },
        digitalBadge: true,
        integrationRecords: { orderBy: { providerType: 'asc' } },
        trainingProgress: {
          include: { module: true },
          orderBy: { module: { dayNumber: 'asc' } },
        },
        vrSessions: { orderBy: { createdAt: 'desc' } },
        biometricLogs: { orderBy: { createdAt: 'desc' }, take: 15 },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 25 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: workers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/workers/:id', async (req, res) => {
  try {
    if (
      req.authUser?.role === 'TRABAJADOR' &&
      req.authUser.workerId &&
      req.params.id !== req.authUser.workerId
    ) {
      res.status(403).json({
        success: false,
        error: 'Acceso Denegado (RBAC): Un trabajador solo puede consultar su propio expediente.',
      });
      return;
    }

    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        contractor: true,
        documents: {
          include: {
            requirement: true,
            exceptionReviews: { orderBy: { createdAt: 'desc' } },
          },
          orderBy: { requirement: { name: 'asc' } },
        },
        elearningAttempts: { orderBy: { attemptedAt: 'desc' } },
        digitalBadge: true,
        integrationRecords: { orderBy: { providerType: 'asc' } },
        trainingProgress: {
          include: { module: true },
          orderBy: { module: { dayNumber: 'asc' } },
        },
        vrSessions: { orderBy: { createdAt: 'desc' } },
        biometricLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
        auditLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!worker) {
      res.status(404).json({ success: false, error: 'Trabajador no encontrado' });
      return;
    }
    res.json({ success: true, data: worker });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/workers', requireRole(['SSOMA', 'ECM']), async (req, res) => {
  try {
    const worker = await registerWorkerWorkflow(req.body);
    if (worker) {
      await ensureWorkerTrainingPlan(worker.id);
      await ensureWorkerExternalIntegrations(worker.id);
    }
    res.status(201).json({ success: true, data: worker });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/workers/demo-preset', async (req, res) => {
  try {
    const { scenario } = req.body;
    const worker = await createDemoScenarioWorkflow(scenario);
    if (worker) {
      await ensureWorkerTrainingPlan(worker.id);
      await ensureWorkerExternalIntegrations(worker.id);
    }
    res.status(201).json({ success: true, data: worker });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 4. Carga y Análisis OCR de Documento (Multipart File o Texto Simulado)
apiRouter.post(
  '/workers/:workerId/documents/:requirementId/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const workerId = String(req.params.workerId);
      const requirementId = String(req.params.requirementId);
      const file = req.file;
      const simulatedText = req.body?.simulatedText;

      if (!file && !simulatedText) {
        res.status(400).json({
          success: false,
          error: 'Debes adjuntar un archivo PDF/Imagen o proporcionar texto de prueba.',
        });
        return;
      }

      const updatedWorker = await processWorkerDocumentWorkflow({
        workerId,
        requirementId,
        fileName: file ? file.originalname : req.body?.fileName || 'documento_simulado.pdf',
        mimeType: file ? file.mimetype : 'application/pdf',
        fileBuffer: file ? file.buffer : undefined,
        directSimulatedText: file ? undefined : simulatedText,
      });

      res.json({ success: true, data: updatedWorker });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  }
);

// 5. Bandeja de Excepciones (SSOMA / Área Médica / DHO)
apiRouter.get('/exceptions', requireRole(['SSOMA', 'ECM']), async (req, res) => {
  try {
    const area = req.query.area as string | undefined;
    const status = (req.query.status as string | undefined) || 'OPEN';

    const exceptions = await prisma.exceptionReview.findMany({
      where: {
        ...(status !== 'ALL' ? { reviewStatus: status as any } : {}),
        ...(area && area !== 'ALL' ? { assignedArea: area as any } : {}),
      },
      include: {
        workerDocument: {
          include: {
            worker: { include: { contractor: true } },
            requirement: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: exceptions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/exceptions/:exceptionId/resolve', requireRole(['SSOMA']), async (req, res) => {
  try {
    const { decision, reviewerName, reviewerComment, manualExpiryDateStr } = req.body;
    const updatedWorker = await resolveExceptionTicketWorkflow({
      exceptionId: String(req.params.exceptionId),
      decision,
      reviewerName,
      reviewerComment,
      manualExpiryDateStr,
    });
    res.json({ success: true, data: updatedWorker });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 6. E-Learning Clásico (compatibilidad) + Nuevo Motor Híbrido 4 Días / 32 Horas (Módulo 2)
apiRouter.get('/elearning/questions', async (_req, res) => {
  try {
    const questions = await prisma.quizQuestion.findMany({
      where: { isActive: true },
    });
    res.json({
      success: true,
      data: questions.map((q) => ({
        id: q.id,
        category: q.category,
        questionText: q.questionText,
        options: JSON.parse(q.optionsJson),
        correctIndex: q.correctIndex,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/elearning/submit', async (req, res) => {
  try {
    const { workerId, sessionCode, scoreObtained, totalQuestions } = req.body;
    if (sessionCode) {
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });
      if (worker && worker.sessionCode.trim().toUpperCase() !== String(sessionCode).trim().toUpperCase()) {
        res.status(403).json({
          success: false,
          error: 'El Código Único de Sesión ingresado no coincide con el asignado al DNI del trabajador.',
        });
        return;
      }
    }
    const updatedWorker = await submitElearningAttemptWorkflow({
      workerId,
      scoreObtained: Number(scoreObtained),
      totalQuestions: Number(totalQuestions || 4),
    });
    res.json({ success: true, data: updatedWorker });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// MÓDULO 2: Endpoints de Capacitación Híbrida 32 Horas (Días 1–4) y CMS SSOMA
apiRouter.get('/training/roadmap/:workerId', async (req, res) => {
  try {
    const workerId = String(req.params.workerId);
    await ensureWorkerTrainingPlan(workerId);
    const roadmap = await getWorkerTrainingRoadmap(workerId);
    res.json({ success: true, data: roadmap });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/progress/watch', async (req, res) => {
  try {
    const { workerId, moduleId, addedSeconds } = req.body;
    const roadmap = await recordModuleWatchProgress({
      workerId: String(workerId),
      moduleId: String(moduleId),
      addedSeconds: Number(addedSeconds || 3600),
    });
    res.json({ success: true, data: roadmap });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/progress/exam', async (req, res) => {
  try {
    const { workerId, moduleId, answers } = req.body;
    const roadmap = await submitModuleExam({
      workerId: String(workerId),
      moduleId: String(moduleId),
      answers: Array.isArray(answers) ? answers : [],
    });
    res.json({ success: true, data: roadmap });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/presential/record', requireRole(['SSOMA']), async (req, res) => {
  try {
    const {
      workerId,
      moduleId,
      scheduledDate,
      scheduledShift,
      attendanceCompleted,
      practicalScore,
      attendanceVerifiedBy,
      observations,
    } = req.body;
    const roadmap = await recordPresentialTrainingBySsoma({
      workerId: String(workerId),
      moduleId: String(moduleId),
      scheduledDate,
      scheduledShift,
      attendanceCompleted: Boolean(attendanceCompleted),
      practicalScore: Number(practicalScore ?? 16),
      attendanceVerifiedBy: String(attendanceVerifiedBy || 'Instructor SSOMA Bateas'),
      observations,
    });
    res.json({ success: true, data: roadmap });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.get('/training/cms/modules', async (_req, res) => {
  try {
    const modules = await prisma.trainingModule.findMany({
      include: { questions: true, course: true },
      orderBy: [{ dayNumber: 'asc' }, { orderIndex: 'asc' }],
    });
    res.json({ success: true, data: modules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/cms/modules', requireRole(['SSOMA']), async (req, res) => {
  try {
    const mod = await upsertTrainingModuleCms(req.body);
    res.json({ success: true, data: mod });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/training/control-tower/override', requireRole(['SSOMA']), async (req, res) => {
  try {
    const { workerId, action, reviewerName, reason } = req.body;
    const updated = await manualOverrideWorkerTrafficLight({
      workerId: String(workerId),
      action,
      reviewerName: String(reviewerName || 'Torre de Control SSOMA'),
      reason: String(reason || 'Decisión administrativa SSOMA'),
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// MÓDULO 3: Biometría Facial y Proctoring Continuo con IA
apiRouter.post('/biometrics/verify', async (req, res) => {
  try {
    const result = await verifyBiometricFrame(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.get('/biometrics/logs', async (req, res) => {
  try {
    const workerId = req.query.workerId as string | undefined;
    const logs = await listBiometricAuditLogs(workerId);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// MÓDULO 4: Integraciones API en Tiempo Real y Webhooks (Clínicas EMO & Aseguradoras SCTR/Vida Ley)
apiRouter.get('/integrations/worker/:workerId', async (req, res) => {
  try {
    const records = await ensureWorkerExternalIntegrations(String(req.params.workerId));
    res.json({ success: true, data: records });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/integrations/emo/sync/:dni', async (req, res) => {
  try {
    const result = await syncClinicEmoRecord({
      dni: String(req.params.dni),
      ...req.body,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/webhooks/clinic-emo', async (req, res) => {
  try {
    const result = await syncClinicEmoRecord(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/integrations/policies/sync/:dni', async (req, res) => {
  try {
    const result = await syncInsurerPolicyRecord({
      dni: String(req.params.dni),
      ...req.body,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/webhooks/insurer-policy', async (req, res) => {
  try {
    const result = await syncInsurerPolicyRecord(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// MÓDULO 5: Pasarela y Simulador de Entrenamiento RV para Socavón
apiRouter.get('/vr/scenarios', (_req, res) => {
  res.json({ success: true, data: VR_SOCAVON_SCENARIOS });
});

apiRouter.post('/vr/sessions/pair', async (req, res) => {
  try {
    const { workerId } = req.body;
    const pairing = await generateVrPairingCode(String(workerId));
    res.json({ success: true, data: pairing });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/vr/sessions/complete', async (req, res) => {
  try {
    const result = await completeVrSimulationSession(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 7. Carné Digital QR, Verificador Criptográfico en Garita y Cola de Fotocheck Físico PVC
apiRouter.get('/badges/verify/:code', async (req, res) => {
  try {
    const result = await verifyGaritaBadgeOrDni(String(req.params.code));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.get('/badges', async (_req, res) => {
  try {
    const badges = await prisma.digitalBadgeQr.findMany({
      include: {
        worker: {
          include: { contractor: true },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });
    res.json({ success: true, data: badges });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/badges/:badgeId/pvc-status', async (req, res) => {
  try {
    const { pvcPrintStatus } = req.body;
    const badge = await prisma.digitalBadgeQr.update({
      where: { id: String(req.params.badgeId) },
      data: { pvcPrintStatus },
      include: { worker: { include: { contractor: true } } },
    });
    res.json({ success: true, data: badge });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 8. Copiloto IA & Auditoría Multimodal con Google Gemini
apiRouter.post('/ai/copilot', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !String(question).trim()) {
      res.status(400).json({ success: false, error: 'Escribe una consulta para el Copiloto IA.' });
      return;
    }
    const result = await askBateasAiCopilot(String(question));
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ai/audit-document/:workerDocumentId', async (req, res) => {
  try {
    const doc = await prisma.workerDocument.findUnique({
      where: { id: String(req.params.workerDocumentId) },
      include: { worker: true, requirement: true },
    });
    if (!doc) {
      res.status(404).json({ success: false, error: 'Documento no encontrado' });
      return;
    }
    const aiResult = await analyzeDocumentWithGeminiAi({
      requirementName: doc.requirement.name,
      expectedWorkerDni: doc.worker.dni,
      expectedWorkerName: doc.worker.fullName,
      requiresValidity: doc.requirement.requiresValidity,
      extractedText: doc.extractedText,
      fileBuffer: doc.fileData ? Buffer.from(doc.fileData) : null,
      mimeType: doc.fileMimeType,
    });
    res.json({ success: true, data: aiResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// MÓDULO 2 & 3: CMS DE CAPACITACIONES (4 DÍAS OBLIGATORIOS) + ASIGNACIONES
// =========================================================================

apiRouter.get('/courses', requireRole(['SSOMA', 'ECM', 'TRABAJADOR']), async (req, res) => {
  try {
    const includeInactive = req.authUser?.role === 'SSOMA' && req.query.includeInactive !== 'false';
    const data = await listCmsCourses(includeInactive);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses', requireRole(['SSOMA']), async (req, res) => {
  try {
    const course = await createCmsCourse(req.body);
    res.status(201).json({ success: true, data: course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.put('/courses/:id', requireRole(['SSOMA']), async (req, res) => {
  try {
    const course = await updateCmsCourse(String(req.params.id), req.body);
    res.json({ success: true, data: course });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/courses/:id', requireRole(['SSOMA']), async (req, res) => {
  try {
    await deleteCmsCourse(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/:id/resources', requireRole(['SSOMA']), upload.single('file'), async (req, res) => {
  try {
    let contentUrl = req.body.contentUrl as string | undefined;
    let fileName = req.body.fileName as string | undefined;
    let mimeType = req.body.mimeType as string | undefined;

    if (req.file) {
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
      contentUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const resource = await addCourseResource(String(req.params.id), {
      type: req.body.type,
      title: req.body.title,
      contentUrl,
      fileName,
      durationMinutes: Number(req.body.durationMinutes) || 15,
      orderIndex: Number(req.body.orderIndex) || 1,
    });
    res.status(201).json({ success: true, data: resource });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/courses/resources/:resourceId', requireRole(['SSOMA']), async (req, res) => {
  try {
    await deleteCourseResource(String(req.params.resourceId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/:id/questions', requireRole(['SSOMA']), async (req, res) => {
  try {
    const question = await addCourseQuestion(String(req.params.id), req.body);
    res.status(201).json({ success: true, data: question });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.delete('/courses/questions/:questionId', requireRole(['SSOMA']), async (req, res) => {
  try {
    await deleteCourseQuestion(String(req.params.questionId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/assign', requireRole(['SSOMA']), async (req, res) => {
  try {
    const result = await assignCoursesToWorkers({
      courseIds: Array.isArray(req.body.courseIds) ? req.body.courseIds : [],
      workerIds: Array.isArray(req.body.workerIds) ? req.body.workerIds : undefined,
      jobPosition: req.body.jobPosition || undefined,
      contractorId: req.body.contractorId || undefined,
      assignedBy: req.authUser?.email || 'ssoma@bateas.pe',
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.get('/courses/worker/:workerId/dashboard', requireRole(['SSOMA', 'ECM', 'TRABAJADOR']), async (req, res) => {
  try {
    const targetWorkerId = String(req.params.workerId);
    if (req.authUser?.role === 'TRABAJADOR' && req.authUser.workerId !== targetWorkerId) {
      res.status(403).json({ success: false, error: 'Solo puedes consultar tus propias capacitaciones.' });
      return;
    }
    const dashboard = await getWorkerCourseDashboard(targetWorkerId);
    res.json({ success: true, data: dashboard });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/worker/:workerId/watch', requireRole(['TRABAJADOR', 'SSOMA']), async (req, res) => {
  try {
    const targetWorkerId = String(req.params.workerId);
    if (req.authUser?.role === 'TRABAJADOR' && req.authUser.workerId !== targetWorkerId) {
      res.status(403).json({ success: false, error: 'Acceso denegado.' });
      return;
    }
    const updated = await recordCourseWatchProgress({
      workerId: targetWorkerId,
      courseId: String(req.body.courseId),
      deltaSeconds: Number(req.body.deltaSeconds) || 30,
      demoAccelerated: Boolean(req.body.demoAccelerated),
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/worker/:workerId/exam', requireRole(['TRABAJADOR', 'SSOMA']), async (req, res) => {
  try {
    const targetWorkerId = String(req.params.workerId);
    if (req.authUser?.role === 'TRABAJADOR' && req.authUser.workerId !== targetWorkerId) {
      res.status(403).json({ success: false, error: 'Acceso denegado.' });
      return;
    }
    const result = await submitCourseExam({
      workerId: targetWorkerId,
      courseId: String(req.body.courseId),
      answers: req.body.answers || {},
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/worker/:workerId/presential', requireRole(['SSOMA']), async (req, res) => {
  try {
    const updated = await recordCoursePresentialAttendance({
      workerId: String(req.params.workerId),
      courseId: String(req.body.courseId),
      attended: Boolean(req.body.attended),
      presentialScore: Number(req.body.presentialScore) || 0,
      notes: req.body.notes,
      recordedBy: req.authUser?.email || 'ssoma@bateas.pe',
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// MÓDULO 4: PERFIL CV ESTRUCTURADO (MANUAL + PDF + AUTOCOMPLETADO IA)
// =========================================================================

apiRouter.get('/workers/:workerId/cv-profile', requireRole(['SSOMA', 'ECM', 'TRABAJADOR']), async (req, res) => {
  try {
    const targetWorkerId = String(req.params.workerId);
    if (req.authUser?.role === 'TRABAJADOR' && req.authUser.workerId !== targetWorkerId) {
      res.status(403).json({ success: false, error: 'Acceso denegado.' });
      return;
    }
    const profile = await getWorkerCvProfile(targetWorkerId);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.put('/workers/:workerId/cv-profile', requireRole(['SSOMA', 'ECM']), async (req, res) => {
  try {
    const profile = await upsertWorkerCvProfile(
      String(req.params.workerId),
      req.body,
      req.authUser?.email || 'ssoma@bateas.pe'
    );
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/workers/:workerId/cv-profile/pdf', requireRole(['SSOMA', 'ECM']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Adjunta un archivo PDF.' });
      return;
    }
    const profile = await uploadWorkerCvPdf(
      String(req.params.workerId),
      req.file,
      req.authUser?.email || 'ssoma@bateas.pe'
    );
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/workers/:workerId/cv-profile/autofill', requireRole(['SSOMA', 'ECM']), async (req, res) => {
  try {
    const profile = await autofillCvFromPdf(
      String(req.params.workerId),
      req.authUser?.email || 'ssoma@bateas.pe'
    );
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// MÓDULO 5: SEGUIMIENTO, REPORTES Y CONSTANCIAS OFICIALES
// =========================================================================

apiRouter.get('/reports/training', requireRole(['SSOMA']), async (req, res) => {
  try {
    const report = await getTrainingTrackingReport({
      contractorId: req.query.contractorId ? String(req.query.contractorId) : undefined,
      jobPosition: req.query.jobPosition ? String(req.query.jobPosition) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/courses/sync-areas', requireRole(['SSOMA']), async (_req, res) => {
  try {
    const result = await syncWorkersForArea(null);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.patch('/workers/:workerId/area', requireRole(['SSOMA', 'ECM']), async (req, res) => {
  try {
    const workerId = String(req.params.workerId);
    const accessZone = String(req.body?.accessZone || '').trim().toUpperCase();
    if (!VALID_ACCESS_AREAS.includes(accessZone as any)) {
      res.status(400).json({
        success: false,
        error: `Área de ingreso inválida. Valores permitidos: ${VALID_ACCESS_AREAS.join(', ')}.`,
      });
      return;
    }

    const updated = await prisma.worker.update({
      where: { id: workerId },
      data: { accessZone: accessZone as any },
      include: { contractor: true },
    });

    await prisma.auditLog.create({
      data: {
        workerId,
        actorArea: req.authUser?.role || 'SSOMA',
        action: 'CAMBIO_AREA_INGRESO',
        details: `Área de ingreso actualizada a ${getAreaLabel(accessZone as any)}. Cursos reasignados automáticamente.`,
      },
    });

    const syncResult = await syncWorkerCoursesByArea(workerId);
    res.json({
      success: true,
      data: {
        worker: updated,
        areaLabel: getAreaLabel(accessZone as any),
        syncResult,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/certificates/worker/:workerId/issue', requireRole(['SSOMA']), async (req, res) => {
  try {
    const cert = await issueTrainingCertificate(
      String(req.params.workerId),
      req.authUser?.email || 'ssoma@bateas.pe'
    );
    res.json({ success: true, data: cert });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
