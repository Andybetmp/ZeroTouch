import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Bus,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  HardHat,
  Home,
  IdCard,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  UserCircle2,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';

type TrafficLight = 'VERDE' | 'AMBAR' | 'ROJO';
type DocStatus = 'PENDIENTE' | 'VERDE' | 'AMBAR' | 'ROJO';

type NavSection =
  | 'INICIO_ACCESO_DIRECTO'
  | 'INICIO_PANEL_CONTROL'
  | 'AFILIACION_AFILIADOS'
  | 'AFILIACION_EXCEPCIONES'
  | 'AFILIACION_ELEARNING'
  | 'AFILIACION_DOCS_ESTADIA'
  | 'AFILIACION_LISTA_NEGRA'
  | 'ACCESOS_CARNET_QR';

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
  const [activeNav, setActiveNav] = useState<NavSection>('INICIO_ACCESO_DIRECTO');
  const [afiliacionesOpen, setAfiliacionesOpen] = useState<boolean>(true);
  const [activeRoleLabel, setActiveRoleLabel] = useState<'ADMIN_ECM' | 'SSOMA_DHO' | 'GARITA'>('ADMIN_ECM');

  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [metrics, setMetrics] = useState<any>(null);
  const [exceptions, setExceptions] = useState<ExceptionTicket[]>([]);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string>('');
  const [requirementsMaster, setRequirementsMaster] = useState<Requirement[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Buscadores y filtros web
  const [workerSearch, setWorkerSearch] = useState<string>('');
  const [trafficFilter, setTrafficFilter] = useState<'ALL' | TrafficLight>('ALL');
  const [estadiaSearch, setEstadiaSearch] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');

  // Modal de Nuevo Afiliado
  const [showNewWorkerModal, setShowNewWorkerModal] = useState<boolean>(false);
  const [regForm, setRegForm] = useState({
    dni: '',
    fullName: '',
    companyName: 'CONSORCIO MINERO CAYLLOMA S.A.C.',
    jobPosition: 'OPERARIO',
    stayType: 'PERMANENTE_CIA',
    accessZone: 'SOCAVON',
  });

  // Formulario Lista Negra
  const [newBlacklist, setNewBlacklist] = useState({ dni: '', fullName: '', reason: '' });

  // Estado para resolución en Bandeja de Excepciones Split-Screen
  const [resolveForm, setResolveForm] = useState<{
    [id: string]: { reviewerName: string; comment: string; manualDate: string };
  }>({});

  // Estado E-Learning Web
  const [materialRead, setMaterialRead] = useState<boolean>(false);
  const [quizAnswers, setQuizAnswers] = useState<{ [qId: string]: number }>({});

  // Modal de inspección de texto OCR
  const [inspectedDoc, setInspectedDoc] = useState<WorkerDocument | null>(null);

  // Estado del Copiloto IA (Gemini + MCP Context)
  const [showCopilot, setShowCopilot] = useState<boolean>(false);
  const [copilotInput, setCopilotInput] = useState<string>('');
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<
    { role: 'user' | 'ai'; text: string; model?: string }[]
  >([
    {
      role: 'ai',
      text: '¡Hola! Soy el Copiloto IA de Bateas Zero-Touch conectado a Supabase PostgreSQL y al Servidor MCP. Puedes preguntarme por el estado del Semáforo de cualquier trabajador, documentos en Bandeja de Excepciones o alertas de Lista Negra.',
      model: 'gemini-3.1-flash-lite',
    },
  ]);
  const [aiAuditSuggestion, setAiAuditSuggestion] = useState<{
    [docId: string]: { summaryReason: string; detectedExpiryDate: string | null; modelUsed: string };
  }>({});

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5500);
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
      if (eRes.success) {
        setExceptions(eRes.data);
        if (eRes.data.length > 0 && !selectedExceptionId) {
          setSelectedExceptionId(eRes.data[0].id);
        }
      }
      if (rRes.success) setRequirementsMaster(rRes.data);
      if (bRes.success) setBlacklist(bRes.data);
      if (qRes.success) setQuestions(qRes.data);
    } catch (err: any) {
      showNotice('error', `Error de conexión con API Node.js / Supabase: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0] || null;

  const filteredWorkers = workers.filter((w) => {
    const matchTraffic = trafficFilter === 'ALL' || w.trafficLight === trafficFilter;
    const q = workerSearch.trim().toLowerCase();
    const matchQuery =
      !q ||
      w.dni.toLowerCase().includes(q) ||
      w.fullName.toLowerCase().includes(q) ||
      w.contractor.companyName.toLowerCase().includes(q);
    return matchTraffic && matchQuery;
  });

  const filteredExceptions = exceptions.filter(
    (ex) => areaFilter === 'ALL' || ex.assignedArea === areaFilter
  );

  const activeException =
    filteredExceptions.find((e) => e.id === selectedExceptionId) || filteredExceptions[0] || null;

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
        setActiveNav('AFILIACION_AFILIADOS');
        showNotice(
          'success',
          `Expediente generado y analizado por OCR: ${res.data.fullName} (Semáforo: ${res.data.trafficLight})`
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
        setShowNewWorkerModal(false);
        setActiveNav('AFILIACION_AFILIADOS');
        setRegForm({ ...regForm, dni: '', fullName: '' });
        if (res.data.isBlacklisted) {
          showNotice('error', `BLOQUEO AUTOMÁTICO: El DNI ${res.data.dni} figura en la Lista Negra de Minera Bateas.`);
        } else {
          showNotice('success', `Trabajador afiliado. Checklist dinámico creado según App Bateas v2.1.0.`);
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
        showNotice('success', `Archivo "${file.name}" procesado por el motor OCR en < 2s.`);
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

      let simulatedText = `MINERA BATEAS S.A.C. - EXPEDIENTE DE AFILIACION\nDocumento: ${doc.requirement.name}\nTrabajador: ${worker.fullName}\nDNI: ${worker.dni}\nEmpresa: ${worker.contractor.companyName}\n`;
      if (mode === 'VALID') {
        simulatedText += `Fecha de vencimiento: ${future}\nDictamen: VIGENTE / CONFORME`;
      } else if (mode === 'EXPIRED') {
        simulatedText += `Fecha de vencimiento: ${past}\nDictamen: VENCIDO`;
      } else {
        simulatedText = `DOCUMENTO ESCANEADO CON SELLO SOBRE FECHA\nTrabajador: ${worker.fullName}\nDNI: ${worker.dni}\nVigencia: [ILEGIBLE - REQUIERE REVISION HUMANA]`;
      }

      const res = await fetch(`/api/v1/workers/${worker.id}/documents/${doc.requirementId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `${doc.requirement.code}_${worker.dni}_${mode}.pdf`,
          simulatedText,
        }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(worker.id);
        showNotice('info', `Pre-validación OCR ejecutada en "${doc.requirement.name}" (${mode}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolveException = async (exceptionId: string, decision: 'APPROVED' | 'REJECTED') => {
    const formState = resolveForm[exceptionId] || {
      reviewerName: 'Víctor Cayata (Especialista DHO / SSOMA)',
      comment: 'Validado manualmente en bandeja de excepciones.',
      manualDate: '31/12/2026',
    };

    if (!formState.comment.trim()) {
      showNotice('error', 'Debe registrar un comentario de auditoría para resolver la excepción.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/v1/exceptions/${exceptionId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewerName: formState.reviewerName || 'Especialista Bateas',
          reviewerComment: formState.comment,
          manualExpiryDateStr: formState.manualDate || undefined,
        }),
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(res.data.id);
        showNotice(
          'success',
          `Ticket resuelto (${decision}). Semáforo de ${res.data.fullName} actualizado a ${res.data.trafficLight}.`
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
      showNotice('error', 'Responde las 4 preguntas antes de enviar la evaluación.');
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
            `Evaluación aprobada (${score}/${questions.length}). Semáforo Global: ${res.data.trafficLight}.`
          );
        } else {
          showNotice('error', `Puntaje: ${score}/${questions.length}. Se requiere mínimo 3/4 (75%) para aprobar.`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlacklist.dni.trim() || !newBlacklist.fullName.trim() || !newBlacklist.reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/masters/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlacklist),
      }).then((r) => r.json());
      if (res.success) {
        setNewBlacklist({ dni: '', fullName: '', reason: '' });
        await fetchAllData(selectedWorker?.id);
        showNotice('success', `DNI ${res.data.dni} incorporado a la Lista Negra en Supabase.`);
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
        showNotice('success', `Orden de Fotocheck físico en PVC actualizada a ${pvcPrintStatus}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAskCopilot = async (customQuestion?: string) => {
    const q = (customQuestion ?? copilotInput).trim();
    if (!q) return;
    setCopilotMessages((prev) => [...prev, { role: 'user', text: q }]);
    if (!customQuestion) setCopilotInput('');
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/v1/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      }).then((r) => r.json());

      if (res.success) {
        setCopilotMessages((prev) => [
          ...prev,
          { role: 'ai', text: res.data.answer, model: res.data.modelUsed },
        ]);
      } else {
        setCopilotMessages((prev) => [
          ...prev,
          { role: 'ai', text: `Error IA: ${res.error}` },
        ]);
      }
    } catch (err: any) {
      setCopilotMessages((prev) => [
        ...prev,
        { role: 'ai', text: `Error de red con Copiloto IA: ${err.message}` },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleRunGeminiDocAudit = async (docId: string, exceptionId?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/ai/audit-document/${docId}`, {
        method: 'POST',
      }).then((r) => r.json());

      if (res.success) {
        setAiAuditSuggestion((prev) => ({
          ...prev,
          [docId]: res.data,
        }));
        if (exceptionId) {
          setResolveForm((prev) => ({
            ...prev,
            [exceptionId]: {
              reviewerName: prev[exceptionId]?.reviewerName || 'Auditor Asistido por Gemini IA',
              comment: `[Dictamen IA ${res.data.modelUsed}]: ${res.data.summaryReason}`,
              manualDate: res.data.detectedExpiryDate || prev[exceptionId]?.manualDate || '31/12/2026',
            },
          }));
        }
        showNotice('success', `Auditoría Gemini IA (${res.data.modelUsed}) completada.`);
      } else {
        showNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderTrafficPill = (status: TrafficLight | DocStatus, size: 'sm' | 'md' = 'sm') => {
    const base = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';
    if (status === 'VERDE') {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold bg-emerald-500 text-white shadow-2xs ${base}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> VERDE
        </span>
      );
    }
    if (status === 'ROJO') {
      return (
        <span className={`inline-flex items-center gap-1 rounded font-bold bg-rose-600 text-white shadow-2xs ${base}`}>
          <XCircle className="w-3.5 h-3.5" /> ROJO
        </span>
      );
    }
    if (status === 'AMBAR') {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded font-bold bg-amber-400 text-slate-950 shadow-2xs ${base}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> ÁMBAR
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded font-semibold bg-slate-200 text-slate-700 ${base}`}>
        <Clock className="w-3.5 h-3.5" /> PENDIENTE
      </span>
    );
  };

  const getBreadcrumb = () => {
    switch (activeNav) {
      case 'INICIO_ACCESO_DIRECTO':
        return 'Inicio / Sistema de Recursos Humanos / Acceso directo';
      case 'INICIO_PANEL_CONTROL':
        return 'Inicio / Sistema de Recursos Humanos / Panel de control';
      case 'AFILIACION_AFILIADOS':
        return 'Inicio / Afiliación / Afiliados y Pre-validación OCR Zero-Touch';
      case 'AFILIACION_EXCEPCIONES':
        return 'Inicio / Afiliación / Bandeja de Excepciones (SSOMA · Área Médica · DHO)';
      case 'AFILIACION_ELEARNING':
        return 'Inicio / Afiliación / Inducciones Teóricas Asíncronas (E-Learning Web)';
      case 'AFILIACION_DOCS_ESTADIA':
        return 'Inicio / Afiliación / Documentos por estadía';
      case 'AFILIACION_LISTA_NEGRA':
        return 'Inicio / Afiliación / Lista negra';
      case 'ACCESOS_CARNET_QR':
        return 'Inicio / Control de accesos / Carné Digital QR y Fotocheck PVC';
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f0f3f7] text-slate-800 font-sans">
      {/* ==========================================================================
          SIDEBAR IZQUIERDO CORPORATIVO — RÉPLICA EXACTA DE APP BATEAS v2.1.0
      ========================================================================== */}
      <aside className="w-64 bg-[#222d32] text-slate-300 flex flex-col shrink-0 select-none shadow-xl">
        {/* Brand Header */}
        <div className="h-14 bg-[#1a2226] px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-white text-[#1a2226] flex items-center justify-center font-black text-sm shadow">
              B
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-wide block leading-none">App Bateas</span>
              <span className="text-[10px] text-emerald-400 font-semibold">v2.1.0 · Zero-Touch MCP</span>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
            Web
          </span>
        </div>

        {/* Menú Lateral Estilo App Bateas */}
        <nav className="flex-1 py-3 text-xs space-y-0.5 overflow-y-auto">
          <button
            onClick={() => setActiveNav('INICIO_ACCESO_DIRECTO')}
            className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
              activeNav === 'INICIO_ACCESO_DIRECTO' || activeNav === 'INICIO_PANEL_CONTROL'
                ? 'bg-[#1e282c] text-white border-l-4 border-sky-400 font-bold'
                : 'hover:bg-[#1e282c] text-slate-300'
            }`}
          >
            <Home className="w-4 h-4 text-sky-400" />
            <span>Inicio</span>
          </button>

          {/* Grupo Afiliaciones (Expandible como en Figura 3 del Entregable 3) */}
          <div>
            <button
              onClick={() => setAfiliacionesOpen(!afiliacionesOpen)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[#1e282c] text-white font-semibold transition cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                <span>Afiliaciones</span>
              </span>
              {afiliacionesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {afiliacionesOpen && (
              <div className="bg-[#2c3b41] py-1 space-y-0.5">
                <button
                  onClick={() => setActiveNav('AFILIACION_AFILIADOS')}
                  className={`w-full pl-9 pr-4 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                    activeNav === 'AFILIACION_AFILIADOS'
                      ? 'text-white font-bold bg-[#1e282c]/70 border-l-4 border-emerald-400'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>○ Afiliados (Motor OCR)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded">
                    {workers.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveNav('AFILIACION_EXCEPCIONES')}
                  className={`w-full pl-9 pr-4 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                    activeNav === 'AFILIACION_EXCEPCIONES'
                      ? 'text-white font-bold bg-[#1e282c]/70 border-l-4 border-amber-400'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>○ Bandeja Excepciones</span>
                  {metrics?.openExceptions > 0 && (
                    <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 rounded-full">
                      {metrics.openExceptions}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveNav('AFILIACION_ELEARNING')}
                  className={`w-full pl-9 pr-4 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                    activeNav === 'AFILIACION_ELEARNING'
                      ? 'text-white font-bold bg-[#1e282c]/70 border-l-4 border-indigo-400'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>○ Inducciones E-Learning</span>
                </button>

                <button
                  onClick={() => setActiveNav('AFILIACION_DOCS_ESTADIA')}
                  className={`w-full pl-9 pr-4 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                    activeNav === 'AFILIACION_DOCS_ESTADIA'
                      ? 'text-white font-bold bg-[#1e282c]/70 border-l-4 border-sky-400'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>○ Documentos por estadía</span>
                </button>

                <button
                  onClick={() => setActiveNav('AFILIACION_LISTA_NEGRA')}
                  className={`w-full pl-9 pr-4 py-2 flex items-center justify-between text-left transition cursor-pointer ${
                    activeNav === 'AFILIACION_LISTA_NEGRA'
                      ? 'text-white font-bold bg-[#1e282c]/70 border-l-4 border-rose-500'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>○ Lista negra</span>
                  <span className="text-[10px] bg-rose-500/30 text-rose-300 px-1.5 rounded">{blacklist.length}</span>
                </button>
              </div>
            )}
          </div>

          {/* Módulos complementarios de App Bateas */}
          <button
            onClick={() => setActiveNav('ACCESOS_CARNET_QR')}
            className={`w-full px-4 py-2.5 flex items-center justify-between transition cursor-pointer ${
              activeNav === 'ACCESOS_CARNET_QR'
                ? 'bg-[#1e282c] text-white border-l-4 border-sky-400 font-bold'
                : 'hover:bg-[#1e282c] text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span>Control de accesos / QR</span>
            </span>
            {metrics?.greenCount > 0 && (
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 rounded">{metrics.greenCount}</span>
            )}
          </button>

          <button
            onClick={() => setActiveNav('INICIO_PANEL_CONTROL')}
            className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
              activeNav === 'INICIO_PANEL_CONTROL'
                ? 'bg-[#1e282c] text-white border-l-4 border-emerald-400 font-bold'
                : 'hover:bg-[#1e282c] text-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Panel de Control (KPIs)</span>
          </button>

          <div className="pt-3 mt-3 border-t border-slate-700/60 px-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
              Módulos Nativos App Bateas
            </p>
          </div>
          <div className="px-4 py-2 flex items-center gap-2.5 text-slate-500 cursor-not-allowed">
            <Users className="w-4 h-4" /> <span>Comedores</span>
          </div>
          <div className="px-4 py-2 flex items-center gap-2.5 text-slate-500 cursor-not-allowed">
            <Bus className="w-4 h-4" /> <span>Viajes y Transporte</span>
          </div>
          <div className="px-4 py-2 flex items-center gap-2.5 text-slate-500 cursor-not-allowed">
            <Settings className="w-4 h-4" /> <span>Maestros y Flujos</span>
          </div>
        </nav>

        {/* Estado del Motor MCP / Supabase en el pie del Sidebar */}
        <div className="p-3 bg-[#1a2226] border-t border-slate-800 text-[11px] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Motor OCR + Reglas:</span>
            <span className="text-emerald-400 font-bold">Activo (&lt;2s)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Supabase PostgreSQL:</span>
            <span className="text-emerald-400 font-bold">Conectado</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Servidor MCP:</span>
            <span className="text-sky-400 font-bold">7 Tools / 3 Res</span>
          </div>
        </div>
      </aside>

      {/* ==========================================================================
          CONTENEDOR DERECHO WEB (TOPBAR + BREADCRUMB + WORKSPACE)
      ========================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER BLANCO ESTILO APP BATEAS */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <button
              onClick={() => setActiveNav('INICIO_ACCESO_DIRECTO')}
              className="hover:text-slate-900 font-semibold cursor-pointer"
            >
              Inicio
            </button>
            <span>|</span>
            <button
              onClick={() => fetchAllData(selectedWorker?.id)}
              className="hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} /> Sincronizar
              Supabase
            </button>
          </div>

          {/* Selector Rápido de Vista de Rol y Usuario */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-[11px] text-slate-500 px-2 font-semibold">Vista Web Activa:</span>
              <button
                onClick={() => {
                  setActiveRoleLabel('ADMIN_ECM');
                  setActiveNav('AFILIACION_AFILIADOS');
                }}
                className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                  activeRoleLabel === 'ADMIN_ECM'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👷 Admin ECM / Contratista
              </button>
              <button
                onClick={() => {
                  setActiveRoleLabel('SSOMA_DHO');
                  setActiveNav('AFILIACION_EXCEPCIONES');
                }}
                className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                  activeRoleLabel === 'SSOMA_DHO'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🛡️ Revisor SSOMA / Médico / DHO
              </button>
              <button
                onClick={() => {
                  setActiveRoleLabel('GARITA');
                  setActiveNav('ACCESOS_CARNET_QR');
                }}
                className={`px-2.5 py-1 rounded font-bold transition cursor-pointer ${
                  activeRoleLabel === 'GARITA'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚧 Garita / Carné QR
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 border-l border-slate-200 pl-4">
              <button
                onClick={() => setShowCopilot(!showCopilot)}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Copiloto Gemini IA
              </button>
            </div>
          </div>
        </header>

        {/* BARRA DE TÍTULO Y BREADCRUMB */}
        <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-normal text-slate-800 tracking-tight">Sistema de Recursos Humanos</h1>
            <p className="text-xs text-slate-500 mt-0.5">{getBreadcrumb()}</p>
          </div>

          {/* Botones 1-Clic de Simulación de Escenarios OCR Reales */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Generar Caso Demo OCR:
            </span>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('ZERO_TOUCH_GREEN')}
              className="px-2.5 py-1.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer disabled:opacity-50"
            >
              🟢 100% Zero-Touch (Verde + QR)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('EXCEPTION_AMBER')}
              className="px-2.5 py-1.5 rounded text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer disabled:opacity-50"
            >
              🟡 Excepción EMO (Ámbar)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('EXPIRED_RED')}
              className="px-2.5 py-1.5 rounded text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer disabled:opacity-50"
            >
              🔴 SCTR Vencido (Rojo)
            </button>
            <button
              disabled={loading}
              onClick={() => handleCreateDemoScenario('BLACKLISTED_RED')}
              className="px-2.5 py-1.5 rounded text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-rose-300 transition cursor-pointer disabled:opacity-50"
            >
              ⛔ Lista Negra
            </button>
          </div>
        </div>

        {/* TOAST DE NOTIFICACIÓN */}
        {toast && (
          <div className="px-6 pt-3">
            <div
              className={`px-4 py-2.5 rounded border text-xs font-semibold flex items-center justify-between shadow-xs ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : toast.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-sky-50 border-sky-300 text-sky-900'
              }`}
            >
              <span>{toast.text}</span>
              <button onClick={() => setToast(null)} className="underline ml-4 cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================
            ÁREA DE CONTENIDO PRINCIPAL SEGÚN MÓDULO SELECCIONADO
        ======================================================================== */}
        <main className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* ----------------------------------------------------------------------
              VISTA 1A: INICIO -> ACCESO DIRECTO (RÉPLICA ENTREGABLE 3, FIGURA 2)
          ---------------------------------------------------------------------- */}
          {(activeNav === 'INICIO_ACCESO_DIRECTO' || activeNav === 'INICIO_PANEL_CONTROL') && (
            <div className="bg-white rounded shadow-xs border border-slate-200">
              {/* Pestañas Acceso directo | Panel de control */}
              <div className="border-b border-slate-200 px-6 pt-3 flex items-center gap-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveNav('INICIO_ACCESO_DIRECTO')}
                  className={`pb-3 border-b-2 transition cursor-pointer ${
                    activeNav === 'INICIO_ACCESO_DIRECTO'
                      ? 'border-sky-600 text-sky-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Acceso directo
                </button>
                <button
                  onClick={() => setActiveNav('INICIO_PANEL_CONTROL')}
                  className={`pb-3 border-b-2 transition cursor-pointer ${
                    activeNav === 'INICIO_PANEL_CONTROL'
                      ? 'border-sky-600 text-sky-700 font-bold'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Panel de control (Evidencia Empírica & Semáforo)
                </button>
              </div>

              {activeNav === 'INICIO_ACCESO_DIRECTO' && (
                <div className="p-6 space-y-6">
                  {/* Primera fila de 4 tarjetas como en la Figura 2 del Entregable 3 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Tarjeta 1: Afiliación (Borde Verde Zero-Touch como en Fig. 2) */}
                    <div className="rounded border-2 border-emerald-600 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800">Afiliación (Zero-Touch OCR)</h3>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            PILAR 1
                          </span>
                        </div>
                        <div className="h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center relative border-b border-slate-100">
                          <FileCheck className="w-14 h-14 text-emerald-600" />
                          <span className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            &lt; 10 seg / doc
                          </span>
                        </div>
                        <p className="p-4 text-xs text-slate-600 leading-relaxed">
                          Revise el estado de su afiliación, adjunte sus documentos (DNI, SCTR, EMO, ISEM) con
                          pre-validación automática OCR y consulte el Semáforo Operativo.
                        </p>
                      </div>
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setActiveNav('AFILIACION_AFILIADOS')}
                          className="px-3.5 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ir
                        </button>
                      </div>
                    </div>

                    {/* Tarjeta 2: Datos personales y Bandeja de Excepciones */}
                    <div className="rounded border-2 border-amber-400 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800">Bandeja de Excepciones</h3>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                            SSOMA / DHO
                          </span>
                        </div>
                        <div className="h-32 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center relative border-b border-slate-100">
                          <ShieldAlert className="w-14 h-14 text-amber-600" />
                          <span className="absolute bottom-2 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded">
                            {metrics?.openExceptions || 0} pendientes
                          </span>
                        </div>
                        <p className="p-4 text-xs text-slate-600 leading-relaxed">
                          Gestión por excepciones: SSOMA, Área Médica y DHO auditan únicamente los documentos en
                          estado ÁMBAR (ilegibles o con incertidumbre OCR).
                        </p>
                      </div>
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setActiveNav('AFILIACION_EXCEPCIONES')}
                          className="px-3.5 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ir
                        </button>
                      </div>
                    </div>

                    {/* Tarjeta 3: Inducciones E-Learning Asíncronas 24/7 */}
                    <div className="rounded border border-slate-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800">Inducciones E-Learning 24/7</h3>
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            PILAR 2
                          </span>
                        </div>
                        <div className="h-32 bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center relative border-b border-slate-100">
                          <BookOpen className="w-14 h-14 text-indigo-600" />
                          <span className="absolute bottom-2 right-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Asíncrono Web
                          </span>
                        </div>
                        <p className="p-4 text-xs text-slate-600 leading-relaxed">
                          Desbloqueo automático de capacitaciones teóricas transversales (Seguridad General y Medio
                          Ambiente) con evaluación aleatoria antes de viajar a unidad.
                        </p>
                      </div>
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setActiveNav('AFILIACION_ELEARNING')}
                          className="px-3.5 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ir
                        </button>
                      </div>
                    </div>

                    {/* Tarjeta 4: Reservas de Viaje y Carné Digital QR (Borde Azul como en Fig. 2) */}
                    <div className="rounded border-2 border-sky-600 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800">Reservas de viaje / Carné QR</h3>
                          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                            GARITA PVC
                          </span>
                        </div>
                        <div className="h-32 bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center relative border-b border-slate-100">
                          <QrCode className="w-14 h-14 text-sky-700" />
                          <span className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Semáforo Verde
                          </span>
                        </div>
                        <p className="p-4 text-xs text-slate-600 leading-relaxed">
                          Verifique el estado de su habilitación; guarde su Carné Digital (código QR) y valide la orden
                          de impresión del Fotocheck físico en PVC en garita.
                        </p>
                      </div>
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => setActiveNav('ACCESOS_CARNET_QR')}
                          className="px-3.5 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ir
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Segunda fila: Maestros y Control (Documentos por estadía, Lista Negra, Panel KPI) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                    <div className="rounded border border-slate-200 bg-slate-50/60 p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-slate-800">Tabla Maestra: Documentos por Estadía</h4>
                        <p className="text-xs text-slate-500">
                          Configuración real de App Bateas v2.1.0 con banderas ¿Es obligatorio? y ¿Requiere vigencia?.
                        </p>
                        <button
                          onClick={() => setActiveNav('AFILIACION_DOCS_ESTADIA')}
                          className="mt-2 px-3 py-1 bg-[#007bff] text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Abrir Maestro
                        </button>
                      </div>
                      <FileSpreadsheet className="w-10 h-10 text-slate-400 shrink-0" />
                    </div>

                    <div className="rounded border border-slate-200 bg-slate-50/60 p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-slate-800">Módulo de Lista Negra (DHO)</h4>
                        <p className="text-xs text-slate-500">
                          Cruce automático de DNIs con restricción de acceso activa al momento del registro.
                        </p>
                        <button
                          onClick={() => setActiveNav('AFILIACION_LISTA_NEGRA')}
                          className="mt-2 px-3 py-1 bg-[#007bff] text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ver Lista Negra
                        </button>
                      </div>
                      <Lock className="w-10 h-10 text-rose-400 shrink-0" />
                    </div>

                    <div className="rounded border border-slate-200 bg-slate-50/60 p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-slate-800">Panel de Control y Semáforo</h4>
                        <p className="text-xs text-slate-500">
                          Comparativa del diagnóstico base (87.9% vencidos) frente al flujo Zero-Touch en vivo.
                        </p>
                        <button
                          onClick={() => setActiveNav('INICIO_PANEL_CONTROL')}
                          className="mt-2 px-3 py-1 bg-[#007bff] text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Ver Gráficos
                        </button>
                      </div>
                      <BarChart3 className="w-10 h-10 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------
                  VISTA 1B: INICIO -> PANEL DE CONTROL (RÉPLICA ENTREGABLE 2, FIG. 2)
              ------------------------------------------------------------------ */}
              {activeNav === 'INICIO_PANEL_CONTROL' && (
                <div className="p-6 space-y-6">
                  {/* KPIs Superiores */}
                  {metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded border border-slate-200 bg-slate-50">
                        <span className="text-[11px] font-bold uppercase text-slate-500">Total Afiliados (Demo)</span>
                        <p className="text-2xl font-black text-slate-900 mt-1">{metrics.totalWorkers}</p>
                        <span className="text-[11px] text-slate-500">En Supabase PostgreSQL</span>
                      </div>
                      <div className="p-4 rounded border border-emerald-200 bg-emerald-50">
                        <span className="text-[11px] font-bold uppercase text-emerald-800">Semáforo VERDE</span>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.greenCount}</p>
                        <span className="text-[11px] text-emerald-700">Habilitados en &lt; 48h</span>
                      </div>
                      <div className="p-4 rounded border border-amber-200 bg-amber-50">
                        <span className="text-[11px] font-bold uppercase text-amber-800">Semáforo ÁMBAR</span>
                        <p className="text-2xl font-black text-amber-700 mt-1">{metrics.amberCount}</p>
                        <span className="text-[11px] text-amber-700">En Bandeja de Excepciones</span>
                      </div>
                      <div className="p-4 rounded border border-rose-200 bg-rose-50">
                        <span className="text-[11px] font-bold uppercase text-rose-800">Semáforo ROJO</span>
                        <p className="text-2xl font-black text-rose-700 mt-1">{metrics.redCount}</p>
                        <span className="text-[11px] text-rose-700">Doc Vencido / Lista Negra</span>
                      </div>
                      <div className="p-4 rounded border border-indigo-200 bg-indigo-50">
                        <span className="text-[11px] font-bold uppercase text-indigo-800">Pre-Aprobación OCR</span>
                        <p className="text-2xl font-black text-indigo-700 mt-1">{metrics.automationRatePercent}%</p>
                        <span className="text-[11px] text-indigo-700">Sin intervención humana</span>
                      </div>
                    </div>
                  )}

                  {/* Gráficos de Dona Comparativos (Réplica de Figura 2 del Entregable 2) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dona 1: Diagnóstico Empírico AS-IS (3,585 contratistas en App Bateas v2.1.0) */}
                    <div className="p-5 rounded border border-slate-200 bg-white space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-bold text-slate-800">
                          Situación Afiliados Contratas — Diagnóstico Base (AS-IS: 3,585 registrados)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Evidencia recolectada en el Panel de Control de Minera Bateas (Entregable 2, Fig. 2)
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                        <div
                          className="w-40 h-40 rounded-full flex items-center justify-center relative shadow-inner"
                          style={{
                            background:
                              'conic-gradient(#e11d48 0% 87.9%, #f59e0b 87.9% 89.3%, #10b981 89.3% 100%)',
                          }}
                        >
                          <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center text-center">
                            <span className="text-lg font-black text-rose-600">87.9%</span>
                            <span className="text-[10px] text-slate-500 font-semibold">Vencidos</span>
                          </div>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" />
                            <span>
                              <strong>3,152 (87.9%)</strong> con al menos un documento vencido
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                            <span>
                              <strong>51 (1.4%)</strong> con documentos próximos a vencer (20 días)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                            <span>
                              <strong>382 (10.7%)</strong> afiliados con documentos vigentes
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dona 2: Situación en Tiempo Real TO-BE (Bateas Zero-Touch en Supabase) */}
                    <div className="p-5 rounded border border-slate-200 bg-white space-y-4">
                      <div className="border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-bold text-slate-800">
                          Situación en Tiempo Real (TO-BE: Motor Zero-Touch + Supabase)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Distribución actual del Semáforo Operativo y reducción del 80% de revisión manual
                        </p>
                      </div>
                      {metrics && (
                        <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                          {(() => {
                            const tot = Math.max(metrics.totalWorkers, 1);
                            const gPct = Math.round((metrics.greenCount / tot) * 100);
                            const aPct = Math.round((metrics.amberCount / tot) * 100);
                            return (
                              <>
                                <div
                                  className="w-40 h-40 rounded-full flex items-center justify-center relative shadow-inner"
                                  style={{
                                    background: `conic-gradient(#10b981 0% ${gPct}%, #f59e0b ${gPct}% ${
                                      gPct + aPct
                                    }%, #e11d48 ${gPct + aPct}% 100%)`,
                                  }}
                                >
                                  <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center text-center">
                                    <span className="text-lg font-black text-emerald-600">
                                      {metrics.automationRatePercent}%
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold">Zero-Touch</span>
                                  </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                                    <span>
                                      <strong>{metrics.greenCount} expediente(s) en VERDE</strong> (Carné QR emitido)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                                    <span>
                                      <strong>{metrics.amberCount} expediente(s) en ÁMBAR</strong> (Gestión por
                                      Excepción)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" />
                                    <span>
                                      <strong>{metrics.redCount} expediente(s) en ROJO</strong> (Bloqueo preventivo)
                                    </span>
                                  </div>
                                  <div className="pt-2 text-[11px] text-slate-500">
                                    Tiempo de lectura OCR: <strong>&lt; 2 seg / doc</strong> (vs. 2.5 min manual)
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 2: AFILIACIÓN -> AFILIADOS Y PRE-VALIDACIÓN OCR (MASTER-DETAIL WEB)
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_AFILIADOS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* COLUMNA IZQUIERDA (4 cols): Padrón de Trabajadores Afiliados */}
              <div className="lg:col-span-4 bg-white rounded border border-slate-200 shadow-2xs flex flex-col">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-sm text-slate-800">Padrón de Afiliados (ECM)</h2>
                    <p className="text-[11px] text-slate-500">Seleccione un trabajador para gestionar su expediente</p>
                  </div>
                  <button
                    onClick={() => setShowNewWorkerModal(true)}
                    className="px-3 py-1.5 bg-[#28a745] hover:bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo
                  </button>
                </div>

                {/* Buscador y Filtro por Semáforo */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={workerSearch}
                      onChange={(e) => setWorkerSearch(e.target.value)}
                      placeholder="Buscar por DNI, nombre o contrata..."
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    {(['ALL', 'VERDE', 'AMBAR', 'ROJO'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setTrafficFilter(st)}
                        className={`flex-1 py-1 rounded font-bold border transition cursor-pointer ${
                          trafficFilter === st
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {st === 'ALL' ? 'Todos' : st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de Trabajadores */}
                <div className="divide-y divide-slate-200 max-h-[620px] overflow-y-auto">
                  {filteredWorkers.map((w) => {
                    const isSelected = selectedWorker?.id === w.id;
                    const mandatory = w.documents.filter((d) => d.requirement.isMandatory);
                    const greenDocs = mandatory.filter((d) => d.status === 'VERDE').length;
                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedWorkerId(w.id)}
                        className={`p-3.5 cursor-pointer transition ${
                          isSelected
                            ? 'bg-sky-50/90 border-l-4 border-[#007bff]'
                            : 'hover:bg-slate-50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900">{w.fullName}</span>
                          {renderTrafficPill(w.trafficLight)}
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                          DNI: <strong>{w.dni}</strong> · {w.jobPosition}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{w.contractor.companyName}</p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                          <span>
                            Docs Obligatorios: <strong>{greenDocs}/{mandatory.length} VERDE</strong>
                          </span>
                          <span>E-Learning: {w.elearningPassed ? '✅ Aprobado' : '⏳ Pendiente'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COLUMNA DERECHA (8 cols): Detalle del Expediente, Carga OCR y Semáforo */}
              <div className="lg:col-span-8 space-y-5">
                {selectedWorker ? (
                  <>
                    {/* Cabecera del Expediente y Semáforo Operativo */}
                    <div className="bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderTrafficPill(selectedWorker.trafficLight, 'md')}
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300">
                              DNI: {selectedWorker.dni}
                            </span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300">
                              Estadía: {selectedWorker.stayType}
                            </span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300">
                              Puesto: {selectedWorker.jobPosition}
                            </span>
                            <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-300">
                              Zona: {selectedWorker.accessZone}
                            </span>
                          </div>
                          <h2 className="text-lg font-black text-slate-900 pt-1">{selectedWorker.fullName}</h2>
                          <p className="text-xs text-slate-600">
                            Empresa Contratista (ECM): <strong>{selectedWorker.contractor.companyName}</strong> · Código
                            Sesión E-Learning: <strong className="text-indigo-700">{selectedWorker.sessionCode}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {selectedWorker.digitalBadge && (
                            <button
                              onClick={() => setActiveNav('ACCESOS_CARNET_QR')}
                              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <QrCode className="w-4 h-4" /> Ver Carné QR ({selectedWorker.digitalBadge.badgeCode})
                            </button>
                          )}
                          {!selectedWorker.isBlacklisted && (
                            <button
                              onClick={() => setActiveNav('AFILIACION_ELEARNING')}
                              className="px-3.5 py-2 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <BookOpen className="w-4 h-4" />{' '}
                              {selectedWorker.elearningPassed ? 'Ver E-Learning (Aprobado)' : 'Rendir E-Learning Web'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Diagnóstico en vivo del Motor de Reglas */}
                      <div
                        className={`p-3 rounded border text-xs font-semibold flex items-center justify-between ${
                          selectedWorker.trafficLight === 'VERDE'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : selectedWorker.trafficLight === 'ROJO'
                            ? 'bg-rose-50 border-rose-300 text-rose-900'
                            : 'bg-amber-50 border-amber-300 text-amber-900'
                        }`}
                      >
                        <span>🚦 Diagnóstico del Semáforo Operativo: {selectedWorker.statusSummary}</span>
                        {selectedWorker.trafficLight === 'AMBAR' && (
                          <button
                            onClick={() => setActiveNav('AFILIACION_EXCEPCIONES')}
                            className="underline font-bold ml-3 cursor-pointer"
                          >
                            Ir a Bandeja de Excepciones →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tabla Web de Documentos del Expediente (Estilo Figura 3 App Bateas) */}
                    <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-slate-800">
                            Checklist Documental por Perfil y Pre-Validación OCR
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Suba un archivo PDF o imagen, o utilice los botones de prueba rápida para verificar la
                            respuesta del motor OCR y del Semáforo Operativo.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                              <th className="p-3 font-bold">#</th>
                              <th className="p-3 font-bold">Requisito Documental</th>
                              <th className="p-3 font-bold text-center">¿Es obligatorio?</th>
                              <th className="p-3 font-bold text-center">¿Requiere vigencia?</th>
                              <th className="p-3 font-bold">Vigencia / DNI Extraído (OCR)</th>
                              <th className="p-3 font-bold">Semáforo Doc</th>
                              <th className="p-3 font-bold text-right">Acciones (Carga / OCR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedWorker.documents.map((doc, idx) => (
                              <tr key={doc.id} className="hover:bg-slate-50/90">
                                <td className="p-3 font-semibold text-slate-500">{idx + 1}</td>
                                <td className="p-3">
                                  <p className="font-bold text-slate-900">{doc.requirement.name}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{doc.statusReason}</p>
                                  {doc.fileName && (
                                    <span className="inline-block mt-1 text-[10px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                      📄 {doc.fileName} ({doc.extractionMethod || 'OCR'})
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                      doc.requirement.isMandatory
                                        ? 'bg-[#28a745] text-white'
                                        : 'bg-[#f39c12] text-white'
                                    }`}
                                  >
                                    {doc.requirement.isMandatory ? 'Sí' : 'No'}
                                  </span>
                                </td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                      doc.requirement.requiresValidity
                                        ? 'bg-[#28a745] text-white'
                                        : 'bg-[#f39c12] text-white'
                                    }`}
                                  >
                                    {doc.requirement.requiresValidity ? 'Sí' : 'No'}
                                  </span>
                                </td>
                                <td className="p-3 text-[11px]">
                                  <div>
                                    Vigencia:{' '}
                                    <strong>
                                      {doc.detectedExpiryDate ? String(doc.detectedExpiryDate).split('T')[0] : '—'}
                                    </strong>
                                  </div>
                                  <div className="text-slate-500">DNI leído: {doc.detectedDni || '—'}</div>
                                </td>
                                <td className="p-3">{renderTrafficPill(doc.status)}</td>
                                <td className="p-3 text-right">
                                  {!selectedWorker.isBlacklisted && (
                                    <div className="flex flex-col items-end gap-1.5">
                                      <div className="flex items-center gap-1">
                                        <label className="px-2.5 py-1 bg-[#007bff] hover:bg-blue-600 text-white text-[11px] font-bold rounded cursor-pointer inline-flex items-center gap-1 shadow-2xs">
                                          <Upload className="w-3 h-3" /> Subir PDF/Img
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
                                        {doc.extractedText && (
                                          <button
                                            onClick={() => setInspectedDoc(doc)}
                                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded cursor-pointer"
                                            title="Inspeccionar texto leído por el motor OCR"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>

                                      {/* Botones de prueba unitaria OCR para demostración */}
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'VALID')}
                                          className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded cursor-pointer"
                                        >
                                          OCR Vigente
                                        </button>
                                        {doc.requirement.requiresValidity && (
                                          <>
                                            <button
                                              onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'UNCERTAIN')}
                                              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded cursor-pointer"
                                            >
                                              OCR Ámbar
                                            </button>
                                            <button
                                              onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'EXPIRED')}
                                              className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded cursor-pointer"
                                            >
                                              OCR Vencido
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white p-8 rounded border border-slate-200 text-center text-xs text-slate-500">
                    Seleccione o registre un trabajador afiliado.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 3: BANDEJA DE EXCEPCIONES SPLIT-SCREEN (SSOMA / MÉDICO / DHO)
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_EXCEPCIONES' && (
            <div className="space-y-4">
              {/* Barra Superior de Filtros por Área Revisora */}
              <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Bandeja Web de Gestión por Excepciones (Auditoría Focalizada SSOMA · Área Médica · DHO)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Los documentos legibles y vigentes se aprueban automáticamente en VERDE. Aquí solo ingresan los
                    documentos en estado ÁMBAR.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['ALL', 'SSOMA', 'AREA_MEDICA', 'DHO', 'AREA_USUARIA'] as const).map((area) => (
                    <button
                      key={area}
                      onClick={() => setAreaFilter(area)}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                        areaFilter === area
                          ? 'bg-[#222d32] text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {area === 'ALL' ? 'Todas las Áreas' : area}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExceptions.length === 0 ? (
                <div className="bg-white p-12 rounded border border-slate-200 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800">
                    Sin excepciones pendientes para el área seleccionada
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Todos los documentos obligatorios fueron pre-validados automáticamente o ya fueron resueltos. Puede
                    generar un caso con excepción pulsando arriba en &ldquo;🟡 Excepción EMO (Ámbar)&rdquo;.
                  </p>
                </div>
              ) : (
                /* LAYOUT SPLIT-SCREEN: Cola a la izquierda (5 cols) | Visor OCR + Dictamen a la derecha (7 cols) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Lista de Tickets en ÁMBAR */}
                  <div className="lg:col-span-5 bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-800 text-white text-xs font-bold flex items-center justify-between">
                      <span>Cola de Documentos Observados (ÁMBAR)</span>
                      <span>{filteredExceptions.length} ticket(s)</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {filteredExceptions.map((ex) => {
                        const isSelected = activeException?.id === ex.id;
                        return (
                          <div
                            key={ex.id}
                            onClick={() => setSelectedExceptionId(ex.id)}
                            className={`p-4 cursor-pointer transition ${
                              isSelected
                                ? 'bg-amber-50/90 border-l-4 border-amber-500'
                                : 'hover:bg-slate-50 border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-950">
                                Área: {ex.assignedArea}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                DNI: {ex.workerDocument.worker.dni}
                              </span>
                            </div>
                            <h4 className="font-bold text-xs text-slate-900 mt-1.5">
                              {ex.workerDocument.requirement.name}
                            </h4>
                            <p className="text-xs text-slate-700 font-medium">
                              Trabajador: {ex.workerDocument.worker.fullName}
                            </p>
                            <p className="text-[11px] text-amber-800 mt-1 line-clamp-2">{ex.reasonTriggered}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inspector Split-Screen del Ticket Seleccionado */}
                  {activeException && (
                    <div className="lg:col-span-7 bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
                      <div className="border-b border-slate-200 pb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] font-black uppercase text-amber-700">
                            Inspector Documental · Área Responsable: {activeException.assignedArea}
                          </span>
                          <h3 className="text-base font-black text-slate-900">
                            {activeException.workerDocument.requirement.name}
                          </h3>
                          <p className="text-xs text-slate-600">
                            Trabajador: <strong>{activeException.workerDocument.worker.fullName}</strong> (DNI:{' '}
                            {activeException.workerDocument.worker.dni}) · ECM:{' '}
                            {activeException.workerDocument.worker.contractor.companyName}
                          </p>
                        </div>
                        {renderTrafficPill('AMBAR', 'md')}
                      </div>

                      <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong>Anomalía detectada por el Motor OCR:</strong> {activeException.reasonTriggered}
                        </div>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            handleRunGeminiDocAudit(activeException.workerDocument.id, activeException.id)
                          }
                          className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Sparkles className="w-3 h-3" /> Analizar con Gemini IA
                        </button>
                      </div>
                      {aiAuditSuggestion[activeException.workerDocument.id] && (
                        <div className="p-3 rounded bg-indigo-50 border border-indigo-200 text-xs text-indigo-950">
                          <strong>
                            🤖 Dictamen Gemini ({aiAuditSuggestion[activeException.workerDocument.id].modelUsed}):
                          </strong>{' '}
                          {aiAuditSuggestion[activeException.workerDocument.id].summaryReason}
                        </div>
                      )}

                      {/* Visor del Contenido Extraído por OCR */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                          <span>Evidencia / Texto Extraído del Documento ({activeException.workerDocument.fileName})</span>
                          <span className="text-[11px] text-slate-500">
                            Confianza OCR: {activeException.workerDocument.ocrConfidence || 75}%
                          </span>
                        </div>
                        <pre className="p-4 rounded bg-slate-900 text-emerald-300 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                          {activeException.workerDocument.extractedText || 'Sin texto legible extraído.'}
                        </pre>
                      </div>

                      {/* Formulario de Dictamen Humano */}
                      {(() => {
                        const fState = resolveForm[activeException.id] || {
                          reviewerName: `Víctor Cayata (${activeException.assignedArea})`,
                          comment: 'Verificado manualmente conforme a documento original.',
                          manualDate: '31/12/2026',
                        };
                        return (
                          <div className="space-y-3 pt-2 border-t border-slate-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Especialista Revisor Autorizado
                                </label>
                                <input
                                  type="text"
                                  value={fState.reviewerName}
                                  onChange={(e) =>
                                    setResolveForm({
                                      ...resolveForm,
                                      [activeException.id]: { ...fState, reviewerName: e.target.value },
                                    })
                                  }
                                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Fecha de Vigencia Confirmada (DD/MM/YYYY)
                                </label>
                                <input
                                  type="text"
                                  value={fState.manualDate}
                                  onChange={(e) =>
                                    setResolveForm({
                                      ...resolveForm,
                                      [activeException.id]: { ...fState, manualDate: e.target.value },
                                    })
                                  }
                                  placeholder="31/12/2026"
                                  className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Comentario / Justificación de Auditoría
                              </label>
                              <textarea
                                rows={2}
                                value={fState.comment}
                                onChange={(e) =>
                                  setResolveForm({
                                    ...resolveForm,
                                    [activeException.id]: { ...fState, comment: e.target.value },
                                  })
                                }
                                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 pt-1">
                              <button
                                disabled={loading}
                                onClick={() => handleResolveException(activeException.id, 'APPROVED')}
                                className="px-4 py-2 bg-[#28a745] hover:bg-emerald-600 text-white text-xs font-bold rounded shadow-2xs cursor-pointer"
                              >
                                ✅ Validar y Aprobar Documento (Pasa a VERDE)
                              </button>
                              <button
                                disabled={loading}
                                onClick={() => handleResolveException(activeException.id, 'REJECTED')}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded shadow-2xs cursor-pointer"
                              >
                                ❌ Observar y Rechazar (Pasa a ROJO para subsanación ECM)
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 4: TABLA MAESTRA "DOCUMENTOS POR ESTADÍA" (FIGURA 3 ENTREGABLE 3)
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_DOCS_ESTADIA' && (
            <div className="bg-white rounded border border-slate-200 shadow-2xs p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-800">Documentos por estadía</h2>
                <span className="text-xs text-slate-500">Inicio / Afiliación / Documentos por estadía</span>
              </div>

              {/* Buscador + Botón Aplicar idéntico a la captura de App Bateas */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={estadiaSearch}
                  onChange={(e) => setEstadiaSearch(e.target.value)}
                  placeholder="Buscar por descripción o tipo de estadía..."
                  className="w-80 border border-slate-300 rounded px-3 py-1.5 text-xs"
                />
                <button className="px-8 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded cursor-pointer">
                  Aplicar
                </button>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => fetchAllData(selectedWorker?.id)}
                  className="w-7 h-7 rounded bg-[#28a745] text-white flex items-center justify-center text-xs font-bold cursor-pointer"
                  title="Sincronizar maestro"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tabla Maestra con las banderas ¿Es obligatorio? y ¿Requiere vigencia? */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="p-2.5 border-r border-slate-200 font-bold">#</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold">Tipo de Estadía</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold">Descripción</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold">Perfil / Puesto</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold text-center">¿Es obligatorio?</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold text-center">¿Requiere vigencia?</th>
                      <th className="p-2.5 border-r border-slate-200 font-bold">Área Excepción</th>
                      <th className="p-2.5 font-bold text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {requirementsMaster
                      .filter(
                        (r) =>
                          !estadiaSearch.trim() ||
                          r.name.toLowerCase().includes(estadiaSearch.toLowerCase()) ||
                          r.code.toLowerCase().includes(estadiaSearch.toLowerCase())
                      )
                      .map((r, index) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="p-2.5 border-r border-slate-200 text-slate-600">{index + 1}</td>
                          <td className="p-2.5 border-r border-slate-200 text-slate-600 font-medium">
                            {r.stayType.replace('_', ' ')}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-bold text-slate-800">{r.name}</td>
                          <td className="p-2.5 border-r border-slate-200 text-slate-500">
                            {r.applicableJob || 'TODOS LOS PERFILES'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                                r.isMandatory ? 'bg-[#28a745]' : 'bg-[#f39c12]'
                              }`}
                            >
                              {r.isMandatory ? 'Sí' : 'No'}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                                r.requiresValidity ? 'bg-[#28a745]' : 'bg-[#f39c12]'
                              }`}
                            >
                              {r.requiresValidity ? 'Sí' : 'No'}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-semibold text-slate-700">
                            {r.responsibleArea}
                          </td>
                          <td className="p-2.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              <span className="w-6 h-6 rounded bg-[#28a745] text-white inline-flex items-center justify-center">
                                <Settings className="w-3.5 h-3.5" />
                              </span>
                              <span className="w-6 h-6 rounded bg-[#dc3545] text-white inline-flex items-center justify-center">
                                <Trash2 className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 5: MÓDULO LISTA NEGRA (CRUCE AUTOMÁTICO DHO)
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_LISTA_NEGRA' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white rounded border border-slate-200 shadow-2xs p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-800">
                  Registro Oficial de Lista Negra (Cruce Automático en Afiliación)
                </h2>
                <p className="text-xs text-slate-500">
                  Cualquier trabajador cuyo DNI coincida con un registro activo en esta tabla pasa inmediatamente a
                  Semáforo ROJO al momento de su registro.
                </p>
                <table className="w-full text-left border-collapse text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="p-3 font-bold">DNI</th>
                      <th className="p-3 font-bold">Nombres y Apellidos</th>
                      <th className="p-3 font-bold">Motivo de Restricción (DHO / Seguridad)</th>
                      <th className="p-3 font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {blacklist.map((b) => (
                      <tr key={b.id} className="hover:bg-rose-50/40">
                        <td className="p-3 font-black text-rose-800">{b.dni}</td>
                        <td className="p-3 font-bold text-slate-800">{b.fullName}</td>
                        <td className="p-3 text-slate-600">{b.reason}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                            BLOQUEO ACTIVO
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-5 bg-white rounded border border-slate-200 shadow-2xs p-6 space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Agregar Restricción a Lista Negra</h3>
                <form onSubmit={handleAddBlacklist} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">DNI (8 dígitos)</label>
                    <input
                      type="text"
                      value={newBlacklist.dni}
                      onChange={(e) => setNewBlacklist({ ...newBlacklist, dni: e.target.value })}
                      placeholder="Ej. 48887776"
                      className="w-full border border-slate-300 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={newBlacklist.fullName}
                      onChange={(e) => setNewBlacklist({ ...newBlacklist, fullName: e.target.value })}
                      placeholder="Ej. LUIS ALBERTO QUISPE"
                      className="w-full border border-slate-300 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Motivo Oficial del Bloqueo</label>
                    <textarea
                      rows={3}
                      value={newBlacklist.reason}
                      onChange={(e) => setNewBlacklist({ ...newBlacklist, reason: e.target.value })}
                      placeholder="Infracción de seguridad / documentación adulterada..."
                      className="w-full border border-slate-300 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded cursor-pointer"
                  >
                    Registrar en Lista Negra
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 6: AULA WEB E-LEARNING ASÍNCRONA 24/7
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_ELEARNING' && selectedWorker && (
            <div className="bg-white rounded border border-slate-200 shadow-2xs p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-indigo-600">
                    Pilar 2 · Módulo Web de Inducciones Teóricas Asíncronas 24/7
                  </span>
                  <h2 className="text-lg font-black text-slate-900">
                    Capacitación Transversal Obligatoria — {selectedWorker.fullName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    DNI Validado: <strong>{selectedWorker.dni}</strong> · Código Único de Sesión:{' '}
                    <strong className="text-indigo-700">{selectedWorker.sessionCode}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedWorker.id}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="border border-slate-300 rounded px-3 py-1.5 text-xs font-bold"
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.dni} — {w.fullName} ({w.elearningPassed ? 'Aprobado' : 'Pendiente'})
                      </option>
                    ))}
                  </select>
                  {selectedWorker.elearningPassed ? (
                    <span className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1">
                      <Award className="w-4 h-4" /> APROBADO (≥ 75%)
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold">
                      PENDIENTE DE EVALUACIÓN
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded border border-slate-200 bg-slate-50 space-y-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    🦺 Módulo Teórico 1: Seguridad y Salud Ocupacional (SSOMA)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Antes de ingresar a cualquier zona operativa de Minera Bateas, el colaborador debe contar con
                    Semáforo Operativo en VERDE, portar su Fotocheck físico en PVC y EPP completo acorde al IPERC
                    continuo. Ante cualquier condición subestándar de alto riesgo, es obligatorio aplicar la política de
                    detención de tarea segura y reportar al supervisor inmediato.
                  </p>
                </div>
                <div className="p-5 rounded border border-slate-200 bg-slate-50 space-y-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    🌱 Módulo Teórico 2: Medio Ambiente y Segregación NTP
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Todo contratista permanente es responsable de segregar los residuos generados en su frente de
                    trabajo respetando los puntos ecológicos autorizados según la Norma Técnica Peruana (NTP 900.058).
                    Queda prohibido mezclar residuos peligrosos o abandonar materiales en interior mina o superficie.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-200 p-3.5 rounded">
                <input
                  id="web_elearning_chk"
                  type="checkbox"
                  checked={materialRead || selectedWorker.elearningPassed}
                  onChange={(e) => setMaterialRead(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="web_elearning_chk" className="text-xs font-bold text-indigo-950 cursor-pointer">
                  Declaro haber revisado íntegramente el material teórico de Seguridad General y Medio Ambiente.
                </label>
              </div>

              {(materialRead || selectedWorker.elearningPassed) && (
                <form onSubmit={handleSubmitQuiz} className="space-y-4 pt-2">
                  <h4 className="font-bold text-sm text-slate-800">
                    Cuestionario de Evaluación (4 Preguntas Aleatorias · Nota mínima aprobatoria: 3/4)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded border border-slate-200 bg-white space-y-2">
                        <p className="text-xs font-bold text-slate-900">
                          {idx + 1}. {q.questionText}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={quizAnswers[q.id] === optIdx}
                                onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: optIdx })}
                                className="mt-0.5"
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
                    className="px-5 py-2.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded shadow cursor-pointer"
                  >
                    Enviar Evaluación y Actualizar Semáforo Operativo
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------------
              VISTA 7: CONTROL DE ACCESOS -> CARNÉ DIGITAL QR Y FOTOCHECK PVC GARITA
          ---------------------------------------------------------------------- */}
          {activeNav === 'ACCESOS_CARNET_QR' && (
            <div className="space-y-5">
              <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Emisión Automática de Carné Digital QR y Cola de Impresión de Fotocheck Físico en PVC (Garita)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Al alcanzar Semáforo VERDE, el sistema genera el código QR firmado y encola la impresión de la
                    credencial física en PVC para uso con guantes en planta y socavón.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workers
                  .filter((w) => w.digitalBadge !== null)
                  .map((w) => {
                    const badge = w.digitalBadge!;
                    return (
                      <div
                        key={badge.id}
                        className="bg-white rounded-xl border-2 border-sky-600 shadow-sm overflow-hidden flex flex-col justify-between"
                      >
                        {/* Cabecera Estilo Tarjeta "Mi Fotocheck Digital" de App Bateas (Figura 2 Entregable 3) */}
                        <div className="bg-[#1e3a5f] text-white px-4 py-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-sky-300 block">
                              Mi Fotocheck Digital · App Bateas
                            </span>
                            <h4 className="text-sm font-black">{w.fullName}</h4>
                          </div>
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                        </div>

                        <div className="p-5 flex flex-col items-center text-center space-y-3">
                          <div className="p-3 bg-white border-2 border-slate-200 rounded-lg shadow-2xs">
                            <QRCodeSVG value={badge.qrPayloadJson} size={150} level="M" />
                          </div>
                          <div className="space-y-0.5 text-xs">
                            <p className="font-black text-slate-900">{badge.badgeCode}</p>
                            <p className="text-slate-600 font-semibold">
                              DNI: {w.dni} · {w.jobPosition}
                            </p>
                            <p className="text-[11px] text-slate-500">{w.contractor.companyName}</p>
                            <p className="text-[11px] font-bold text-emerald-700 pt-1">
                              Zona: {w.accessZone} · Vigencia Mínima: {String(badge.validUntil).split('T')[0]}
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                          <div className="text-xs">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Credencial Física PVC:
                            </span>
                            <span className="font-black text-slate-800">{badge.pvcPrintStatus}</span>
                          </div>
                          {badge.pvcPrintStatus === 'QUEUED_GARITA' ? (
                            <button
                              onClick={() => handleUpdatePvcStatus(badge.id, 'PRINTED')}
                              className="px-3 py-1.5 bg-[#007bff] hover:bg-blue-600 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" /> Imprimir PVC
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PVC Entregado
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
      </div>

      {/* ==========================================================================
          MODAL WEB: REGISTRAR NUEVO AFILIADO CONTRATISTA
      ========================================================================== */}
      {showNewWorkerModal && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#222d32] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Registrar Nuevo Trabajador Afiliado (App Bateas v2.1.0)</h3>
              <button onClick={() => setShowNewWorkerModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRegisterWorker} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    DNI (Prueba 49998887 para Lista Negra)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={regForm.dni}
                    onChange={(e) => setRegForm({ ...regForm, dni: e.target.value })}
                    placeholder="Ej. 72345678"
                    className="w-full border border-slate-300 rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Apellidos y Nombres</label>
                  <input
                    type="text"
                    value={regForm.fullName}
                    onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                    placeholder="Ej. RAMIREZ SOTO JUAN"
                    className="w-full border border-slate-300 rounded px-3 py-2"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Empresa Contratista Minera (ECM)</label>
                  <input
                    type="text"
                    value={regForm.companyName}
                    onChange={(e) => setRegForm({ ...regForm, companyName: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Puesto / Perfil</label>
                  <select
                    value={regForm.jobPosition}
                    onChange={(e) => setRegForm({ ...regForm, jobPosition: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-2"
                  >
                    <option value="OPERARIO">Operario</option>
                    <option value="INGENIERO">Ingeniero (+ Cert. Habilidad CIP)</option>
                    <option value="CONDUCTOR">Conductor (+ Licencia MTC)</option>
                    <option value="PERSONAL_COCINA">Personal de Cocina (+ Carné Sanidad)</option>
                    <option value="TECNICO">Técnico</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Estadía</label>
                  <select
                    value={regForm.stayType}
                    onChange={(e) => setRegForm({ ...regForm, stayType: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-2"
                  >
                    <option value="PERMANENTE_CIA">PERMANENTE CIA (&gt; 30 días)</option>
                    <option value="TEMPORAL">TEMPORAL</option>
                    <option value="VISITA_TECNICA">VISITA TÉCNICA</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewWorkerModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-[#28a745] hover:bg-emerald-600 text-white font-bold rounded cursor-pointer"
                >
                  Registrar y Cruzar Lista Negra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          PANEL LATERAL FLOTANTE: COPILOTO IA GEMINI + CONTEXTO SUPABASE / MCP
      ========================================================================== */}
      {showCopilot && (
        <div className="fixed right-4 bottom-4 w-96 bg-white rounded-xl border-2 border-indigo-500 shadow-2xl z-50 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-700 to-violet-700 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <div>
                <h3 className="text-xs font-black">Copiloto IA — Bateas Zero-Touch</h3>
                <p className="text-[10px] text-indigo-200">Google Gemini + Supabase PostgreSQL en vivo</p>
              </div>
            </div>
            <button onClick={() => setShowCopilot(false)} className="text-indigo-200 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sugerencias rápidas */}
          <div className="p-2 bg-indigo-50 border-b border-indigo-100 flex flex-wrap gap-1">
            <button
              onClick={() => handleAskCopilot('Resume el estado actual del Semáforo Operativo y qué trabajadores requieren atención urgente.')}
              className="text-[10px] bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-1 rounded font-semibold cursor-pointer"
            >
              📊 Resumen del Semáforo
            </button>
            <button
              onClick={() => handleAskCopilot('¿Qué casos están pendientes en la Bandeja de Excepciones y qué recomiendas hacer?')}
              className="text-[10px] bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-1 rounded font-semibold cursor-pointer"
            >
              🟡 Analizar Excepciones
            </button>
            <button
              onClick={() => handleAskCopilot('¿Quiénes están listos con Carné QR para ingresar a mina?')}
              className="text-[10px] bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-1 rounded font-semibold cursor-pointer"
            >
              🟢 Habilitados QR
            </button>
          </div>

          {/* Historial de mensajes */}
          <div className="p-3 space-y-2.5 max-h-80 overflow-y-auto bg-slate-50 text-xs">
            {copilotMessages.map((m, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white ml-6'
                    : 'bg-white border border-slate-200 text-slate-800 mr-4 shadow-2xs'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                {m.model && (
                  <span className="block text-[9px] text-slate-400 mt-1 font-semibold">Modelo: {m.model}</span>
                )}
              </div>
            ))}
            {copilotLoading && (
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-500 text-xs animate-pulse">
                Consultando expedientes en Supabase con Gemini IA...
              </div>
            )}
          </div>

          {/* Input de pregunta */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskCopilot();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              placeholder="Pregunta sobre trabajadores, OCR o excepciones..."
              className="flex-1 border border-slate-300 rounded px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              disabled={copilotLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded cursor-pointer"
            >
              Enviar
            </button>
          </form>
        </div>
      )}

      {/* ==========================================================================
          MODAL WEB: INSPECTOR DE TEXTO EXTRAÍDO POR EL MOTOR OCR
      ========================================================================== */}
      {inspectedDoc && (
        <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden">
            <div className="px-5 py-3.5 bg-[#222d32] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Lectura OCR — {inspectedDoc.requirement.name} ({inspectedDoc.fileName})
              </h3>
              <button onClick={() => setInspectedDoc(null)} className="text-slate-300 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {renderTrafficPill(inspectedDoc.status)}
                <span>Método: <strong>{inspectedDoc.extractionMethod}</strong></span>
                <span>DNI detectado: <strong>{inspectedDoc.detectedDni || '—'}</strong></span>
                <span>
                  Vigencia detectada:{' '}
                  <strong>
                    {inspectedDoc.detectedExpiryDate ? String(inspectedDoc.detectedExpiryDate).split('T')[0] : '—'}
                  </strong>
                </span>
              </div>
              <pre className="p-4 rounded bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-72">
                {inspectedDoc.extractedText}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
