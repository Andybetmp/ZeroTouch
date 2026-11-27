import React, { useEffect, useState } from 'react';
import {
  Activity,
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
  FlaskConical,
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
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import { AuthUser } from './types/bateas';
import { BiometricModal } from './components/BiometricModal';
import { WorkerPortal } from './components/WorkerPortal';
import { GaritaAccessPortal } from './components/GaritaAccessPortal';
import { SsomaControlPanels } from './components/SsomaControlPanels';
import { CourseManagementPanel } from './components/CourseManagementPanel';
import { TrackingReportsPanel } from './components/TrackingReportsPanel';
import { WorkerCvProfileModal } from './components/WorkerCvProfileModal';
import {
  BrandLoadingRole,
  BrandLoadingScreen,
  LoadingButton,
  SmartLoaderMode,
  SmartProcessLoader,
  TopProgressBar,
} from './components/ui/LoadingStates';
import { DemoModeDrawer } from './components/ui/DemoModeDrawer';
import {
  formatAreaName,
  formatJobProfile,
  formatStayType,
  pluralize,
} from './utils/formatters';

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
  | 'ACCESOS_CARNET_QR'
  | 'SSOMA_CMS_CAPACITACION'
  | 'SSOMA_TORRE_CONTROL'
  | 'SSOMA_INTEGRACIONES'
  | 'SSOMA_GESTION_CAPACITACIONES'
  | 'SSOMA_SEGUIMIENTO_REPORTES';

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
  contractorId?: string;
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
  // Estado de Autenticación Corporativa (Login RBAC)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autologin') === '1') {
        return {
          username: 'ssoma@bateas.pe',
          role: 'SSOMA_DHO',
          strictRole: 'SSOMA',
          workerId: null,
          workerDni: null,
          fullName: 'Esp. Víctor Cayata (DHO / SSOMA)',
          areaLabel: 'Auditoría Interna Minera Bateas',
          token: 'demo-token',
        };
      }
      const saved = sessionStorage.getItem('bateas_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [pendingBiometricUser, setPendingBiometricUser] = useState<AuthUser | null>(null);
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>('ssoma@bateas.pe');
  const [loginPassword, setLoginPassword] = useState<string>('Bateas2026!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  const [activeNav, setActiveNav] = useState<NavSection>(() => {
    const viewParam = new URLSearchParams(window.location.search).get('view') as NavSection | null;
    return viewParam || 'INICIO_ACCESO_DIRECTO';
  });
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
  const [sessionCodeInput, setSessionCodeInput] = useState<string>('');

  // Estado Escáner Verificador QR en Garita (Fase 4)
  const [garitaVerifyCode, setGaritaVerifyCode] = useState<string>('');
  const [garitaVerifyResult, setGaritaVerifyResult] = useState<any>(null);

  // Modal de inspección de texto OCR
  const [inspectedDoc, setInspectedDoc] = useState<WorkerDocument | null>(null);
  const [showCvProfileModal, setShowCvProfileModal] = useState<boolean>(false);
  const [showDemoDrawer, setShowDemoDrawer] = useState<boolean>(false);
  const [smartLoaderMode, setSmartLoaderMode] = useState<SmartLoaderMode | null>(null);
  const [activeAffiliateStep, setActiveAffiliateStep] = useState<1 | 2>(1);
  const [showRawOcrText, setShowRawOcrText] = useState<boolean>(false);
  const [aiAuditLoading, setAiAuditLoading] = useState<boolean>(false);
  const [resolvingDecision, setResolvingDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [showLoginDemoQuickAccess, setShowLoginDemoQuickAccess] = useState<boolean>(false);
  const [showRowSimulators, setShowRowSimulators] = useState<boolean>(false);
  const [sessionSplash, setSessionSplash] = useState<{
    role: BrandLoadingRole;
    userName?: string;
  } | null>({ role: 'BOOT' });

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };
    if (authUser?.token) {
      headers['Authorization'] = `Bearer ${authUser.token}`;
    }
    const resp = await fetch(`/api/v1${path}`, { ...options, headers });
    const json = await resp.json();
    if (!resp.ok || json.success === false) {
      throw new Error(json.error || `Error HTTP ${resp.status}`);
    }
    return json;
  };

  // Estado del Copiloto IA (Gemini + MCP Context)
  const [showCopilot, setShowCopilot] = useState<boolean>(() => {
    return new URLSearchParams(window.location.search).get('copilot') === '1';
  });
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

  // ProtectedRoute / Bloqueo de rutas por URL directa según Rol (Módulo 1)
  useEffect(() => {
    const enforceRouteByRole = () => {
      if (!authUser) return;
      const path = window.location.pathname.toLowerCase();
      const strictRole = authUser.strictRole || (authUser.role === 'SSOMA_DHO' ? 'SSOMA' : authUser.role === 'ADMIN_ECM' ? 'ECM' : 'GARITA');

      if (strictRole === 'TRABAJADOR') {
        if (
          path.startsWith('/admin') ||
          path.startsWith('/ssoma') ||
          path.startsWith('/configuracion') ||
          path.startsWith('/ecm') ||
          path.startsWith('/garita')
        ) {
          window.history.replaceState(null, '', '/portal-trabajador');
          setAccessDeniedMsg(
            `Acceso Denegado (RBAC): La ruta "${path}" es exclusiva para personal administrativo. Has sido redirigido a tu Portal del Trabajador.`
          );
        } else if (path === '/' || path === '') {
          window.history.replaceState(null, '', '/portal-trabajador');
        }
      }
    };

    enforceRouteByRole();
    window.addEventListener('popstate', enforceRouteByRole);
    return () => window.removeEventListener('popstate', enforceRouteByRole);
  }, [authUser]);

  const completeLoginSession = (userObj: AuthUser) => {
    const splashRole: BrandLoadingRole =
      userObj.strictRole === 'TRABAJADOR'
        ? 'TRABAJADOR'
        : userObj.strictRole === 'ECM' || userObj.role === 'ADMIN_ECM'
        ? 'ECM'
        : userObj.strictRole === 'GARITA' || userObj.role === 'GARITA'
        ? 'GARITA'
        : 'SSOMA';
    setSessionSplash({ role: splashRole, userName: userObj.fullName });
    setAuthUser(userObj);
    sessionStorage.setItem('bateas_auth_user', JSON.stringify(userObj));
    if (userObj.strictRole === 'TRABAJADOR') {
      window.history.replaceState(null, '', '/portal-trabajador');
    } else if (userObj.strictRole === 'ECM' || userObj.role === 'ADMIN_ECM') {
      setActiveRoleLabel('ADMIN_ECM');
      setActiveNav('AFILIACION_AFILIADOS');
      window.history.replaceState(null, '', '/ecm/afiliados');
    } else if (userObj.strictRole === 'GARITA' || userObj.role === 'GARITA') {
      setActiveRoleLabel('GARITA');
      setActiveNav('ACCESOS_CARNET_QR');
      window.history.replaceState(null, '', '/garita/accesos');
    } else {
      setActiveRoleLabel('SSOMA_DHO');
      setActiveNav('INICIO_ACCESO_DIRECTO');
      window.history.replaceState(null, '', '/admin/panel');
    }
    window.setTimeout(() => {
      setSessionSplash(null);
    }, 950);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      }).then((r) => r.json());

      if (res.success) {
        if (res.data.strictRole === 'TRABAJADOR' && res.data.workerId) {
          // Módulo 3: Verificación Biométrica Facial obligatoria al iniciar sesión como TRABAJADOR
          setPendingBiometricUser(res.data);
        } else {
          completeLoginSession(res.data);
        }
      } else {
        setLoginError(res.error || 'Error de autenticación');
      }
    } catch (err: any) {
      setLoginError(`No se pudo conectar con el servidor de autenticación: ${err.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
    setPendingBiometricUser(null);
    setAccessDeniedMsg(null);
    sessionStorage.removeItem('bateas_auth_user');
    window.history.replaceState(null, '', '/');
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
    let active = true;
    const minSplash = new Promise<void>((resolve) => window.setTimeout(resolve, 650));
    Promise.all([fetchAllData(), minSplash]).finally(() => {
      if (active) setSessionSplash((prev) => (prev?.role === 'BOOT' ? null : prev));
    });
    return () => {
      active = false;
    };
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
    setSmartLoaderMode('ocr');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/v1/workers/${workerId}/documents/${requirementId}/upload`, {
        method: 'POST',
        headers: authUser?.token ? { Authorization: `Bearer ${authUser.token}` } : undefined,
        body: formData,
      }).then((r) => r.json());

      if (res.success) {
        await fetchAllData(workerId);
        showNotice('success', `Archivo "${file.name}" procesado por el motor OCR en < 2s.`);
      } else {
        showNotice('error', res.error || 'No se pudo procesar el archivo.');
      }
    } catch (err: any) {
      showNotice('error', err?.message || 'Error de conexión al subir el documento.');
    } finally {
      setSmartLoaderMode(null);
      setLoading(false);
    }
  };

  const handleQuickOcrSimulate = async (
    worker: Worker,
    doc: WorkerDocument,
    mode: 'VALID' | 'EXPIRED' | 'UNCERTAIN' | 'CV_MISMATCH'
  ) => {
    setLoading(true);
    try {
      const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString('es-PE');
      const past = '10/01/2024';

      let simulatedText = `MINERA BATEAS S.A.C. - EXPEDIENTE DE AFILIACION\nDocumento: ${doc.requirement.name}\nTrabajador: ${worker.fullName}\nDNI: ${worker.dni}\nEmpresa: ${worker.contractor.companyName}\n`;
      if (mode === 'VALID') {
        simulatedText += `Especialidad verificada para puesto: ${worker.jobPosition}\nFecha de vencimiento: ${future}\nDictamen: VIGENTE / CONFORME`;
      } else if (mode === 'EXPIRED') {
        simulatedText += `Fecha de vencimiento: ${past}\nDictamen: VENCIDO`;
      } else if (mode === 'CV_MISMATCH') {
        simulatedText = `CURRICULUM VITAE\nPostulante: ${worker.fullName}\nDNI: ${worker.dni}\nExperiencia: 2 años en atención al cliente y ventas retail (Sin mención de especialidad técnica ni colegiatura para ${worker.jobPosition}).`;
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
    setResolvingDecision(decision);
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
      setResolvingDecision(null);
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
    setAiAuditLoading(true);
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
      setAiAuditLoading(false);
    }
  };

  const ACCESS_AREA_OPTIONS = [
    { value: 'SOCAVON', label: 'Interior Mina / Socavón' },
    { value: 'PLANTA_CONCENTRADORA', label: 'Planta Concentradora' },
    { value: 'SUPERFICIE', label: 'Superficie / Talleres' },
    { value: 'OFICINAS_ADMINISTRATIVAS', label: 'Oficinas Administrativas' },
  ];

  const getAreaLabel = (zone?: string) =>
    ACCESS_AREA_OPTIONS.find((a) => a.value === zone)?.label || zone || 'Superficie / Talleres';

  const handleChangeWorkerArea = async (workerId: string, newArea: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/workers/${workerId}/area`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessZone: newArea }),
      });
      await fetchAllData(workerId);
      showNotice(
        'success',
        `Área de ingreso actualizada a ${res.data.areaLabel}. Cursos obligatorios asignados automáticamente.`
      );
    } catch (err: any) {
      showNotice('error', err.message || 'No se pudo actualizar el área de ingreso.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGaritaQr = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? garitaVerifyCode).trim();
    if (!code) {
      showNotice('error', 'Ingresa un DNI de 8 dígitos para consultar el estado de habilitación.');
      return;
    }
    if (codeToVerify) setGaritaVerifyCode(codeToVerify);
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/badges/verify/${encodeURIComponent(code)}`).then((r) => r.json());
      if (res.success) {
        setGaritaVerifyResult(res.data);
        if (res.data.accessGranted) {
          showNotice('success', `GARITA: Acceso autorizado para ${res.data.worker?.fullName}.`);
        } else {
          showNotice('error', res.data.reason);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsvReport = () => {
    if (workers.length === 0) return;
    const headers = [
      'DNI',
      'Trabajador',
      'Empresa_ECM',
      'Puesto',
      'Estadia',
      'Zona',
      'Semaforo_Global',
      'Docs_Verde',
      'Docs_Obligatorios',
      'ELearning_Aprobado',
      'Codigo_Carnet_QR',
      'Estado_Fotocheck_PVC',
      'Diagnostico',
    ];
    const rows = workers.map((w) => {
      const mandatory = w.documents.filter((d) => d.requirement.isMandatory);
      const green = mandatory.filter((d) => d.status === 'VERDE').length;
      return [
        w.dni,
        `"${w.fullName}"`,
        `"${w.contractor.companyName}"`,
        w.jobPosition,
        w.stayType,
        w.accessZone,
        w.trafficLight,
        green,
        mandatory.length,
        w.elearningPassed ? 'SI' : 'NO',
        w.digitalBadge?.badgeCode || 'SIN_EMITIR',
        w.digitalBadge?.pvcPrintStatus || 'N/A',
        `"${w.statusSummary.replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_semaforo_bateas_zerotouch_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadElearningCertificate = (w: Worker) => {
    const content = [
      '========================================================================',
      'MINERA BATEAS S.A.C. — PLATAFORMA BATEAS ZERO-TOUCH (EQUIPO MYOPIA)',
      'CERTIFICADO DIGITAL DE INDUCCIÓN TEÓRICA ASÍNCRONA (E-LEARNING 24/7)',
      '========================================================================',
      `Trabajador Afiliado : ${w.fullName}`,
      `DNI                 : ${w.dni}`,
      `Empresa Contratista : ${w.contractor.companyName}`,
      `Puesto / Estadía    : ${w.jobPosition} / ${w.stayType}`,
      `Código de Sesión    : ${w.sessionCode}`,
      'Módulos Aprobados   : 1. Seguridad y Salud Ocupacional (SSOMA)',
      '                      2. Gestión Ambiental y Segregación NTP',
      `Estado Evaluación   : APROBADO (>= 75%)`,
      `Semáforo Operativo  : ${w.trafficLight}`,
      `Fecha de Emisión    : ${new Date().toLocaleString('es-PE')}`,
      '========================================================================',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificado_ELearning_${w.dni}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDocExpiringWithin20Days = (expiryDateStr: string | null) => {
    if (!expiryDateStr) return false;
    const exp = new Date(expiryDateStr).getTime();
    const now = Date.now();
    const in20d = now + 20 * 24 * 60 * 60 * 1000;
    return exp >= now && exp <= in20d;
  };

  const renderTrafficPill = (status: TrafficLight | DocStatus, size: 'sm' | 'md' = 'sm') => {
    const base = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';
    if (status === 'VERDE') {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${base}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Habilitado
        </span>
      );
    }
    if (status === 'ROJO') {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-semibold bg-rose-50 text-rose-700 border border-rose-200 ${base}`}
        >
          <XCircle className="w-3.5 h-3.5" /> Bloqueado
        </span>
      );
    }
    if (status === 'AMBAR') {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${base}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Observado
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${base}`}
      >
        <Clock className="w-3.5 h-3.5" /> Pendiente
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
        return 'Inicio / Afiliación / Afiliados y Pre-validación OCR';
      case 'AFILIACION_EXCEPCIONES':
        return 'Inicio / Afiliación / Bandeja de Excepciones (SSOMA · Área Médica · DHO)';
      case 'AFILIACION_ELEARNING':
        return 'Inicio / Afiliación / Inducciones E-Learning';
      case 'AFILIACION_DOCS_ESTADIA':
        return 'Inicio / Afiliación / Documentos por estadía';
      case 'AFILIACION_LISTA_NEGRA':
        return 'Inicio / Afiliación / Lista negra';
      case 'ACCESOS_CARNET_QR':
        return 'Inicio / Control de Acceso / Estado de Habilitación por DNI';
      case 'SSOMA_CMS_CAPACITACION':
        return 'Inicio / Administración SSOMA / Gestor CMS de Capacitación';
      case 'SSOMA_TORRE_CONTROL':
        return 'Inicio / Administración SSOMA / Torre de Control y Biometría';
      case 'SSOMA_INTEGRACIONES':
        return 'Inicio / Administración SSOMA / Integraciones EMO y SCTR';
      case 'SSOMA_GESTION_CAPACITACIONES':
        return 'Inicio / Administración SSOMA / Gestión de Capacitaciones por Área';
      case 'SSOMA_SEGUIMIENTO_REPORTES':
        return 'Inicio / Administración SSOMA / Seguimiento y Reportes';
    }
  };

  if (sessionSplash) {
    return <BrandLoadingScreen role={sessionSplash.role} userName={sessionSplash.userName} />;
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans">
        <TopProgressBar active={loginLoading} />
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
          {/* Header Corporativo Login */}
          <div className="bg-slate-900 p-6 text-center text-white space-y-2 border-b border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto shadow-xs">
              B
            </div>
            <h1 className="text-lg font-bold tracking-tight">App Bateas v3.0 · Zero-Touch</h1>
            <p className="text-xs text-slate-300">
              Sistema de Recursos Humanos y Habilitación Inteligente de Contratistas — Minera Bateas S.A.C.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4 text-xs">
            {loginError && (
              <div className="p-3 rounded bg-rose-50 border border-rose-300 text-rose-800 font-semibold">
                {loginError}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Correo / Usuario Corporativo</label>
              <input
                type="email"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="usuario@bateas.pe"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Contraseña de Acceso</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                required
              />
            </div>

            <LoadingButton
              type="submit"
              variant="primary"
              isLoading={loginLoading}
              loadingText="Verificando credenciales..."
              className="w-full py-3 min-h-[44px] text-sm rounded-xl"
            >
              Ingresar a la Plataforma
            </LoadingButton>

            {/* Acordeón discreto cerrado por defecto para accesos demo */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <button
                type="button"
                onClick={() => setShowLoginDemoQuickAccess((prev) => !prev)}
                aria-expanded={showLoginDemoQuickAccess}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
                <span>¿Modo demostración? Ver accesos rápidos</span>
                {showLoginDemoQuickAccess ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {showLoginDemoQuickAccess && (
                <div className="space-y-2.5 bateas-fade-in">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginUsername('ecm@bateas.pe');
                        setLoginPassword('Bateas2026!');
                      }}
                      className={`p-2.5 min-h-[54px] rounded-xl border text-left transition flex flex-col justify-center cursor-pointer ${
                        loginUsername === 'ecm@bateas.pe'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                        <HardHat className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        Admin ECM
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                        ecm@bateas.pe
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginUsername('ssoma@bateas.pe');
                        setLoginPassword('Bateas2026!');
                      }}
                      className={`p-2.5 min-h-[54px] rounded-xl border text-left transition flex flex-col justify-center cursor-pointer ${
                        loginUsername === 'ssoma@bateas.pe'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        SSOMA / DHO
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                        ssoma@bateas.pe
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginUsername('garita@bateas.pe');
                        setLoginPassword('Bateas2026!');
                      }}
                      className={`p-2.5 min-h-[54px] rounded-xl border text-left transition flex flex-col justify-center cursor-pointer ${
                        loginUsername === 'garita@bateas.pe'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                        <IdCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        Control de Acceso
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                        garita@bateas.pe
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginUsername('trabajador@bateas.pe');
                        setLoginPassword('Bateas2026!');
                      }}
                      className={`p-2.5 min-h-[54px] rounded-xl border text-left transition flex flex-col justify-center cursor-pointer ${
                        loginUsername === 'trabajador@bateas.pe'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        Trabajador
                      </span>
                      <span className="block text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                        trabajador@bateas.pe
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] text-center text-slate-400">
                    Contraseña de prueba: <strong className="text-slate-600">Bateas2026!</strong>
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>

        {pendingBiometricUser && pendingBiometricUser.workerId && (
          <BiometricModal
            workerId={pendingBiometricUser.workerId}
            workerName={pendingBiometricUser.fullName}
            token={pendingBiometricUser.token}
            onSuccess={() => {
              const u = pendingBiometricUser;
              setPendingBiometricUser(null);
              completeLoginSession(u);
            }}
            onCancel={() => setPendingBiometricUser(null)}
          />
        )}
      </div>
    );
  }

  // MÓDULO 1: Interfaz Aislada del Rol TRABAJADOR (Sin Sidebar Administrativo)
  if (authUser.strictRole === 'TRABAJADOR') {
    return (
      <WorkerPortal
        authUser={authUser}
        accessDeniedMessage={accessDeniedMsg}
        onDismissAccessDenied={() => setAccessDeniedMsg(null)}
        onLogout={handleLogout}
      />
    );
  }

  // Vista Aislada SIN Sidebar para Control de Acceso (Garita por DNI)
  if (authUser.strictRole === 'GARITA') {
    return (
      <GaritaAccessPortal
        authUser={authUser}
        workers={workers}
        isInitialLoading={loading && workers.length === 0}
        standalone
        onRefresh={() => fetchAllData()}
        onUpdatePvcStatus={handleUpdatePvcStatus}
        onLogout={handleLogout}
      />
    );
  }

  const isEcmMode = authUser.strictRole === 'ECM' || activeRoleLabel === 'ADMIN_ECM';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-800 font-sans">
      <TopProgressBar active={loading} />
      <SmartProcessLoader
        active={Boolean(smartLoaderMode)}
        mode={smartLoaderMode || 'default'}
        variant="overlay"
      />
      <DemoModeDrawer
        open={showDemoDrawer}
        onClose={() => setShowDemoDrawer(false)}
        loading={loading}
        activeRoleLabel={activeRoleLabel}
        showRowSimulators={showRowSimulators}
        onToggleRowSimulators={() => setShowRowSimulators((prev) => !prev)}
        onSwitchRoleView={(role) => {
          setActiveRoleLabel(role);
          if (role === 'ADMIN_ECM') setActiveNav('AFILIACION_AFILIADOS');
          else if (role === 'SSOMA_DHO') setActiveNav('AFILIACION_EXCEPCIONES');
          else setActiveNav('ACCESOS_CARNET_QR');
        }}
        onCreateDemoScenario={handleCreateDemoScenario}
      />

      {/* ==========================================================================
          SIDEBAR IZQUIERDO CORPORATIVO — APP BATEAS v3.0
      ========================================================================== */}
      <aside className="w-64 bg-[#1E293B] text-slate-300 flex flex-col shrink-0 select-none border-r border-slate-800">
        {/* Brand Header */}
        <div className="h-14 bg-[#0F172A] px-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
              B
            </div>
            <div>
              <span className="font-bold text-white text-sm tracking-tight block leading-none">App Bateas</span>
              <span className="text-[10px] text-emerald-400 font-medium">
                {isEcmMode ? 'Portal Contratista ECM' : 'v3.0 · Zero-Touch'}
              </span>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
            {isEcmMode ? 'ECM' : 'Web'}
          </span>
        </div>

        {/* Menú Lateral Filtrado por Rol RBAC */}
        <nav className="flex-1 py-3 text-xs space-y-0.5 overflow-y-auto">
          {!isEcmMode && (
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
          )}

          {/* Grupo Afiliaciones */}
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

                {!isEcmMode && (
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
                )}

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

                {!isEcmMode && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>

          {/* Estado de Habilitación (disponible para ECM y SSOMA) */}
          <button
            onClick={() => setActiveNav('ACCESOS_CARNET_QR')}
            className={`w-full px-4 py-2.5 flex items-center justify-between transition cursor-pointer ${
              activeNav === 'ACCESOS_CARNET_QR'
                ? 'bg-[#1e282c] text-white border-l-4 border-sky-400 font-bold'
                : 'hover:bg-[#1e282c] text-slate-300'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Estado de Habilitación</span>
            </span>
            {metrics?.greenCount > 0 && (
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 rounded">{metrics.greenCount}</span>
            )}
          </button>

          {!isEcmMode && (
            <>
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

              {/* Módulos Administrativos SSOMA (Exclusivos SSOMA/DHO) */}
              <div className="pt-3 mt-3 border-t border-slate-700/60 px-4">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-1.5">
                  Torre SSOMA · D.S. 024-2016-EM
                </p>
              </div>
              <button
                onClick={() => setActiveNav('SSOMA_TORRE_CONTROL')}
                className={`w-full px-4 py-2.5 flex items-center justify-between transition cursor-pointer ${
                  activeNav === 'SSOMA_TORRE_CONTROL'
                    ? 'bg-[#1e282c] text-white border-l-4 border-amber-400 font-bold'
                    : 'hover:bg-[#1e282c] text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span>Torre Control 32h / Bio</span>
                </span>
                {metrics?.biometricIncidentsCount > 0 && (
                  <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 rounded-full">
                    {metrics.biometricIncidentsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveNav('SSOMA_CMS_CAPACITACION')}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
                  activeNav === 'SSOMA_CMS_CAPACITACION'
                    ? 'bg-[#1e282c] text-white border-l-4 border-indigo-400 font-bold'
                    : 'hover:bg-[#1e282c] text-slate-300'
                }`}
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>CMS Capacitación 32h</span>
              </button>
              <button
                onClick={() => setActiveNav('SSOMA_INTEGRACIONES')}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
                  activeNav === 'SSOMA_INTEGRACIONES'
                    ? 'bg-[#1e282c] text-white border-l-4 border-sky-400 font-bold'
                    : 'hover:bg-[#1e282c] text-slate-300'
                }`}
              >
                <Webhook className="w-4 h-4 text-sky-400" />
                <span>Integraciones EMO/SCTR</span>
              </button>
              <button
                onClick={() => setActiveNav('SSOMA_GESTION_CAPACITACIONES')}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
                  activeNav === 'SSOMA_GESTION_CAPACITACIONES'
                    ? 'bg-[#1e282c] text-white border-l-4 border-emerald-400 font-bold'
                    : 'hover:bg-[#1e282c] text-slate-300'
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Gestión de Capacitaciones</span>
              </button>
              <button
                onClick={() => setActiveNav('SSOMA_SEGUIMIENTO_REPORTES')}
                className={`w-full px-4 py-2.5 flex items-center gap-2.5 transition cursor-pointer ${
                  activeNav === 'SSOMA_SEGUIMIENTO_REPORTES'
                    ? 'bg-[#1e282c] text-white border-l-4 border-teal-400 font-bold'
                    : 'hover:bg-[#1e282c] text-slate-300'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-teal-400" />
                <span>Seguimiento y Reportes</span>
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
            </>
          )}
        </nav>

        {/* Indicador discreto de estado de servicios con tooltip informativo */}
        <div className="px-4 py-3 bg-[#0F172A]/80 border-t border-slate-800">
          <div
            className="inline-flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-help"
            title="Servicios activos · Motor OCR (<2s) · Base de datos conectada · Servidor MCP activo"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium">Servicios conectados</span>
          </div>
        </div>
      </aside>

      {/* ==========================================================================
          CONTENEDOR DERECHO WEB (TOPBAR LIMPIA + BREADCRUMB + WORKSPACE)
      ========================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER LIMPIO */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <button
              onClick={() => setActiveNav(isEcmMode ? 'AFILIACION_AFILIADOS' : 'INICIO_ACCESO_DIRECTO')}
              className="hover:text-slate-900 font-semibold transition cursor-pointer"
            >
              {isEcmMode ? 'Afiliados' : 'Inicio'}
            </button>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => fetchAllData(selectedWorker?.id)}
              className="hover:text-slate-900 inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-700' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>

          {/* Acciones derechas del header: Modo Demo discreto + Copiloto IA + Usuario */}
          <div className="flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setShowDemoDrawer(true)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 font-medium inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
              title="Abrir panel de herramientas de demostración"
            >
              <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
              <span>Modo Demo</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCopilot(!showCopilot)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Copiloto Gemini IA</span>
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <span className="hidden md:inline font-semibold text-slate-700">
              {authUser?.fullName}
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-600 hover:text-rose-700 border border-slate-200 font-medium inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* BARRA DE TÍTULO Y BREADCRUMB LIMPIA (SIN CONTROLES DEMO FIJOS) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Sistema de Recursos Humanos</h1>
            <p className="text-xs text-slate-500 mt-0.5">{getBreadcrumb()}</p>
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

                    {/* Tarjeta 4: Estado de Habilitación por DNI */}
                    <div className="rounded border-2 border-sky-600 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                      <div>
                        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800">Estado de Habilitación</h3>
                          <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                            CONTROL DNI
                          </span>
                        </div>
                        <div className="h-32 bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center relative border-b border-slate-100">
                          <ShieldCheck className="w-14 h-14 text-sky-700" />
                          <span className="absolute bottom-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                            Habilitado / Pendiente
                          </span>
                        </div>
                        <p className="p-4 text-xs text-slate-600 leading-relaxed">
                          Consulta el Estado de Habilitación asociado al DNI y Área de Ingreso del trabajador para validar su acceso a unidad minera.
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
                      <div className="p-4 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] font-semibold uppercase text-slate-500">Total de Afiliados</span>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalWorkers}</p>
                        <span className="text-[11px] text-slate-500">Padrón activo registrado</span>
                      </div>
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60">
                        <span className="text-[11px] font-semibold uppercase text-emerald-800">Semáforo Verde</span>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.greenCount}</p>
                        <span className="text-[11px] text-emerald-700">Habilitados en &lt; 48h</span>
                      </div>
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60">
                        <span className="text-[11px] font-semibold uppercase text-amber-800">Semáforo Ámbar</span>
                        <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.amberCount}</p>
                        <span className="text-[11px] text-amber-700">En Bandeja de Excepciones</span>
                      </div>
                      <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/60">
                        <span className="text-[11px] font-semibold uppercase text-rose-800">Semáforo Rojo</span>
                        <p className="text-2xl font-bold text-rose-700 mt-1">{metrics.redCount}</p>
                        <span className="text-[11px] text-rose-700">Doc Vencido / Lista Negra</span>
                      </div>
                      <div className="p-4 rounded-xl border border-slate-200 bg-white">
                        <span className="text-[11px] font-semibold uppercase text-slate-500">Pre-Aprobación OCR</span>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.automationRatePercent}%</p>
                        <span className="text-[11px] text-slate-500">Sin intervención humana</span>
                      </div>
                    </div>
                  )}

                  {/* Gráficos de Dona Comparativos (Réplica de Figura 2 del Entregable 2) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dona 1: Diagnóstico Empírico AS-IS */}
                    <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                      <div className="border-b border-slate-100 pb-3 min-h-[60px] flex flex-col justify-center">
                        <h3 className="text-sm font-bold text-slate-800">
                          Situación Afiliados Contratas — Diagnóstico Base (AS-IS: 3,585)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Evidencia base recolectada en el Panel de Control de Minera Bateas
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

                    {/* Dona 2: Situación en Tiempo Real TO-BE */}
                    <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
                      <div className="border-b border-slate-100 pb-3 min-h-[60px] flex flex-col justify-center">
                        <h3 className="text-sm font-bold text-slate-800">
                          Situación en Tiempo Real (TO-BE · Motor Zero-Touch)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
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
                                    <span className="text-lg font-black text-emerald-700">
                                      {metrics.automationRatePercent}%
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold">Zero-Touch</span>
                                  </div>
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                                    <span>
                                      <strong>{pluralize(metrics.greenCount, 'expediente')} en Verde</strong> (Habilitado)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" />
                                    <span>
                                      <strong>{pluralize(metrics.amberCount, 'expediente')} en Ámbar</strong> (Gestión por
                                      Excepción)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" />
                                    <span>
                                      <strong>{pluralize(metrics.redCount, 'expediente')} en Rojo</strong> (Bloqueo preventivo)
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
                <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-sm text-slate-800">Padrón de Afiliados (ECM)</h2>
                    <p className="text-[11px] text-slate-500">Seleccione un trabajador para gestionar su expediente</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleExportCsvReport}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer"
                      title="Exportar padrón y Semáforo a CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                      onClick={() => setShowNewWorkerModal(true)}
                      className="px-3 py-1.5 bg-[#28a745] hover:bg-emerald-600 text-white text-xs font-bold rounded flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nuevo
                    </button>
                  </div>
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
                    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderTrafficPill(selectedWorker.trafficLight, 'md')}
                            <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                              DNI: {selectedWorker.dni}
                            </span>
                            <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                              {formatJobProfile(selectedWorker.jobPosition)}
                            </span>
                            <span className="text-xs font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 inline-flex items-center gap-1.5">
                              <span>Área:</span>
                              {(authUser.strictRole === 'SSOMA' || authUser.strictRole === 'ECM') ? (
                                <select
                                  value={selectedWorker.accessZone}
                                  onChange={(e) => handleChangeWorkerArea(selectedWorker.id, e.target.value)}
                                  className="bg-white border border-emerald-200 rounded-md px-1.5 py-0.5 text-xs font-semibold text-emerald-900 cursor-pointer focus:outline-none"
                                  title="Cambiar Área de Ingreso (asigna cursos automáticamente)"
                                >
                                  {ACCESS_AREA_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <strong>{getAreaLabel(selectedWorker.accessZone)}</strong>
                              )}
                            </span>
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 pt-1">{selectedWorker.fullName}</h2>
                          <p className="text-xs text-slate-500">
                            Contratista (ECM): <strong className="text-slate-700">{selectedWorker.contractor.companyName}</strong> · Estadía: {formatStayType(selectedWorker.stayType)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {(authUser.strictRole === 'SSOMA' || authUser.strictRole === 'ECM') && (
                            <button
                              type="button"
                              onClick={() => setShowCvProfileModal(true)}
                              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" /> Perfil CV Estructurado
                            </button>
                          )}
                          {!selectedWorker.isBlacklisted && (
                            <button
                              type="button"
                              onClick={() => setActiveNav('AFILIACION_ELEARNING')}
                              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                              {selectedWorker.elearningPassed ? 'E-Learning (Aprobado)' : 'E-Learning'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setActiveNav('ACCESOS_CARNET_QR')}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            Estado de Habilitación
                          </button>
                        </div>
                      </div>

                      {/* Diagnóstico limpio */}
                      <div
                        className={`px-4 py-3 rounded-xl border text-xs font-medium flex flex-wrap items-center justify-between gap-2 ${
                          selectedWorker.trafficLight === 'VERDE'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                            : selectedWorker.trafficLight === 'ROJO'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-800'
                            : 'bg-amber-50/70 border-amber-200 text-amber-800'
                        }`}
                      >
                        <span>{selectedWorker.statusSummary}</span>
                        {selectedWorker.trafficLight === 'AMBAR' && (
                          <button
                            type="button"
                            onClick={() => setActiveNav('AFILIACION_EXCEPCIONES')}
                            className="font-semibold underline underline-offset-2 cursor-pointer"
                          >
                            Revisar en Excepciones →
                          </button>
                        )}
                      </div>
                    </div>

                    {/* STEPPER HORIZONTAL UNIFICADO DE 2 PASOS (SIN DUPLICACIÓN) */}
                    {(() => {
                      const phase1Docs = selectedWorker.documents.filter((d) =>
                        ['DNI', 'CV_DOC'].includes(d.requirement.code)
                      );
                      const phase2Docs = selectedWorker.documents.filter(
                        (d) => !['DNI', 'CV_DOC'].includes(d.requirement.code)
                      );
                      const isPhase1Approved =
                        phase1Docs.length > 0 && phase1Docs.every((d) => d.status === 'VERDE');
                      const phase1GreenCount = phase1Docs.filter((d) => d.status === 'VERDE').length;
                      const phase2GreenCount = phase2Docs.filter((d) => d.status === 'VERDE').length;
                      const currentDocs = activeAffiliateStep === 1 ? phase1Docs : phase2Docs;

                      return (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          {/* Stepper horizontal limpio */}
                          <div className="p-5 border-b border-slate-200 bg-slate-50/60">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setActiveAffiliateStep(1)}
                                className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${
                                  activeAffiliateStep === 1
                                    ? 'bg-white border-emerald-600 ring-1 ring-emerald-500/30 shadow-2xs'
                                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                      isPhase1Approved
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : activeAffiliateStep === 1
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    {isPhase1Approved ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                                  </span>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      Paso 1: Primer Filtro (DNI + CV)
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[11px] text-slate-500">
                                        {phase1GreenCount} de {phase1Docs.length} aprobados
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                          isPhase1Approved
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}
                                      >
                                        {isPhase1Approved ? 'Aprobado' : 'En revisión'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </button>

                              {(() => {
                                const phase2AllApproved =
                                  isPhase1Approved &&
                                  phase2Docs.length > 0 &&
                                  phase2Docs.every((d) => d.status === 'VERDE');
                                const phase2HasRed =
                                  isPhase1Approved && phase2Docs.some((d) => d.status === 'ROJO');
                                const phase2HasAmber =
                                  isPhase1Approved && phase2Docs.some((d) => d.status === 'AMBAR');
                                const phase2Badge = !isPhase1Approved
                                  ? {
                                      label: 'Bloqueada',
                                      cls: 'bg-slate-100 text-slate-500 border-slate-200',
                                    }
                                  : phase2AllApproved
                                  ? {
                                      label: 'Completada',
                                      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                    }
                                  : phase2HasRed
                                  ? {
                                      label: 'Observada',
                                      cls: 'bg-rose-50 text-rose-700 border-rose-200',
                                    }
                                  : phase2HasAmber
                                  ? {
                                      label: 'Con pendientes',
                                      cls: 'bg-amber-50 text-amber-700 border-amber-200',
                                    }
                                  : {
                                      label: 'Desbloqueada',
                                      cls: 'bg-slate-100 text-slate-700 border-slate-200',
                                    };
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setActiveAffiliateStep(2)}
                                    className={`p-4 rounded-xl border text-left transition-all duration-200 flex items-start justify-between gap-3 cursor-pointer ${
                                      activeAffiliateStep === 2
                                        ? 'bg-white border-emerald-600 ring-1 ring-emerald-500/30 shadow-2xs'
                                        : 'bg-white/70 border-slate-200 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <span
                                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                                          !isPhase1Approved
                                            ? 'bg-slate-100 text-slate-400'
                                            : activeAffiliateStep === 2
                                            ? 'bg-emerald-700 text-white'
                                            : 'bg-emerald-50 text-emerald-700'
                                        }`}
                                      >
                                        {!isPhase1Approved ? <Lock className="w-3.5 h-3.5" /> : '2'}
                                      </span>
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <p className="text-xs font-bold text-slate-900 leading-snug">
                                          Paso 2: Habilitación (EMO, SCTR y Certificados)
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-[11px] text-slate-500">
                                            {isPhase1Approved
                                              ? `${phase2GreenCount} de ${phase2Docs.length} aprobados`
                                              : 'Se desbloquea al completar el Paso 1'}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${phase2Badge.cls}`}
                                          >
                                            {phase2Badge.label}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Tabla limpia del paso seleccionado */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] border-b border-slate-200">
                                  <th className="py-3 px-4 font-semibold">Requisito</th>
                                  <th className="py-3 px-3 font-semibold">Validación OCR</th>
                                  <th className="py-3 px-3 font-semibold">Estado</th>
                                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {currentDocs.map((doc) => {
                                  const canUpload =
                                    !selectedWorker.isBlacklisted &&
                                    (activeAffiliateStep === 1 || isPhase1Approved);
                                  return (
                                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-semibold text-slate-900">{doc.requirement.name}</p>
                                          {doc.requirement.isMandatory && (
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                              Obligatorio
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                          {activeAffiliateStep === 2 && !isPhase1Approved && doc.status === 'PENDIENTE'
                                            ? 'En espera de aprobación del Paso 1 (DNI + CV)'
                                            : doc.statusReason}
                                        </p>
                                        {doc.fileName && (
                                          <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <FileText className="w-3 h-3" /> {doc.fileName}
                                          </span>
                                        )}
                                      </td>

                                      <td className="py-3.5 px-3 text-[11px] text-slate-600 space-y-0.5">
                                        {doc.requirement.requiresValidity && (
                                          <div>
                                            Vigencia:{' '}
                                            <strong className="text-slate-800">
                                              {doc.detectedExpiryDate
                                                ? String(doc.detectedExpiryDate).split('T')[0]
                                                : '—'}
                                            </strong>
                                          </div>
                                        )}
                                        {isDocExpiringWithin20Days(doc.detectedExpiryDate) && (
                                          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px]">
                                            Vence en &lt;20 días
                                          </span>
                                        )}
                                        <div>DNI leído: <strong className="text-slate-800">{doc.detectedDni || '—'}</strong></div>
                                      </td>

                                      <td className="py-3.5 px-3">{renderTrafficPill(doc.status)}</td>

                                      <td className="py-3.5 px-4 text-right">
                                        {canUpload ? (
                                          <div className="flex flex-col items-end gap-1.5">
                                            <div className="flex items-center gap-1.5">
                                              <label
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all duration-200 ${
                                                  doc.status === 'PENDIENTE' || doc.status === 'ROJO'
                                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
                                                }`}
                                              >
                                                <Upload className="w-3.5 h-3.5" /> Subir PDF/Img
                                                <input
                                                  type="file"
                                                  accept=".pdf,.png,.jpg,.jpeg"
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleFileUpload(selectedWorker.id, doc.requirementId, f);
                                                    e.target.value = '';
                                                  }}
                                                />
                                              </label>
                                              {doc.extractedText && (
                                                <button
                                                  type="button"
                                                  onClick={() => setInspectedDoc(doc)}
                                                  className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg cursor-pointer transition"
                                                  title="Ver detalle OCR"
                                                >
                                                  <Eye className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </div>

                                              {showRowSimulators && (
                                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'VALID')}
                                                    className="px-2 py-0.5 text-[10px] font-medium bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 rounded-md transition cursor-pointer"
                                                  >
                                                    Simular Vigente
                                                  </button>
                                                  {doc.requirement.code === 'CV_DOC' && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'CV_MISMATCH')}
                                                      className="px-2 py-0.5 text-[10px] font-medium bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 rounded-md transition cursor-pointer"
                                                    >
                                                      Sin Especialidad
                                                    </button>
                                                  )}
                                                  {doc.requirement.requiresValidity && (
                                                    <>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'UNCERTAIN')}
                                                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 rounded-md transition cursor-pointer"
                                                      >
                                                        Observado
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleQuickOcrSimulate(selectedWorker, doc, 'EXPIRED')}
                                                        className="px-2 py-0.5 text-[10px] font-medium bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 rounded-md transition cursor-pointer"
                                                      >
                                                        Vencido
                                                      </button>
                                                    </>
                                                  )}
                                                </div>
                                              )}
                                          </div>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium">
                                            <Lock className="w-3 h-3" /> Requiere Paso 1
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bitácora de Auditoría e Historial Transaccional del Expediente (Spec 02 y Spec 05) */}
                    {selectedWorker.auditLogs && selectedWorker.auditLogs.length > 0 && (
                      <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
                        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                            Bitácora Inmutable de Auditoría y Eventos Zero-Touch (PostgreSQL)
                          </h3>
                          <span className="text-[11px] text-slate-500">
                            {selectedWorker.auditLogs.length} evento(s) registrados
                          </span>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto text-xs">
                          {selectedWorker.auditLogs.map((log) => (
                            <div key={log.id} className="px-5 py-2.5 flex items-start justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 mr-2">
                                  {log.actorArea}
                                </span>
                                <strong className="text-slate-800">{log.action}:</strong>{' '}
                                <span className="text-slate-600">{log.details}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {new Date(log.createdAt).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
            <div className="space-y-5">
              {/* Barra Superior de Filtros por Área Revisora */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Bandeja de Gestión por Excepciones
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Auditoría focalizada (SSOMA · Área Médica · DHO). Los documentos legibles y vigentes se aprueban
                    automáticamente; aquí solo ingresan casos en estado Observado.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['ALL', 'SSOMA', 'AREA_MEDICA', 'DHO', 'AREA_USUARIA'] as const).map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => setAreaFilter(area)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                        areaFilter === area
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {area === 'ALL'
                        ? 'Todas las Áreas'
                        : area === 'AREA_MEDICA'
                        ? 'Área Médica'
                        : area === 'AREA_USUARIA'
                        ? 'Área Usuaria'
                        : area}
                    </button>
                  ))}
                </div>
              </div>

              {filteredExceptions.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Sin excepciones pendientes para el área seleccionada
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Todos los documentos obligatorios fueron pre-validados automáticamente o ya fueron resueltos. Si
                    necesitas probar un flujo de auditoría, abre el botón &ldquo;Modo Demo&rdquo; en la barra superior.
                  </p>
                </div>
              ) : (
                /* LAYOUT SPLIT-SCREEN: Cola a la izquierda (5 cols) | Datos Detectados + Dictamen a la derecha (7 cols) */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Lista de Tickets en ÁMBAR */}
                  <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden h-fit">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Cola de Documentos Observados</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        {pluralize(filteredExceptions.length, 'ticket')}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {filteredExceptions.map((ex) => {
                        const isSelected = activeException?.id === ex.id;
                        return (
                          <div
                            key={ex.id}
                            onClick={() => {
                              setSelectedExceptionId(ex.id);
                              setShowRawOcrText(false);
                            }}
                            className={`p-4 cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'bg-amber-50/60 border-l-4 border-l-amber-500'
                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                {formatAreaName(ex.assignedArea)}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                DNI: {ex.workerDocument.worker.dni}
                              </span>
                            </div>
                            <h4 className="font-semibold text-xs text-slate-900 mt-2">
                              {ex.workerDocument.requirement.name}
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {ex.workerDocument.worker.fullName}
                            </p>
                            <p className="text-[11px] text-amber-700 mt-1.5 line-clamp-2">{ex.reasonTriggered}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inspector Split-Screen del Ticket Seleccionado */}
                  {activeException && (
                    <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-3.5">
                      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                            Inspector Documental · Área: {formatAreaName(activeException.assignedArea)}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            {activeException.workerDocument.requirement.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            <strong className="text-slate-700">
                              {activeException.workerDocument.worker.fullName}
                            </strong>{' '}
                            (DNI: {activeException.workerDocument.worker.dni}) · ECM:{' '}
                            {activeException.workerDocument.worker.contractor.companyName}
                          </p>
                        </div>
                        {renderTrafficPill('AMBAR', 'md')}
                      </div>

                      {/* Anomalía + Botón IA (Acento Indigo exclusivo para Gemini) */}
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1 min-w-[220px]">
                          <p className="font-semibold text-amber-800">Motivo de observación OCR</p>
                          <p className="mt-0.5 text-amber-900/90">{activeException.reasonTriggered}</p>
                        </div>
                        <LoadingButton
                          type="button"
                          variant="ai"
                          isLoading={aiAuditLoading}
                          loadingText="Analizando..."
                          onClick={() =>
                            handleRunGeminiDocAudit(activeException.workerDocument.id, activeException.id)
                          }
                          icon={<Sparkles className="w-3.5 h-3.5" />}
                        >
                          Analizar con Gemini IA
                        </LoadingButton>
                      </div>

                      <SmartProcessLoader active={aiAuditLoading} mode="gemini" />

                      {aiAuditSuggestion[activeException.workerDocument.id] && (
                        <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-1 bateas-fade-in">
                          <div className="flex items-center gap-1.5 font-semibold text-indigo-700">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              Dictamen Gemini IA ({aiAuditSuggestion[activeException.workerDocument.id].modelUsed})
                            </span>
                          </div>
                          <p className="text-indigo-900 leading-relaxed">
                            {aiAuditSuggestion[activeException.workerDocument.id].summaryReason}
                          </p>
                        </div>
                      )}

                      {/* Tarjeta Clara de Datos Detectados + Acordeón colapsable "Ver texto crudo OCR" */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between bg-white">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <h4 className="text-xs font-bold text-slate-900">Datos detectados</h4>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              (activeException.workerDocument.ocrConfidence || 75) >= 85
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            Confianza OCR: {activeException.workerDocument.ocrConfidence || 75}%
                          </span>
                        </div>

                        <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
                            <span className="block text-[10px] font-medium text-slate-500">DNI detectado</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block">
                              {activeException.workerDocument.detectedDni ||
                                activeException.workerDocument.worker.dni}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
                            <span className="block text-[10px] font-medium text-slate-500">Vigencia detectada</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block">
                              {activeException.workerDocument.detectedExpiryDate
                                ? String(activeException.workerDocument.detectedExpiryDate).slice(0, 10)
                                : 'Confirmación manual'}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
                            <span className="block text-[10px] font-medium text-slate-500">Archivo analizado</span>
                            <span className="font-semibold text-slate-800 mt-0.5 block truncate" title={activeException.workerDocument.fileName || ''}>
                              {activeException.workerDocument.fileName || 'documento_adjunto.pdf'}
                            </span>
                          </div>
                          <div className="bg-white rounded-lg border border-slate-200/80 p-2.5">
                            <span className="block text-[10px] font-medium text-slate-500">Método OCR</span>
                            <span className="font-semibold text-slate-800 mt-0.5 block">
                              {activeException.workerDocument.extractionMethod || 'OCR Automático'}
                            </span>
                          </div>
                        </div>

                        {/* Acordeón colapsado por defecto para texto crudo OCR */}
                        <div className="border-t border-slate-200/80 bg-white">
                          <button
                            type="button"
                            onClick={() => setShowRawOcrText((prev) => !prev)}
                            className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span>Ver texto crudo OCR</span>
                            {showRawOcrText ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          {showRawOcrText && (
                            <div className="px-4 pb-3 bateas-fade-in">
                              <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-40 leading-relaxed">
                                {activeException.workerDocument.extractedText || 'Sin texto legible extraído.'}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Formulario de Dictamen Humano con barra fija visible */}
                      {(() => {
                        const fState = resolveForm[activeException.id] || {
                          reviewerName: `Víctor Cayata (${formatAreaName(activeException.assignedArea)})`,
                          comment: 'Verificado manualmente conforme a documento original.',
                          manualDate: '31/12/2026',
                        };
                        return (
                          <div className="space-y-3 pt-2 border-t border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
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
                                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
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
                                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
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
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                              />
                            </div>
                            <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs border-t border-slate-200 -mx-5 px-5 py-3 flex flex-wrap items-center gap-3 rounded-b-xl">
                              <LoadingButton
                                type="button"
                                variant="primary"
                                isLoading={resolvingDecision === 'APPROVED'}
                                loadingText="Aprobando..."
                                disabled={loading}
                                onClick={() => handleResolveException(activeException.id, 'APPROVED')}
                                icon={<CheckCircle2 className="w-4 h-4" />}
                              >
                                Validar y Aprobar Documento
                              </LoadingButton>
                              <LoadingButton
                                type="button"
                                variant="danger"
                                isLoading={resolvingDecision === 'REJECTED'}
                                loadingText="Observando..."
                                disabled={loading}
                                onClick={() => handleResolveException(activeException.id, 'REJECTED')}
                                icon={<XCircle className="w-4 h-4" />}
                              >
                                Observar y Rechazar
                              </LoadingButton>
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
              VISTA 4: TABLA MAESTRA "DOCUMENTOS POR ESTADÍA" (DESIGN SYSTEM v3.0)
          ---------------------------------------------------------------------- */}
          {activeNav === 'AFILIACION_DOCS_ESTADIA' && (() => {
            const filteredRequirements = requirementsMaster.filter(
              (r) =>
                !estadiaSearch.trim() ||
                r.name.toLowerCase().includes(estadiaSearch.toLowerCase()) ||
                r.code.toLowerCase().includes(estadiaSearch.toLowerCase()) ||
                formatStayType(r.stayType).toLowerCase().includes(estadiaSearch.toLowerCase())
            );
            return (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Documentos por Estadía</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Catálogo maestro de requisitos obligatorios, vigencia y área responsable por perfil de ingreso.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    {pluralize(filteredRequirements.length, 'requisito')}
                  </span>
                </div>

                {/* Buscador y acciones homologadas al Design System v3.0 */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={estadiaSearch}
                        onChange={(e) => setEstadiaSearch(e.target.value)}
                        placeholder="Buscar por descripción o tipo de estadía..."
                        className="w-72 sm:w-80 pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                      />
                    </div>
                    <LoadingButton
                      type="button"
                      variant="primary"
                      onClick={() => fetchAllData(selectedWorker?.id)}
                      isLoading={loading}
                      loadingText="Aplicando..."
                    >
                      Aplicar
                    </LoadingButton>
                    {estadiaSearch.trim() && (
                      <LoadingButton
                        type="button"
                        variant="ghost"
                        onClick={() => setEstadiaSearch('')}
                      >
                        Limpiar
                      </LoadingButton>
                    )}
                  </div>

                  <LoadingButton
                    type="button"
                    variant="secondary"
                    onClick={() => fetchAllData(selectedWorker?.id)}
                    isLoading={loading}
                    loadingText="Sincronizando..."
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Sincronizar maestro
                  </LoadingButton>
                </div>

                {/* Tabla Maestra homologada */}
                <div className="rounded-xl border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200">
                        <th className="py-3.5 px-4">#</th>
                        <th className="py-3.5 px-3">Tipo de Estadía</th>
                        <th className="py-3.5 px-3">Descripción</th>
                        <th className="py-3.5 px-3">Perfil / Puesto</th>
                        <th className="py-3.5 px-3 text-center">¿Es obligatorio?</th>
                        <th className="py-3.5 px-3 text-center">¿Requiere vigencia?</th>
                        <th className="py-3.5 px-3">Área Excepción</th>
                        <th className="py-3.5 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRequirements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            No se encontraron requisitos para &ldquo;{estadiaSearch}&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        filteredRequirements.map((r, index) => (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 text-slate-500 font-medium">{index + 1}</td>
                            <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                              {formatStayType(r.stayType)}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900">{r.name}</td>
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                              {formatJobProfile(r.applicableJob)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  r.isMandatory
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {r.isMandatory ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  r.requiresValidity
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {r.requiresValidity ? 'Sí' : 'No'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                              {formatAreaName(r.responsibleArea)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  aria-label="Editar requisito"
                                  title="Editar requisito"
                                  onClick={() =>
                                    showNotice('info', `Configuración del requisito "${r.name}" gestionada por SSOMA.`)
                                  }
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Eliminar requisito"
                                  title="Eliminar requisito"
                                  onClick={() =>
                                    showNotice(
                                      'info',
                                      `Los requisitos normativos D.S. 024-2016-EM están protegidos contra eliminación accidental.`
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

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
          {activeNav === 'SSOMA_CMS_CAPACITACION' && (
            <SsomaControlPanels
              mode="CMS"
              workers={workers}
              token={authUser.token}
              onRefreshAll={fetchAllData}
              onNotice={showNotice}
            />
          )}

          {activeNav === 'SSOMA_TORRE_CONTROL' && (
            <SsomaControlPanels
              mode="CONTROL_TOWER"
              workers={workers}
              token={authUser.token}
              onRefreshAll={fetchAllData}
              onNotice={showNotice}
            />
          )}

          {activeNav === 'SSOMA_INTEGRACIONES' && (
            <SsomaControlPanels
              mode="INTEGRATIONS"
              workers={workers}
              token={authUser.token}
              onRefreshAll={fetchAllData}
              onNotice={showNotice}
            />
          )}

          {activeNav === 'SSOMA_GESTION_CAPACITACIONES' && (
            <CourseManagementPanel
              apiFetch={apiFetch}
              workers={workers.map((w) => ({
                id: w.id,
                fullName: w.fullName,
                dni: w.dni,
                jobPosition: w.jobPosition,
                contractorId: w.contractorId || w.contractor.ruc,
              }))}
              contractors={Array.from(
                new Map(
                  workers.map((w) => [
                    w.contractorId || w.contractor.ruc,
                    { id: w.contractorId || w.contractor.ruc, name: w.contractor.companyName },
                  ])
                ).values()
              )}
              onNotify={(msg) => showNotice('info', msg)}
            />
          )}

          {activeNav === 'SSOMA_SEGUIMIENTO_REPORTES' && (
            <TrackingReportsPanel
              apiFetch={apiFetch}
              contractors={Array.from(
                new Map(
                  workers.map((w) => [
                    w.contractorId || w.contractor.ruc,
                    { id: w.contractorId || w.contractor.ruc, name: w.contractor.companyName },
                  ])
                ).values()
              )}
              onNotify={(msg) => showNotice('info', msg)}
            />
          )}

          {showCvProfileModal && selectedWorker && (
            <WorkerCvProfileModal
              worker={{
                id: selectedWorker.id,
                fullName: selectedWorker.fullName,
                dni: selectedWorker.dni,
                jobPosition: selectedWorker.jobPosition,
              }}
              apiFetch={apiFetch}
              onClose={() => setShowCvProfileModal(false)}
              onNotify={(msg) => showNotice('info', msg)}
            />
          )}

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
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1">
                        <Award className="w-4 h-4" /> APROBADO (≥ 75%)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDownloadElearningCertificate(selectedWorker)}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        📥 Descargar Constancia
                      </button>
                    </div>
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
              VISTA 7: ESTADO DE HABILITACIÓN POR DNI Y ÁREA DE INGRESO (SIN QR)
          ---------------------------------------------------------------------- */}
          {activeNav === 'ACCESOS_CARNET_QR' && (
            <GaritaAccessPortal
              authUser={authUser}
              workers={workers}
              isInitialLoading={loading && workers.length === 0}
              standalone={false}
              onRefresh={() => fetchAllData()}
              onUpdatePvcStatus={handleUpdatePvcStatus}
              onLogout={handleLogout}
            />
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
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Área de Ingreso (asigna cursos obligatorios automáticamente)
                  </label>
                  <select
                    value={regForm.accessZone}
                    onChange={(e) => setRegForm({ ...regForm, accessZone: e.target.value })}
                    className="w-full border border-indigo-300 bg-indigo-50/40 rounded px-3 py-2 font-semibold text-slate-800"
                  >
                    {ACCESS_AREA_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
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
              onClick={() => handleAskCopilot('¿Quiénes están habilitados para ingresar a mina según su DNI y área?')}
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
