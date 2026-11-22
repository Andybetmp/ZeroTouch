import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HardHat,
  Layers,
  Printer,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';

type TrafficLight = 'VERDE' | 'AMBAR' | 'ROJO';
type DocStatus = 'PENDIENTE' | 'VERDE' | 'AMBAR' | 'ROJO';

interface Requirement {
  id: string;
  code: string;
  name: string;
  stayType: string;
  applicableJob: string | null;
  isMandatory: boolean;
  requiresValidity: boolean;
  responsibleArea: string;
}

interface WorkerDocument {
  id: string;
  requirementId: string;
  fileName: string | null;
  extractedText: string | null;
  extractionMethod: string | null;
  ocrConfidence: number | null;
  detectedDni: string | null;
  detectedExpiryDate: string | null;
  status: DocStatus;
  statusReason: string;
  requirement: Requirement;
}

interface DigitalBadge {
  id: string;
  badgeCode: string;
  qrPayloadJson: string;
  signatureHash: string;
  pvcPrintStatus: 'QUEUED_GARITA' | 'PRINTED' | 'DELIVERED';
  issuedAt: string;
  validUntil: string;
}

interface Worker {
  id: string;
  dni: string;
  fullName: string;
  jobPosition: string;
  stayType: string;
  accessZone: string;
  trafficLight: TrafficLight;
  statusSummary: string;
  isBlacklisted: boolean;
  elearningPassed: boolean;
  sessionCode: string;
  contractor: {
    ruc: string;
    companyName: string;
  };
  documents: WorkerDocument[];
  digitalBadge: DigitalBadge | null;
  auditLogs: {
    id: string;
    actorArea: string;
    action: string;
    details: string;
    createdAt: string;
  }[];
}

interface ExceptionTicket {
  id: string;
  assignedArea: string;
  reviewStatus: 'OPEN' | 'APPROVED' | 'REJECTED';
  reasonTriggered: string;
  reviewerName: string | null;
  reviewerComment: string | null;
  createdAt: string;
  workerDocument: WorkerDocument & {
    worker: Worker;
  };
}

interface QuizQuestion {
  id: string;
  category: string;
  questionText: string;
  options: string[];
  correctIndex: number;
}

export default function App() {
  const [activePortal, setActivePortal] = useState<'CONTRACTOR' | 'REVIEWER' | 'GARITA'>('CONTRACTOR');
  const [contractorTab, setContractorTab] = useState<'EXPEDIENTE' | 'REGISTRO' | 'ELEARNING'>('EXPEDIENTE');
  const [reviewerTab, setReviewerTab] = useState<'EXCEPCIONES' | 'SEMAFORO' | 'MAESTROS'>('EXCEPCIONES');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [metrics, setMetrics] = useState<any>(null);
  const [exceptions, setExceptions] = useState<ExceptionTicket[]>([]);
  const [requirementsMaster, setRequirementsMaster] = useState<Requirement[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Registro de nuevo trabajador
  const [regForm, setRegForm] = useState({
    dni: '',
    fullName: '',
    companyName: 'CONSORCIO MINERO CAYLLOMA S.A.C.',
    jobPosition: 'OPERARIO',
    stayType: 'PERMANENTE_CIA',
    accessZone: 'SOCAVON',
  });

  // Filtros Bandeja de Excepciones
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [resolveForm, setResolveForm] = useState<{
    [id: string]: { reviewerName: string; comment: string; manualDate: string };
  }>({});

  // Estado E-Learning
  const [materialRead, setMaterialRead] = useState<boolean>(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [qId: string]: number }>({});

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchAllData = async (keepSelectionId?: string) => {
    try {
      const [wRes, mRes, eRes, rRes, bRes, qRes] = await Promise.all([
        fetch('/api/v1/workers').then((r) => r.json()),
        fetch('/api/v1/dashboard/metrics').then((r) => r.json()),
        fetch('/api/v1/exceptions?status=OPEN').then((r) => r.json()),
        fetch('/api/v1/masters/requirements').then((r) => r.json()),
        fetch('/api/v1/masters/blacklist').then((r) => r.json()),
        fetch('/api/v1/elearning/questions').then((r) => r.json()),
      ]);

      if (wRes.success) {
        setWorkers(wRes.data);
        if (keepSelectionId) {
          setSelectedWorkerId(keepSelectionId);
        } else if (!selectedWorkerId && wRes.data.length > 0) {
          setSelectedWorkerId(wRes.data[0].id);
        }
      }
      if (mRes.success) setMetrics(mRes.data);
      if (eRes.success) setExceptions(eRes.data);
      if (rRes.success) setRequirementsMaster(rRes.data);
      if (bRes.success) setBlacklist(bRes.data);
      if (qRes.success) setQuestions(qRes.data);
    } catch (err: any) {
      showNotice('error', `Error conectando con el backend Node.js/PostgreSQL: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0] || null;

  const handleCreateDemoScenario = async (
    scenario: 'ZERO_TOUCH_GREEN' | 'EXCEPTION_AMBER' | 'EXPIRED_RED' | 'BLACKLISTED_RED'
  ) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/workers/demo-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(res.data.id);
        showNotice(
          'success',
          `Escenario ${scenario} procesado con motor OCR en PostgreSQL (${res.data.fullName} -> Semáforo ${res.data.trafficLight}).`
        );
      } else {
        showNotice('error', res.error || 'Error creando escenario');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.dni.trim() || !regForm.fullName.trim()) {
      showNotice('error', 'Completa el DNI y el Nombre del trabajador.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(res.data.id);
        setContractorTab('EXPEDIENTE');
        setRegForm({ ...regForm, dni: '', fullName: '' });
        if (res.data.isBlacklisted) {
          showNotice('error', `ALERTA LISTA NEGRA: El DNI ${res.data.dni} tiene restricción activa.`);
        } else {
          showNotice('success', `Trabajador registrado con éxito. Checklist generado.`);
        }
      } else {
        showNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (workerId: string, requirementId: string, file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/workers/${workerId}/documents/${requirementId}/upload`, {
        method: 'POST',
        body: formData,
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(workerId);
        showNotice('success', `Documento ${file.name} analizado por el motor OCR y evaluado.`);
      } else {
        showNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickOcrSimulate = async (
    worker: Worker,
    doc: WorkerDocument,
    mode: 'VALID' | 'EXPIRED' | 'UNCERTAIN'
  ) => {
    setLoading(true);
    try {
      const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('es-PE');
      const past = '10/01/2024';

      let simulatedText = `MINERA BATEAS S.A.C. - CERTIFICADO OFICIAL\nDocumento: ${doc.requirement.name}\nTrabajador: ${worker.fullName}\nDNI: ${worker.dni}\n`;
      if (mode === 'VALID') {
        simulatedText += `Fecha de vencimiento: ${future}\nEstado: APTO / VIGENTE`;
      } else if (mode === 'EXPIRED') {
        simulatedText += `Fecha de vencimiento: ${past}\nEstado: EXPIRADO`;
      } else {
        simulatedText = `ESCANEADO BORROSO - SIN FECHA LEGIBLE\nTrabajador: ${worker.fullName}\nDNI: ${worker.dni}`;
      }

      const res = await fetch(`/api/v1/workers/${worker.id}/documents/${doc.requirementId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `${doc.requirement.code}_${mode}.pdf`,
          simulatedText,
        }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(worker.id);
        showNotice('info', `Simulación OCR (${mode}) ejecutada para ${doc.requirement.name}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolveException = async (exceptionId: string, decision: 'APPROVED' | 'REJECTED') => {
    const formState = resolveForm[exceptionId] || {
      reviewerName: 'Esp. Víctor Cayata (DHO/SSOMA)',
      comment: '',
      manualDate: '',
    };

    if (!formState.comment.trim()) {
      showNotice('error', 'Ingresa un comentario o justificación técnica para la auditoría.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/exceptions/${exceptionId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerName: formState.reviewerName || 'Esp. Revisor Bateas',
          reviewerComment: formState.comment,
          manualExpiryDateStr: formState.manualDate || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(res.data.id);
        showNotice(
          'success',
          `Excepción resuelta (${decision}). Semáforo de ${res.data.fullName}: ${res.data.trafficLight}.`
        );
      } else {
        showNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) return;

    if (Object.keys(quizAnswers).length < questions.length) {
      showNotice('error', 'Responde todas las preguntas de la evaluación teórica.');
      return;
    }

    let score = 0;
    questions.forEach((q) => {
      if (quizAnswers[q.id] === q.correctIndex) score += 1;
    });

    setLoading(true);
    try {
      const res = await fetch('/api/v1/elearning/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          scoreObtained: score,
          totalQuestions: questions.length,
        }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(selectedWorker.id);
        if (score >= 3) {
          showNotice(
            'success',
            `¡Evaluación aprobada (${score}/${questions.length})! Semáforo actualizado a ${res.data.trafficLight}.`
          );
        } else {
          showNotice(
            'error',
            `Obtuviste ${score}/${questions.length}. Se requiere mínimo 3/4 (75%) para aprobar.`
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePvcStatus = async (badgeId: string, pvcPrintStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/badges/${badgeId}/pvc-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pvcPrintStatus }),
      }).then((r) => r.json());
      if (res.success) {
        await fetchAllData(selectedWorker?.id);
        showNotice('success', `Estado de Fotocheck físico PVC actualizado a ${pvcPrintStatus}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderTrafficBadge = (status: TrafficLight | DocStatus) => {
    if (status === 'VERDE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" /> VERDE (Conforme)
        </span>
      );
    }
    if (status === 'ROJO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <XCircle className="w-3.5 h-3.5" /> ROJO (Observado / Bloqueado)
        </span>
      );
    }
    if (status === 'AMBAR') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <AlertTriangle className="w-3.5 h-3.5" /> ÁMBAR (En Revisión / Excepción)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">
        <Clock className="w-3.5 h-3.5" /> PENDIENTE
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* BARRA SUPERIOR CORPORATIVA ESTILO APP BATEAS v2.1.0 */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-xl shadow">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-tight">App Bateas v2.1.0 · Bateas Zero-Touch</h1>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                  MCP + PostgreSQL Activo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Equipo MYOPIA · Habilitación de Contratistas Permanentes en &lt; 48 Horas (Gestión por Excepciones)
              </p>
            </div>
          </div>

          {/* SELECTOR DE PORTAL */}
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActivePortal('CONTRACTOR')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activePortal === 'CONTRACTOR'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <HardHat className="w-4 h-4" /> 1. Portal ECM / Trabajador
            </button>
            <button
              onClick={() => setActivePortal('REVIEWER')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activePortal === 'REVIEWER'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> 2. Bandeja Excepciones (SSOMA/DHO)
              {metrics?.openExceptions > 0 && (
                <span className="bg-rose-600 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                  {metrics.openExceptions}
                </span>
              )}
            </button>
            <button
              onClick={() => setActivePortal('GARITA')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
                activePortal === 'GARITA'
                  ? 'bg-sky-400 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" /> 3. Carné QR & Garita PVC
            </button>
          </div>
        </div>
      </header>

      {/* NOTIFICACIÓN FLOTANTE */}
      {toast && (
        <div className="max-w-7xl mx-auto px-4 mt-3 w-full">
          <div
            className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-between shadow-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-sky-50 border-sky-300 text-sky-900'
            }`}
          >
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} className="text-xs underline ml-4">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE KPIs GLOBALES ZERO-TOUCH */}
      {metrics && (
        <section className="max-w-7xl mx-auto px-4 mt-4 w-full">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Expedientes Activos</p>
              <p className="text-2xl font-black text-slate-800 mt-0.5">{metrics.totalWorkers}</p>
              <p className="text-[11px] text-slate-500">PostgreSQL Transaccional</p>
            </div>
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-emerald-700">Semáforo VERDE</p>
              <p className="text-2xl font-black text-emerald-700 mt-0.5">{metrics.greenCount}</p>
              <p className="text-[11px] text-emerald-600">Habilitados Zero-Touch (&lt;48h)</p>
            </div>
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-200 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-amber-700">Semáforo ÁMBAR</p>
              <p className="text-2xl font-black text-amber-700 mt-0.5">{metrics.amberCount}</p>
              <p className="text-[11px] text-amber-600">En Excepción / En Proceso</p>
            </div>
            <div className="bg-rose-50/70 p-3.5 rounded-xl border border-rose-200 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-rose-700">Semáforo ROJO</p>
              <p className="text-2xl font-black text-rose-700 mt-0.5">{metrics.redCount}</p>
              <p className="text-[11px] text-rose-600">Vencidos o Lista Negra</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Tasa Zero-Touch OCR</p>
              <p className="text-2xl font-black text-indigo-600 mt-0.5">{metrics.automationRatePercent}%</p>
              <p className="text-[11px] text-slate-500">Docs aprobados sin humanos</p>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-semibold uppercase text-slate-400">Bandeja Excepciones</p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{metrics.openExceptions}</p>
              <p className="text-[11px] text-slate-500">Tickets abiertos SSOMA/DHO</p>
            </div>
          </div>
        </section>
      )}

      {/* GENERADOR DE ESCENARIOS DEMO EN 1 CLIC */}
      <section className="max-w-7xl mx-auto px-4 mt-4 w-full">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Simulador Instantáneo de Casos Reales (PDF + OCR + Reglas + Semáforo)
              </h2>
              <p className="text-xs text-slate-300">
                Genera PDFs reales en memoria y ejecútalos por el pipeline OCR y el motor de reglas en PostgreSQL:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('ZERO_TOUCH_GREEN')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              🟢 Caso 1: 100% Zero-Touch (Verde + QR)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('EXCEPTION_AMBER')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              🟡 Caso 2: EMO sin fecha (Va a Bandeja Excepciones)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('EXPIRED_RED')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white transition cursor-pointer disabled:opacity-50"
            >
              🔴 Caso 3: SCTR Vencido (Rojo Directo)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('BLACKLISTED_RED')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-rose-300 border border-rose-500/40 transition cursor-pointer disabled:opacity-50"
            >
              ⛔ Caso 4: Cruce Lista Negra
            </button>
          </div>
        </div>
      </section>

      {/* CONTENIDO PRINCIPAL SEGÚN PORTAL */}
      <main className="max-w-7xl mx-auto px-4 py-5 w-full flex-1">
        {activePortal === 'CONTRACTOR' && (
          <div className="space-y-5">
            {/* Sub-navegación Contratista */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContractorTab('EXPEDIENTE')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    contractorTab === 'EXPEDIENTE'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileCheck className="w-4 h-4" /> Checklist OCR & Semáforo del Trabajador
                </button>
                <button
                  onClick={() => setContractorTab('ELEARNING')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    contractorTab === 'ELEARNING'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Aula E-Learning Asíncrono 24/7
                </button>
                <button
                  onClick={() => setContractorTab('REGISTRO')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    contractorTab === 'REGISTRO'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> + Afiliar Nuevo Trabajador
                </button>
              </div>

              {/* Selector de Trabajador */}
              {workers.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Expediente activo:</span>
                  <select
                    value={selectedWorker?.id || ''}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        [{w.trafficLight}] {w.dni} — {w.fullName} ({w.jobPosition})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {contractorTab === 'REGISTRO' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs max-w-2xl">
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  Afiliación de Trabajador Contratista (App Bateas v2.1.0)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Al registrar al colaborador, el Motor de Reglas verifica automáticamente la Lista Negra y genera los
                  requisitos obligatorios según su Tipo de Estadía y Puesto.
                </p>
                <form onSubmit={handleRegisterWorker} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        DNI (8 dígitos — Prueba 49998887 para Lista Negra)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={regForm.dni}
                        onChange={(e) => setRegForm({ ...regForm, dni: e.target.value })}
                        placeholder="Ej. 71234567"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nombres y Apellidos</label>
                      <input
                        type="text"
                        value={regForm.fullName}
                        onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                        placeholder="Ej. JUAN PEREZ QUISPE"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Empresa Contratista Minera (ECM)
                      </label>
                      <input
                        type="text"
                        value={regForm.companyName}
                        onChange={(e) => setRegForm({ ...regForm, companyName: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Puesto (Activa reglas de perfil)
                      </label>
                      <select
                        value={regForm.jobPosition}
                        onChange={(e) => setRegForm({ ...regForm, jobPosition: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="OPERARIO">Operario (6 requisitos base)</option>
                        <option value="INGENIERO">Ingeniero (+ Certificado Habilidad CIP)</option>
                        <option value="CONDUCTOR">Conductor (+ Licencia de Conducir y Récord)</option>
                        <option value="PERSONAL_COCINA">Personal de Cocina (+ Carné de Sanidad)</option>
                        <option value="TECNICO">Técnico</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Estadía</label>
                      <select
                        value={regForm.stayType}
                        onChange={(e) => setRegForm({ ...regForm, stayType: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="PERMANENTE_CIA">PERMANENTE CIA (&gt; 30 días)</option>
                        <option value="TEMPORAL">TEMPORAL</option>
                        <option value="VISITA_TECNICA">VISITA TÉCNICA</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Zona de Acceso</label>
                      <select
                        value={regForm.accessZone}
                        onChange={(e) => setRegForm({ ...regForm, accessZone: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="SOCAVON">Socavón (Mina Subterránea)</option>
                        <option value="SUPERFICIE">Superficie / Planta</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow transition cursor-pointer"
                  >
                    Registrar y Ejecutar Cruce con Lista Negra
                  </button>
                </form>
              </div>
            )}

            {contractorTab === 'EXPEDIENTE' && selectedWorker && (
              <div className="space-y-4">
                {/* CABECERA DEL SEMÁFORO DEL TRABAJADOR */}
                <div
                  className={`p-5 rounded-xl border-2 shadow-xs flex flex-wrap items-center justify-between gap-4 ${
                    selectedWorker.trafficLight === 'VERDE'
                      ? 'bg-emerald-50/90 border-emerald-400'
                      : selectedWorker.trafficLight === 'ROJO'
                      ? 'bg-rose-50/90 border-rose-400'
                      : 'bg-amber-50/90 border-amber-400'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {renderTrafficBadge(selectedWorker.trafficLight)}
                      <span className="text-xs font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded border border-slate-200">
                        DNI: {selectedWorker.dni}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded border border-slate-200">
                        Puesto: {selectedWorker.jobPosition}
                      </span>
                      <span className="text-xs font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded border border-slate-200">
                        Estadía: {selectedWorker.stayType}
                      </span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                        Código Sesión E-Learning: {selectedWorker.sessionCode}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900">
                      {selectedWorker.fullName} —{' '}
                      <span className="font-semibold text-slate-600">{selectedWorker.contractor.companyName}</span>
                    </h2>
                    <p className="text-xs font-semibold text-slate-700">{selectedWorker.statusSummary}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedWorker.digitalBadge && (
                      <button
                        onClick={() => setActivePortal('GARITA')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" /> Ver Carné Digital QR Emitido
                      </button>
                    )}
                    {!selectedWorker.elearningPassed && !selectedWorker.isBlacklisted && (
                      <button
                        onClick={() => setContractorTab('ELEARNING')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4" /> Ir a Inducción E-Learning
                      </button>
                    )}
                  </div>
                </div>

                {/* MATRIZ DE DOCUMENTOS DEL EXPEDIENTE CON OCR */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold">
                        Requisitos Documentales por Estadía y Perfil (Motor OCR Zero-Touch)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Acoplado a las banderas de App Bateas v2.1.0: ¿Es obligatorio? y ¿Requiere vigencia? ·
                        Reemplazar un documento observado NO reinicia los documentos ya aprobados en VERDE.
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200">
                    {selectedWorker.documents.map((doc) => (
                      <div key={doc.id} className="p-4 hover:bg-slate-50/80 transition">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1.5 max-w-2xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-slate-900">{doc.requirement.name}</span>
                              {renderTrafficBadge(doc.status)}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  doc.requirement.isMandatory
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                ¿Es obligatorio?: {doc.requirement.isMandatory ? 'Sí' : 'No'}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  doc.requirement.requiresValidity
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                ¿Requiere vigencia?: {doc.requirement.requiresValidity ? 'Sí' : 'No'}
                              </span>
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                Área Excepción: {doc.requirement.responsibleArea}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600">{doc.statusReason}</p>

                            {doc.fileName && (
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                                <span className="font-medium text-slate-700">📄 Archivo: {doc.fileName}</span>
                                {doc.extractionMethod && <span>Método: {doc.extractionMethod}</span>}
                                {doc.detectedDni && <span>DNI leído: {doc.detectedDni}</span>}
                                {doc.detectedExpiryDate && (
                                  <span className="font-bold text-slate-800">
                                    Vigencia extraída: {String(doc.detectedExpiryDate).split('T')[0]}
                                  </span>
                                )}
                              </div>
                            )}

                            {doc.extractedText && (
                              <details className="text-xs mt-1">
                                <summary className="cursor-pointer text-indigo-600 font-semibold">
                                  Ver texto extraído por el motor OCR
                                </summary>
                                <pre className="mt-1.5 p-2.5 bg-slate-900 text-emerald-300 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap">
                                  {doc.extractedText}
                                </pre>
                              </details>
                            )}
                          </div>

                          {/* Controles de Carga de Archivo o Simulación OCR */}
                          {!selectedWorker.isBlacklisted && (
                            <div className="flex flex-col items-end gap-2">
                              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs transition">
                                <Upload className="w-3.5 h-3.5" /> Subir PDF / Imagen Real
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileUpload(selectedWorker.id, doc.requirementId, f);
                                  }}
                                />
                              </label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'VALID')}
                                  className="px-2 py-1 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded cursor-pointer"
                                  title="Simular documento vigente y legible"
                                >
                                  Simular OCR Vigente
                                </button>
                                {doc.requirement.requiresValidity && (
                                  <>
                                    <button
                                      onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'UNCERTAIN')}
                                      className="px-2 py-1 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded cursor-pointer"
                                      title="Simular escaneo sin fecha legible (envía a Bandeja de Excepciones)"
                                    >
                                      Simular Ámbar
                                    </button>
                                    <button
                                      onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'EXPIRED')}
                                      className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded cursor-pointer"
                                      title="Simular documento con fecha vencida"
                                    >
                                      Simular Vencido
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {contractorTab === 'ELEARNING' && selectedWorker && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase text-indigo-600">
                      Pilar 2 · Desbloqueo E-Learning Asíncrono 24/7
                    </span>
                    <h3 className="text-lg font-black text-slate-900">
                      Inducción Teórica Transversal — {selectedWorker.fullName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sesión validada con DNI: <strong>{selectedWorker.dni}</strong> · Código único de sesión:{' '}
                      <strong>{selectedWorker.sessionCode}</strong>
                    </p>
                  </div>
                  <div>
                    {selectedWorker.elearningPassed ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300">
                        <Award className="w-4 h-4" /> Inducción E-Learning Aprobada (≥ 75%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs border border-amber-300">
                        <Clock className="w-4 h-4" /> Evaluación Pendiente
                      </span>
                    )}
                  </div>
                </div>

                {/* Cápsulas de Contenido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-900 mb-1">
                      🦺 Módulo 1: Seguridad y Salud Ocupacional (SSOMA)
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Todo colaborador contratista permanente debe verificar su autorización vigente antes de ingresar
                      a zonas operativas, portar el EPP específico según el IPERC continuo y ejercer el derecho a
                      detener cualquier tarea ante condiciones subestándar de alto riesgo. En campo y garita es
                      obligatorio portar el Fotocheck físico en PVC además del Carné Digital QR.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-900 mb-1">
                      🌱 Módulo 2: Gestión Ambiental en Unidad Minera
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Todos los residuos sólidos generados durante las actividades deben segregarse inmediatamente en
                      los puntos autorizados conforme al código de colores NTP. Está estrictamente prohibido mezclar
                      residuos peligrosos con comunes o abandonar materiales en frentes de trabajo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="chk_material"
                    type="checkbox"
                    checked={materialRead || selectedWorker.elearningPassed}
                    onChange={(e) => setMaterialRead(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="chk_material" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Confirmo que he completado la revisión de los módulos teóricos obligatorios.
                  </label>
                </div>

                {/* Cuestionario */}
                {(materialRead || selectedWorker.elearningPassed) && (
                  <form onSubmit={handleSubmitQuiz} className="space-y-4 border-t border-slate-200 pt-4">
                    <h4 className="text-sm font-bold text-slate-900">
                      Evaluación Teórica Obligatoria (Mínimo 3/4 respuestas correctas para habilitar Semáforo Verde)
                    </h4>
                    <div className="space-y-4">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                          <p className="text-xs font-bold text-slate-900">
                            {idx + 1}. {q.questionText}
                          </p>
                          <div className="space-y-1.5">
                            {q.options.map((opt, optIdx) => (
                              <label
                                key={optIdx}
                                className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`question_${q.id}`}
                                  checked={quizAnswers[q.id] === optIdx}
                                  onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: optIdx })}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow cursor-pointer"
                    >
                      Calificar Evaluación y Actualizar Semáforo Operativo
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* PORTAL 2: BANDEJA DE EXCEPCIONES (SSOMA / MÉDICO / DHO) */}
        {activePortal === 'REVIEWER' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReviewerTab('EXCEPCIONES')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    reviewerTab === 'EXCEPCIONES'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" /> Bandeja de Excepciones (Solo Documentos ÁMBAR)
                </button>
                <button
                  onClick={() => setReviewerTab('SEMAFORO')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    reviewerTab === 'SEMAFORO'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-4 h-4" /> Panel General Semáforo Operativo
                </button>
                <button
                  onClick={() => setReviewerTab('MAESTROS')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    reviewerTab === 'MAESTROS'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" /> Tabla Maestra App Bateas & Lista Negra
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Filtrar área revisora:</span>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5"
                >
                  <option value="ALL">Todas las áreas (SSOMA / Médico / DHO)</option>
                  <option value="SSOMA">SSOMA</option>
                  <option value="AREA_MEDICA">Área Médica</option>
                  <option value="DHO">DHO</option>
                  <option value="AREA_USUARIA">Área Usuaria</option>
                </select>
              </div>
            </div>

            {reviewerTab === 'EXCEPCIONES' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900">
                    <strong>Principio de Gestión por Excepciones (Bateas Zero-Touch):</strong> Los documentos
                    conformes se pre-aprueban automáticamente en <strong>VERDE</strong> sin pasar por esta bandeja.
                    Aquí únicamente llegan los documentos clasificados en <strong>ÁMBAR</strong> (por incertidumbre
                    OCR, fecha no detectada o discrepancia de DNI), reduciendo en un 80% la carga operativa de SSOMA,
                    Área Médica y DHO.
                  </div>
                </div>

                {exceptions.filter((ex) => areaFilter === 'ALL' || ex.assignedArea === areaFilter).length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Bandeja de Excepciones Limpia (0 tickets pendientes)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Puedes pulsar arriba en &ldquo;🟡 Caso 2: EMO sin fecha&rdquo; para simular una excepción real.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {exceptions
                      .filter((ex) => areaFilter === 'ALL' || ex.assignedArea === areaFilter)
                      .map((ticket) => {
                        const formState = resolveForm[ticket.id] || {
                          reviewerName: `Especialista ${ticket.assignedArea}`,
                          comment: 'Verificado manualmente conforme a documento original.',
                          manualDate: '31/12/2026',
                        };
                        return (
                          <div
                            key={ticket.id}
                            className="bg-white p-5 rounded-xl border-2 border-amber-300 shadow-xs space-y-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                    Área Responsable: {ticket.assignedArea}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500">
                                    Trabajador: {ticket.workerDocument.worker.fullName} (DNI:{' '}
                                    {ticket.workerDocument.worker.dni})
                                  </span>
                                </div>
                                <h4 className="text-base font-black text-slate-900 mt-1">
                                  {ticket.workerDocument.requirement.name}
                                </h4>
                                <p className="text-xs font-semibold text-amber-800 mt-0.5">
                                  Motivo de Excepción: {ticket.reasonTriggered}
                                </p>
                              </div>
                            </div>

                            {ticket.workerDocument.extractedText && (
                              <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                                {ticket.workerDocument.extractedText}
                              </pre>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Especialista Revisor ({ticket.assignedArea})
                                </label>
                                <input
                                  type="text"
                                  value={formState.reviewerName}
                                  onChange={(e) =>
                                    setResolveForm({
                                      ...resolveForm,
                                      [ticket.id]: { ...formState, reviewerName: e.target.value },
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Fecha de Vigencia Validada Manualmente (DD/MM/YYYY)
                                </label>
                                <input
                                  type="text"
                                  value={formState.manualDate}
                                  onChange={(e) =>
                                    setResolveForm({
                                      ...resolveForm,
                                      [ticket.id]: { ...formState, manualDate: e.target.value },
                                    })
                                  }
                                  placeholder="31/12/2026"
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                  Dictamen / Observación de Auditoría
                                </label>
                                <input
                                  type="text"
                                  value={formState.comment}
                                  onChange={(e) =>
                                    setResolveForm({
                                      ...resolveForm,
                                      [ticket.id]: { ...formState, comment: e.target.value },
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                disabled={loading}
                                onClick={() => handleResolveException(ticket.id, 'APPROVED')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                              >
                                ✅ Aprobar Excepción (Pasa a VERDE y recalcula Semáforo)
                              </button>
                              <button
                                disabled={loading}
                                onClick={() => handleResolveException(ticket.id, 'REJECTED')}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow cursor-pointer"
                              >
                                ❌ Observar / Rechazar (Pasa a ROJO para recarga por ECM)
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {reviewerTab === 'SEMAFORO' && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-900 text-white">
                  <h3 className="text-sm font-bold">
                    Consolidado del Semáforo Operativo de Habilitación en Tiempo Real
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                        <th className="p-3 font-bold">Semáforo</th>
                        <th className="p-3 font-bold">DNI / Trabajador</th>
                        <th className="p-3 font-bold">Empresa Contratista (ECM)</th>
                        <th className="p-3 font-bold">Puesto / Estadía</th>
                        <th className="p-3 font-bold">Docs VERDE</th>
                        <th className="p-3 font-bold">E-Learning</th>
                        <th className="p-3 font-bold">Carné QR</th>
                        <th className="p-3 font-bold">Diagnóstico del Sistema</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {workers.map((w) => {
                        const mandatory = w.documents.filter((d) => d.requirement.isMandatory);
                        const greenDocs = mandatory.filter((d) => d.status === 'VERDE').length;
                        return (
                          <tr key={w.id} className="hover:bg-slate-50">
                            <td className="p-3">{renderTrafficBadge(w.trafficLight)}</td>
                            <td className="p-3 font-bold text-slate-900">
                              {w.dni} — {w.fullName}
                            </td>
                            <td className="p-3 text-slate-600">{w.contractor.companyName}</td>
                            <td className="p-3 text-slate-600">
                              {w.jobPosition} · {w.stayType}
                            </td>
                            <td className="p-3 font-bold">
                              {greenDocs}/{mandatory.length}
                            </td>
                            <td className="p-3">
                              {w.elearningPassed ? (
                                <span className="text-emerald-700 font-bold">Aprobado</span>
                              ) : (
                                <span className="text-amber-700 font-semibold">Pendiente</span>
                              )}
                            </td>
                            <td className="p-3">
                              {w.digitalBadge ? (
                                <span className="text-emerald-700 font-bold">{w.digitalBadge.badgeCode}</span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="p-3 text-slate-600 max-w-xs">{w.statusSummary}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reviewerTab === 'MAESTROS' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Tabla Maestra Documentos por Estadía (Figura 3 Entregable 3) */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3 bg-slate-900 text-white">
                    <h3 className="text-sm font-bold">
                      Tabla Maestra: Documentos por Estadía (App Bateas v2.1.0 — Entregable 3, Fig. 3)
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                          <th className="p-2.5 font-bold">Tipo de Estadía</th>
                          <th className="p-2.5 font-bold">Descripción</th>
                          <th className="p-2.5 font-bold">Perfil</th>
                          <th className="p-2.5 font-bold">¿Es obligatorio?</th>
                          <th className="p-2.5 font-bold">¿Requiere vigencia?</th>
                          <th className="p-2.5 font-bold">Área Excepción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {requirementsMaster.map((r) => (
                          <tr key={r.id}>
                            <td className="p-2.5 font-semibold text-slate-600">{r.stayType}</td>
                            <td className="p-2.5 font-bold text-slate-900">{r.name}</td>
                            <td className="p-2.5 text-slate-500">{r.applicableJob || 'TODOS'}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  r.isMandatory ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950'
                                }`}
                              >
                                {r.isMandatory ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  r.requiresValidity ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-950'
                                }`}
                              >
                                {r.requiresValidity ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="p-2.5 font-semibold text-slate-700">{r.responsibleArea}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabla Lista Negra */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3 bg-rose-950 text-white">
                    <h3 className="text-sm font-bold">Módulo Lista Negra (Restricciones DHO)</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {blacklist.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-rose-900">DNI: {b.dni}</span>
                          <span className="text-[10px] font-bold bg-rose-200 text-rose-900 px-2 py-0.5 rounded">
                            BLOQUEO ACTIVO
                          </span>
                        </div>
                        <p className="font-bold text-slate-800">{b.fullName}</p>
                        <p className="text-slate-600">{b.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PORTAL 3: CARNÉ DIGITAL QR & COLA DE IMPRESIÓN FOTOCHECK PVC EN GARITA */}
        {activePortal === 'GARITA' && (
          <div className="space-y-5">
            <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl text-xs text-sky-950">
              <strong>Validación Operativa con DHO (Entregables 2 y 3):</strong> El Semáforo <strong>VERDE</strong>{' '}
              emite automáticamente el <strong>Carné Digital con Código QR</strong> integrado en App Bateas y lo
              vincula con la orden de impresión del <strong>Fotocheck físico en PVC</strong> en garita (indispensable
              porque los trabajadores en socavón y planta utilizan guantes de seguridad y no pueden manipular celulares
              en los puntos de control).
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {workers
                .filter((w) => w.digitalBadge !== null)
                .map((w) => {
                  const badge = w.digitalBadge!;
                  return (
                    <div
                      key={badge.id}
                      className="bg-white rounded-2xl border-2 border-emerald-400 shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-emerald-400">
                            MINERA BATEAS S.A.C. · CARNÉ DIGITAL
                          </p>
                          <h4 className="text-sm font-black">{w.fullName}</h4>
                          <p className="text-xs text-slate-300">
                            DNI: {w.dni} · {w.jobPosition}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                          HABILITADO
                        </span>
                      </div>

                      <div className="p-5 flex flex-col items-center text-center space-y-3">
                        <div className="p-3 bg-white border-2 border-slate-200 rounded-xl shadow-xs">
                          <QRCodeSVG value={badge.qrPayloadJson} size={156} level="M" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800">{badge.badgeCode}</p>
                          <p className="text-[11px] font-semibold text-slate-500">{w.contractor.companyName}</p>
                          <p className="text-[11px] font-bold text-emerald-700">
                            Zona Autorizada: {w.accessZone} · Vigente hasta: {String(badge.validUntil).split('T')[0]}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                        <div className="text-xs">
                          <span className="text-slate-500 block text-[10px] font-bold uppercase">
                            Estado Fotocheck Físico PVC:
                          </span>
                          <span className="font-black text-slate-800">{badge.pvcPrintStatus}</span>
                        </div>
                        {badge.pvcPrintStatus === 'QUEUED_GARITA' ? (
                          <button
                            onClick={() => handleUpdatePvcStatus(badge.id, 'PRINTED')}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" /> Imprimir PVC en Garita
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> PVC Impreso
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-500">
        Bateas Zero-Touch (Equipo MYOPIA) · Stack SDD: React 19 + Node.js/TypeScript + Servidor MCP + Prisma ORM +
        PostgreSQL
      </footer>
    </div>
  );
}
