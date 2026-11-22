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
import { verifyGaritaBadgeOrDni } from '../services/trafficLight.service.js';
import { analyzeDocumentWithGeminiAi, askBateasAiCopilot } from '../services/ai.service.js';

export const apiRouter = Router();

// Cuentas corporativas autorizadas para demostración y pruebas del cliente (RBAC)
const DEMO_USERS = [
  {
    username: 'ecm@bateas.pe',
    password: process.env.DEMO_PASSWORD_ECM || 'Bateas2026!',
    role: 'ADMIN_ECM',
    fullName: 'Ing. Roberto Salazar (Admin ECM)',
    areaLabel: 'Empresa Contratista Minera (ECM)',
  },
  {
    username: 'ssoma@bateas.pe',
    password: process.env.DEMO_PASSWORD_SSOMA || 'Bateas2026!',
    role: 'SSOMA_DHO',
    fullName: 'Esp. Víctor Cayata (DHO / SSOMA)',
    areaLabel: 'Auditoría Interna Minera Bateas (SSOMA / Médico / DHO)',
  },
  {
    username: 'garita@bateas.pe',
    password: process.env.DEMO_PASSWORD_GARITA || 'Bateas2026!',
    role: 'GARITA',
    fullName: 'Sup. Control Patrimonial Garita',
    areaLabel: 'Control de Accesos y Fotocheck PVC',
  },
];

apiRouter.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const found = DEMO_USERS.find(
    (u) =>
      u.username.toLowerCase() === String(username || '').trim().toLowerCase() &&
      u.password === String(password || '').trim()
  );

  if (!found) {
    res.status(401).json({
      success: false,
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      username: found.username,
      role: found.role,
      fullName: found.fullName,
      areaLabel: found.areaLabel,
      token: Buffer.from(`${found.username}:${found.role}:${Date.now()}`).toString('base64'),
    },
  });
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

apiRouter.post('/masters/blacklist', async (req, res) => {
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
apiRouter.get('/workers', async (_req, res) => {
  try {
    const workers = await prisma.worker.findMany({
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
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
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

apiRouter.post('/workers', async (req, res) => {
  try {
    const worker = await registerWorkerWorkflow(req.body);
    res.status(201).json({ success: true, data: worker });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

apiRouter.post('/workers/demo-preset', async (req, res) => {
  try {
    const { scenario } = req.body;
    const worker = await createDemoScenarioWorkflow(scenario);
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
apiRouter.get('/exceptions', async (req, res) => {
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

apiRouter.patch('/exceptions/:exceptionId/resolve', async (req, res) => {
  try {
    const { decision, reviewerName, reviewerComment, manualExpiryDateStr } = req.body;
    const updatedWorker = await resolveExceptionTicketWorkflow({
      exceptionId: req.params.exceptionId,
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

// 6. E-Learning Asíncrono 24/7
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
      where: { id: req.params.badgeId },
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
      where: { id: req.params.workerDocumentId },
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
