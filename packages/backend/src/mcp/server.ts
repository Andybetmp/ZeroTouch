import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import {
  createDemoScenarioWorkflow,
  processWorkerDocumentWorkflow,
  registerWorkerWorkflow,
  resolveExceptionTicketWorkflow,
  submitElearningAttemptWorkflow,
} from '../services/workflow.service.js';
import { verifyGaritaBadgeOrDni } from '../services/trafficLight.service.js';

export function createBateasMcpServer(): McpServer {
  const server = new McpServer({
    name: 'bateas-zerotouch-mcp',
    version: '1.0.0',
  });

  // TOOL 1: register_worker
  server.tool(
    'register_worker',
    'Registra un trabajador contratista en Bateas Zero-Touch, verifica automáticamente la Lista Negra y genera su matriz de documentos requeridos según App Bateas v2.1.0.',
    {
      dni: z.string().min(8).max(15).describe('Número de DNI del trabajador (8 dígitos)'),
      fullName: z.string().min(3).describe('Nombre completo del trabajador'),
      companyName: z.string().min(3).describe('Razón social de la Empresa Contratista Minera (ECM)'),
      contractorRuc: z.string().optional().describe('RUC de 11 dígitos de la ECM'),
      jobPosition: z
        .enum(['OPERARIO', 'TECNICO', 'INGENIERO', 'CONDUCTOR', 'PERSONAL_COCINA', 'OTROS'])
        .describe('Puesto del trabajador'),
      stayType: z
        .enum(['PERMANENTE_CIA', 'TEMPORAL', 'VISITA_TECNICA', 'VISITA_COMERCIAL'])
        .default('PERMANENTE_CIA')
        .describe('Tipo de estadía en App Bateas'),
      accessZone: z
        .enum(['SUPERFICIE', 'SOCAVON'])
        .default('SUPERFICIE')
        .describe('Zona de operación en la unidad minera'),
    },
    async (args) => {
      const worker = await registerWorkerWorkflow(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                message: 'Trabajador registrado y evaluado contra Lista Negra.',
                workerId: worker?.id,
                dni: worker?.dni,
                fullName: worker?.fullName,
                trafficLight: worker?.trafficLight,
                statusSummary: worker?.statusSummary,
                isBlacklisted: worker?.isBlacklisted,
                sessionCode: worker?.sessionCode,
                requirementsCount: worker?.documents.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 2: analyze_worker_document
  server.tool(
    'analyze_worker_document',
    'Procesa un documento del trabajador con el motor OCR y el motor de reglas (vigencia, DNI coincidente, legibilidad). Clasifica en VERDE (Zero-Touch), AMBAR (Bandeja de Excepciones) o ROJO (Vencido).',
    {
      workerDni: z.string().describe('DNI del trabajador registrado'),
      requirementCode: z
        .string()
        .describe('Código del requisito (DNI, SCTR, EMO_16, CV_DOC, DDJJ_DOM, FOTO, CERT_HAB, LIC_COND, CARNET_SAN)'),
      documentTextOrBase64: z
        .string()
        .describe('Texto extraído/simulado del documento o contenido PDF/imagen en Base64'),
      isBase64File: z.boolean().default(false).describe('Indica si documentTextOrBase64 es un archivo en Base64'),
      fileName: z.string().default('documento.pdf').describe('Nombre del archivo'),
    },
    async (args) => {
      const worker = await prisma.worker.findUnique({
        where: { dni: args.workerDni.trim() },
        include: { documents: { include: { requirement: true } } },
      });

      if (!worker) {
        return {
          isError: true,
          content: [{ type: 'text', text: `No existe trabajador registrado con DNI ${args.workerDni}` }],
        };
      }

      const docSlot = worker.documents.find(
        (d) => d.requirement.code.toUpperCase() === args.requirementCode.trim().toUpperCase()
      );

      if (!docSlot) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `El requisito ${args.requirementCode} no aplica para el trabajador ${worker.fullName}`,
            },
          ],
        };
      }

      const updatedWorker = await processWorkerDocumentWorkflow({
        workerId: worker.id,
        requirementId: docSlot.requirementId,
        fileName: args.fileName,
        fileBuffer: args.isBase64File ? Buffer.from(args.documentTextOrBase64, 'base64') : undefined,
        directSimulatedText: args.isBase64File ? undefined : args.documentTextOrBase64,
      });

      const updatedDoc = updatedWorker?.documents.find((d) => d.requirementId === docSlot.requirementId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                workerDni: updatedWorker?.dni,
                requirementCode: args.requirementCode,
                documentStatus: updatedDoc?.status,
                statusReason: updatedDoc?.statusReason,
                detectedDni: updatedDoc?.detectedDni,
                detectedExpiryDate: updatedDoc?.detectedExpiryDate,
                globalTrafficLight: updatedWorker?.trafficLight,
                globalStatusSummary: updatedWorker?.statusSummary,
                digitalBadgeIssued: Boolean(updatedWorker?.digitalBadge),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 3: get_worker_traffic_light
  server.tool(
    'get_worker_traffic_light',
    'Consulta el estado en tiempo real del Semáforo Operativo (VERDE/AMBAR/ROJO) de un trabajador, sus documentos, excepciones, E-Learning y Carné Digital QR.',
    {
      dni: z.string().describe('DNI del trabajador a consultar'),
    },
    async ({ dni }) => {
      const worker = await prisma.worker.findUnique({
        where: { dni: dni.trim() },
        include: {
          contractor: true,
          documents: {
            include: {
              requirement: true,
              exceptionReviews: { where: { reviewStatus: 'OPEN' } },
            },
          },
          digitalBadge: true,
        },
      });

      if (!worker) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Trabajador con DNI ${dni} no encontrado.` }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                dni: worker.dni,
                fullName: worker.fullName,
                companyName: worker.contractor.companyName,
                jobPosition: worker.jobPosition,
                stayType: worker.stayType,
                trafficLight: worker.trafficLight,
                statusSummary: worker.statusSummary,
                isBlacklisted: worker.isBlacklisted,
                elearningPassed: worker.elearningPassed,
                digitalBadge: worker.digitalBadge,
                documents: worker.documents.map((d) => ({
                  code: d.requirement.code,
                  name: d.requirement.name,
                  isMandatory: d.requirement.isMandatory,
                  requiresValidity: d.requirement.requiresValidity,
                  status: d.status,
                  statusReason: d.statusReason,
                  detectedExpiryDate: d.detectedExpiryDate,
                  openExceptionId: d.exceptionReviews[0]?.id || null,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 4: list_exception_tray
  server.tool(
    'list_exception_tray',
    'Lista los documentos en estado ÁMBAR derivados a la Bandeja de Excepciones para revisión humana por SSOMA, Área Médica o DHO.',
    {
      assignedArea: z
        .enum(['AREA_USUARIA', 'SSOMA', 'AREA_MEDICA', 'DHO'])
        .optional()
        .describe('Filtrar por área responsable'),
      status: z.enum(['OPEN', 'APPROVED', 'REJECTED']).default('OPEN').describe('Estado del ticket'),
    },
    async (args) => {
      const tickets = await prisma.exceptionReview.findMany({
        where: {
          reviewStatus: args.status,
          ...(args.assignedArea ? { assignedArea: args.assignedArea } : {}),
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              tickets.map((t) => ({
                exceptionId: t.id,
                assignedArea: t.assignedArea,
                reviewStatus: t.reviewStatus,
                reasonTriggered: t.reasonTriggered,
                workerDni: t.workerDocument.worker.dni,
                workerName: t.workerDocument.worker.fullName,
                companyName: t.workerDocument.worker.contractor.companyName,
                requirementCode: t.workerDocument.requirement.code,
                requirementName: t.workerDocument.requirement.name,
                extractedTextPreview: (t.workerDocument.extractedText || '').slice(0, 300),
              })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 5: resolve_exception_ticket
  server.tool(
    'resolve_exception_ticket',
    'Permite a un especialista de SSOMA, Área Médica o DHO aprobar o rechazar un caso de la Bandeja de Excepciones y recalcular el Semáforo Global.',
    {
      exceptionId: z.string().uuid().describe('ID del ticket en exception_reviews'),
      decision: z.enum(['APPROVED', 'REJECTED']).describe('Decisión del revisor'),
      reviewerName: z.string().min(2).describe('Nombre del especialista revisor'),
      reviewerComment: z.string().min(3).describe('Justificación técnica de la decisión'),
      manualExpiryDateStr: z
        .string()
        .optional()
        .describe('Fecha de vencimiento verificada manualmente (DD/MM/YYYY o YYYY-MM-DD)'),
    },
    async (args) => {
      const updatedWorker = await resolveExceptionTicketWorkflow(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                message: `Excepción resuelta como ${args.decision}.`,
                workerDni: updatedWorker?.dni,
                workerName: updatedWorker?.fullName,
                newGlobalTrafficLight: updatedWorker?.trafficLight,
                statusSummary: updatedWorker?.statusSummary,
                digitalBadge: updatedWorker?.digitalBadge || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 6: complete_elearning_simulation
  server.tool(
    'complete_elearning_simulation',
    'Registra la calificación del módulo E-Learning asíncrono de Seguridad y Medio Ambiente (aprueba con >= 3 de 4) y recalcula el Semáforo Global.',
    {
      dni: z.string().describe('DNI del trabajador'),
      scoreObtained: z.number().int().min(0).max(4).describe('Respuestas correctas sobre 4 preguntas'),
    },
    async ({ dni, scoreObtained }) => {
      const worker = await prisma.worker.findUnique({ where: { dni: dni.trim() } });
      if (!worker) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Trabajador con DNI ${dni} no encontrado.` }],
        };
      }
      const updated = await submitElearningAttemptWorkflow({
        workerId: worker.id,
        scoreObtained,
        totalQuestions: 4,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                workerDni: updated?.dni,
                elearningPassed: updated?.elearningPassed,
                globalTrafficLight: updated?.trafficLight,
                statusSummary: updated?.statusSummary,
                digitalBadge: updated?.digitalBadge || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // TOOL 7: verify_garita_qr (Spec 04)
  server.tool(
    'verify_garita_qr',
    'Verifica en tiempo real en Garita de Seguridad el código QR del Carné Digital o el DNI de un trabajador (comprobando firma criptográfica HMAC-SHA256, Semáforo VERDE, vigencias y estado de Fotocheck físico PVC).',
    {
      badgeCodeOrDni: z
        .string()
        .min(4)
        .describe('Código del Carné QR (ej. BZT-72458910-...) o DNI de 8 dígitos del trabajador'),
    },
    async ({ badgeCodeOrDni }) => {
      const verification = await verifyGaritaBadgeOrDni(badgeCodeOrDni);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(verification, null, 2),
          },
        ],
      };
    }
  );

  // TOOL 8: generate_demo_scenario
  server.tool(
    'generate_demo_scenario',
    'Genera un expediente demostrativo completo con PDFs sintéticos analizados por el motor OCR para cualquiera de los 4 escenarios (ZERO_TOUCH_GREEN, EXCEPTION_AMBER, EXPIRED_RED, BLACKLISTED_RED).',
    {
      scenario: z
        .enum(['ZERO_TOUCH_GREEN', 'EXCEPTION_AMBER', 'EXPIRED_RED', 'BLACKLISTED_RED'])
        .describe('Escenario a simular'),
    },
    async ({ scenario }) => {
      const worker = await createDemoScenarioWorkflow(scenario);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                scenario,
                dni: worker?.dni,
                fullName: worker?.fullName,
                trafficLight: worker?.trafficLight,
                statusSummary: worker?.statusSummary,
                digitalBadgeCode: worker?.digitalBadge?.badgeCode || null,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // RESOURCE 1: Matriz Documentos por Estadía (App Bateas v2.1.0)
  server.resource(
    'stay-type-requirements',
    'bateas://masters/requirements',
    async (uri) => {
      const reqs = await prisma.stayTypeRequirement.findMany({
        orderBy: [{ isMandatory: 'desc' }, { code: 'asc' }],
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(reqs, null, 2),
          },
        ],
      };
    }
  );

  // RESOURCE 2: Lista Negra Activa
  server.resource(
    'blacklist-entries',
    'bateas://masters/blacklist',
    async (uri) => {
      const list = await prisma.blacklistEntry.findMany({
        where: { isActive: true },
      });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(list, null, 2),
          },
        ],
      };
    }
  );

  // RESOURCE 3: KPIs Operativos Zero-Touch
  server.resource(
    'dashboard-metrics',
    'bateas://metrics/summary',
    async (uri) => {
      const [totalWorkers, greenCount, amberCount, redCount, openExceptions, totalDocs, autoGreenDocs] =
        await Promise.all([
          prisma.worker.count(),
          prisma.worker.count({ where: { trafficLight: 'VERDE' } }),
          prisma.worker.count({ where: { trafficLight: 'AMBAR' } }),
          prisma.worker.count({ where: { trafficLight: 'ROJO' } }),
          prisma.exceptionReview.count({ where: { reviewStatus: 'OPEN' } }),
          prisma.workerDocument.count({ where: { status: { not: 'PENDIENTE' } } }),
          prisma.workerDocument.count({
            where: {
              status: 'VERDE',
              statusReason: { startsWith: 'Pre-aprobado Zero-Touch' },
            },
          }),
        ]);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                totalWorkers,
                trafficLightDistribution: { VERDE: greenCount, AMBAR: amberCount, ROJO: redCount },
                openExceptionsInTray: openExceptions,
                processedDocuments: totalDocs,
                zeroTouchAutomationRatePercent:
                  totalDocs > 0 ? Math.round((autoGreenDocs / totalDocs) * 100) : 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
