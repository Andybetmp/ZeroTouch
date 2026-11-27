import React, { useEffect, useState } from 'react';
import {
  Award,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FastForward,
  FileText,
  Lock,
  LogOut,
  MapPin,
  Monitor,
  Play,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { AuthUser } from '../types/bateas';
import { downloadOfficialCertificatePdf } from '../utils/certificatePdf';
import { pluralize } from '../utils/formatters';
import {
  LoadingButton,
  SkeletonCard,
  SmartProcessLoader,
  TopProgressBar,
} from './ui/LoadingStates';

interface WorkerPortalProps {
  authUser: AuthUser;
  accessDeniedMessage: string | null;
  onDismissAccessDenied: () => void;
  onLogout: () => void;
}

interface CourseAssignmentItem {
  id: string;
  courseId: string;
  stage: 1 | 2;
  status: string;
  progressPercent: number;
  hoursCompleted: number;
  examScore: number | null;
  attemptsUsed: number;
  isDayUnlocked: boolean;
  course: {
    id: string;
    title: string;
    modality: 'VIRTUAL' | 'PRESENCIAL';
    durationHours: number;
    minPassScore: number;
    maxAttempts: number;
    targetArea: string | null;
    targetAreaLabel: string;
    resources: Array<{
      id: string;
      type: string;
      title: string;
      contentUrl?: string | null;
      fileName?: string | null;
      durationMinutes: number;
    }>;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      points: number;
    }>;
  };
}

interface WorkerDashboardPayload {
  workerInfo: {
    id: string;
    fullName: string;
    dni: string;
    jobPosition: string;
    contractorName: string;
    accessZone: string;
    areaLabel: string;
    trafficLight: 'VERDE' | 'AMBAR' | 'ROJO';
    isBlacklisted: boolean;
    isEnabled: boolean;
    statusSummary: string;
  } | null;
  stage1Courses: CourseAssignmentItem[];
  stage2Courses: CourseAssignmentItem[];
  stage1Completed: boolean;
  completedCount: number;
  totalCount: number;
  overallProgressPercent: number;
  totalCompletedHours: number;
  totalRequiredHours: number;
  daySummary: Array<{
    dayNumber: number;
    title: string;
    modality: string;
    requiredHours: number;
    completedHours: number;
    allCompleted: boolean;
  }>;
  certificate: {
    verificationCode: string;
    issuedAt: string;
    issuedBy: string;
    averageScore: number | null;
  } | null;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  authUser,
  accessDeniedMessage,
  onDismissAccessDenied,
  onLogout,
}) => {
  const [dashboard, setDashboard] = useState<WorkerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCourse, setActiveCourse] = useState<CourseAssignmentItem | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [courseFeedback, setCourseFeedback] = useState<string | null>(null);
  const [demoFastMode, setDemoFastMode] = useState<boolean>(true);
  const [submittingAction, setSubmittingAction] = useState<'watch' | 'exam' | 'pdf' | null>(null);
  const [successAction, setSuccessAction] = useState<'watch' | 'exam' | 'pdf' | null>(null);

  const fetchDashboard = async () => {
    if (!authUser.workerId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/v1/courses/worker/${authUser.workerId}/dashboard`, {
        headers: { Authorization: `Bearer ${authUser.token}` },
      }).then((r) => r.json());

      if (res.success && res.data) {
        setDashboard(res.data);
        if (activeCourse) {
          const all = [...(res.data.stage1Courses || []), ...(res.data.stage2Courses || [])];
          const refreshed = all.find((item: CourseAssignmentItem) => item.id === activeCourse.id);
          if (refreshed) setActiveCourse(refreshed);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [authUser.workerId]);

  const flashSuccess = (action: 'watch' | 'exam' | 'pdf') => {
    setSuccessAction(action);
    window.setTimeout(() => setSuccessAction(null), 1800);
  };

  const handleRecordWatch = async () => {
    if (!authUser.workerId || !activeCourse) return;
    setSubmittingAction('watch');
    try {
      const res = await fetch(`/api/v1/courses/worker/${authUser.workerId}/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
        },
        body: JSON.stringify({
          courseId: activeCourse.courseId,
          deltaSeconds: demoFastMode ? 36000 : 300,
          demoAccelerated: demoFastMode,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setCourseFeedback('Avance registrado correctamente.');
        flashSuccess('watch');
        await fetchDashboard();
      } else {
        setCourseFeedback(res.error || 'No se pudo registrar el avance.');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleSubmitExam = async () => {
    if (!authUser.workerId || !activeCourse) return;
    setSubmittingAction('exam');
    try {
      const res = await fetch(`/api/v1/courses/worker/${authUser.workerId}/exam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
        },
        body: JSON.stringify({
          courseId: activeCourse.courseId,
          answers: quizAnswers,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setCourseFeedback(
          res.data.passed
            ? `¡Aprobado! Obtuviste ${res.data.score}%.`
            : `Puntaje obtenido: ${res.data.score}% (mínimo ${res.data.minPassScore}%). Intenta nuevamente.`
        );
        if (res.data.passed) flashSuccess('exam');
        await fetchDashboard();
      } else {
        setCourseFeedback(res.error || 'No se pudo enviar la evaluación.');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!dashboard?.certificate || !dashboard.workerInfo) return;
    setSubmittingAction('pdf');
    try {
      const worker = dashboard.workerInfo;
      await downloadOfficialCertificatePdf({
        workerName: worker.fullName,
        workerDni: worker.dni,
        jobPosition: worker.jobPosition,
        contractorName: worker.contractorName,
        areaLabel: worker.areaLabel,
        verificationCode: dashboard.certificate.verificationCode,
        issuedAt: dashboard.certificate.issuedAt,
        issuedBy: dashboard.certificate.issuedBy,
        totalHours: dashboard.totalCompletedHours,
        virtualHours: dashboard.daySummary
          .filter((d) => d.modality === 'VIRTUAL')
          .reduce((acc, d) => acc + d.completedHours, 0),
        presentialHours: dashboard.daySummary
          .filter((d) => d.modality === 'PRESENCIAL')
          .reduce((acc, d) => acc + d.completedHours, 0),
        averageScore: dashboard.certificate.averageScore ?? null,
        dayBreakdown: dashboard.daySummary
          .filter((d) => d.requiredHours > 0)
          .map((d) => ({
            dayNumber: d.dayNumber,
            title: d.title,
            modality: d.modality,
            hours: d.requiredHours,
            status: d.allCompleted ? 'COMPLETADO' : 'PENDIENTE',
          })),
      });
      flashSuccess('pdf');
    } finally {
      setSubmittingAction(null);
    }
  };

  const getStatusBadge = (item: CourseAssignmentItem) => {
    if (item.status === 'COMPLETED') {
      return {
        label: 'Completado',
        className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      };
    }
    if (item.status === 'IN_PROGRESS' || item.progressPercent > 0) {
      return {
        label: 'En curso',
        className: 'bg-slate-100 text-slate-700 border border-slate-200',
      };
    }
    return {
      label: 'Pendiente',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  };

  const renderCourseCard = (item: CourseAssignmentItem) => {
    const badge = getStatusBadge(item);
    const isCompleted = item.status === 'COMPLETED';
    const isPresential = item.course.modality === 'PRESENCIAL';
    const isLocked = !item.isDayUnlocked && !isCompleted;
    const isInProgress = item.status === 'IN_PROGRESS' || item.progressPercent > 0;

    return (
      <div
        key={item.id}
        className={`bg-white rounded-xl border p-6 transition-all duration-200 ease-out flex flex-col justify-between gap-5 ${
          isCompleted
            ? 'border-emerald-200/90'
            : isLocked
            ? 'border-slate-200 bg-slate-50/70 opacity-75'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              {isPresential ? (
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
              )}
              {isPresential ? 'Presencial' : 'E-learning'}
            </span>
          </div>

          <h4 className="text-base font-bold text-slate-900 leading-snug">{item.course.title}</h4>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {item.course.durationHours} h
            </span>
            {isCompleted && item.examScore !== null && (
              <span className="text-emerald-700 font-semibold">Nota: {item.examScore}%</span>
            )}
          </div>
        </div>

        <div className="pt-1">
          {isCompleted ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Curso completado
            </div>
          ) : isLocked ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Completa la Etapa 1 para continuar
            </div>
          ) : isPresential ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-amber-50/70 text-amber-800 border border-amber-200/60 text-xs font-medium flex items-center justify-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              Sesión presencial programada por SSOMA
            </div>
          ) : (
            <LoadingButton
              type="button"
              variant="primary"
              icon={<Play className="w-4 h-4" />}
              onClick={() => {
                setActiveCourse(item);
                setQuizAnswers({});
                setCourseFeedback(null);
              }}
              className="w-full py-2.5 min-h-[44px] text-sm rounded-xl"
            >
              {isInProgress ? 'Continuar' : 'Iniciar'}
            </LoadingButton>
          )}
        </div>
      </div>
    );
  };

  const worker = dashboard?.workerInfo;
  const isEnabled = Boolean(worker?.isEnabled);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800">
      <TopProgressBar active={loading || submittingAction !== null} />

      {/* Barra superior limpia sin sidebar administrativo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-black flex items-center justify-center text-base shrink-0">
              B
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">Portal del Trabajador</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Minera Bateas · Capacitación y Habilitación
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 sm:px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:text-rose-700 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="sm:hidden">Salir</span>
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {accessDeniedMessage && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 text-xs text-amber-800 bateas-fade-in">
            <span>{accessDeniedMessage}</span>
            <button
              type="button"
              onClick={onDismissAccessDenied}
              className="font-semibold text-amber-900 hover:underline cursor-pointer"
            >
              Entendido
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <SkeletonCard variant="summary" className="lg:col-span-8" />
              <SkeletonCard variant="kpi" className="lg:col-span-4" />
            </div>
            <div className="space-y-4">
              <div className="h-5 w-48 rounded bateas-shimmer" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SkeletonCard variant="course" />
                <SkeletonCard variant="course" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-5 w-64 rounded bateas-shimmer" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SkeletonCard variant="course" />
                <SkeletonCard variant="course" />
              </div>
            </div>
          </div>
        ) : !dashboard || !worker ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-500">
            No se encontró un perfil de trabajador asociado a esta cuenta.
          </div>
        ) : (
          <>
            {/* 1. ENCABEZADO RESUMIDO + ESTADO DE HABILITACIÓN (SIN QR) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {worker.contractorName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-semibold">
                      <MapPin className="w-3.5 h-3.5" />
                      {worker.areaLabel}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{worker.fullName}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">DNI: {worker.dni}</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      {dashboard.completedCount} de {dashboard.totalCount} cursos completados
                    </span>
                    <span className="font-bold text-emerald-700">
                      {dashboard.overallProgressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${dashboard.overallProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`lg:col-span-4 rounded-xl border p-6 flex flex-col justify-between gap-4 ${
                  isEnabled ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estado de Habilitación
                    </span>
                    <ShieldCheck
                      className={`w-5 h-5 ${isEnabled ? 'text-emerald-700' : 'text-amber-600'}`}
                    />
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold border ${
                        isEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isEnabled ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      {isEnabled ? 'Habilitado' : 'Pendiente'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/70 space-y-1.5 text-xs">
                  {isEnabled ? (
                    <p className="text-emerald-800 leading-relaxed font-medium">
                      Tu habilitación está activa. Puedes presentar tu DNI en Garita para ingresar a tu área asignada.
                    </p>
                  ) : (
                    <>
                      <p className="text-slate-600 leading-relaxed">
                        {Math.max(dashboard.totalCount - dashboard.completedCount, 0) > 0
                          ? `Te falta completar ${pluralize(
                              Math.max(dashboard.totalCount - dashboard.completedCount, 0),
                              'curso obligatorio',
                              'cursos obligatorios'
                            )} y validar tu documentación para quedar habilitado.`
                          : worker.statusSummary || 'En espera de validación documental final para habilitar ingreso.'}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Horas completadas</span>
                        <strong className="text-slate-800">
                          {dashboard.totalCompletedHours.toFixed(1)} / {dashboard.totalRequiredHours.toFixed(1)} h
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 2. ETAPA 1: INDUCCIÓN GENERAL */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Etapa 1: Inducción General
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cursos base obligatorios asignados automáticamente.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {dashboard.stage1Courses.filter((c) => c.status === 'COMPLETED').length} de{' '}
                  {dashboard.stage1Courses.length} completados
                </span>
              </div>

              {dashboard.stage1Courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                  No hay cursos generales configurados actualmente.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {dashboard.stage1Courses.map(renderCourseCard)}
                </div>
              )}
            </section>

            {/* 3. ETAPA 2: CAPACITACIÓN ESPECÍFICA DEL ÁREA */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Etapa 2: Capacitación Específica del Área
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cursos obligatorios asignados para <strong>{worker.areaLabel}</strong>.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {dashboard.stage2Courses.filter((c) => c.status === 'COMPLETED').length} de{' '}
                  {dashboard.stage2Courses.length} completados
                </span>
              </div>

              {dashboard.stage2Courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                  No hay cursos específicos adicionales requeridos para {worker.areaLabel}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {dashboard.stage2Courses.map(renderCourseCard)}
                </div>
              )}
            </section>

            {/* Constancia descargable discreta cuando el certificado existe */}
            {dashboard.certificate && (
              <div className="bg-white rounded-xl border border-emerald-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Constancia de Capacitación Disponible
                    </p>
                    <p className="text-xs text-slate-500">
                      Código: {dashboard.certificate.verificationCode}
                    </p>
                  </div>
                </div>
                <LoadingButton
                  type="button"
                  variant="primary"
                  isLoading={submittingAction === 'pdf'}
                  loadingText="Generando PDF..."
                  isSuccess={successAction === 'pdf'}
                  successText="Descargado"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadCertificate}
                >
                  Descargar Constancia PDF
                </LoadingButton>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL ENFOCADO PARA CURSAR UN MÓDULO E-LEARNING */}
      {activeCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden bateas-fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">{activeCourse.course.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Duración: {activeCourse.course.durationHours} h · Avance actual:{' '}
                  {activeCourse.progressPercent}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCourse(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {submittingAction === 'exam' && (
                <SmartProcessLoader
                  active
                  mode="default"
                  title="Calificando evaluación"
                  customMessages={[
                    'Verificando respuestas...',
                    'Calculando puntaje obtenido...',
                    'Actualizando tu estado de habilitación...',
                  ]}
                />
              )}

              {activeCourse.course.resources.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Material del curso
                  </h4>
                  <div className="space-y-3">
                    {activeCourse.course.resources.map((r) => (
                      <div
                        key={r.id}
                        className="rounded-xl border border-slate-200 p-4 bg-slate-50/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-500" />
                            {r.title}
                          </span>
                          <span className="text-slate-500">{r.durationMinutes} min</span>
                        </div>
                        {r.type === 'VIDEO' && r.contentUrl && (
                          <video
                            src={r.contentUrl}
                            controls
                            className="w-full rounded-xl max-h-60 bg-slate-950"
                          />
                        )}
                        {(r.type === 'PDF' || r.type === 'PRESENTATION') && r.contentUrl && (
                          <a
                            href={r.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Abrir material ({r.fileName || r.type})
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={demoFastMode}
                    onChange={(e) => setDemoFastMode(e.target.checked)}
                  />
                  <FastForward className="w-3.5 h-3.5 text-amber-600" />
                  Modo Demo Acelerado
                </label>

                <LoadingButton
                  type="button"
                  variant="secondary"
                  isLoading={submittingAction === 'watch'}
                  loadingText="Registrando avance..."
                  isSuccess={successAction === 'watch'}
                  successText="Avance guardado"
                  onClick={handleRecordWatch}
                >
                  {activeCourse.progressPercent >= 100
                    ? 'Contenido revisado (100%)'
                    : 'Marcar avance de estudio'}
                </LoadingButton>
              </div>

              {activeCourse.course.questions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Evaluación ({activeCourse.course.questions.length} preguntas · Mínimo{' '}
                      {activeCourse.course.minPassScore}%)
                    </h4>
                    <span className="text-xs text-slate-500">
                      Intentos: {activeCourse.attemptsUsed}/{activeCourse.course.maxAttempts}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeCourse.course.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs"
                      >
                        <p className="font-semibold text-slate-900">
                          {idx + 1}. {q.prompt}
                        </p>
                        <div className="space-y-1.5">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700"
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                checked={quizAnswers[q.id] === oIdx}
                                onChange={() =>
                                  setQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                                }
                                className="mt-0.5"
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <LoadingButton
                    type="button"
                    variant="primary"
                    isLoading={submittingAction === 'exam'}
                    loadingText="Enviando evaluación..."
                    isSuccess={successAction === 'exam'}
                    successText="Evaluación aprobada"
                    icon={<UserCheck className="w-4 h-4" />}
                    onClick={handleSubmitExam}
                    className="w-full py-2.5 text-sm rounded-xl"
                  >
                    Enviar Evaluación
                  </LoadingButton>
                </div>
              )}

              {courseFeedback && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800 bateas-fade-in">
                  {courseFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
