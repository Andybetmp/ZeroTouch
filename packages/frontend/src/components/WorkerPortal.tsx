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
  const [submitting, setSubmitting] = useState(false);

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

  const handleRecordWatch = async () => {
    if (!authUser.workerId || !activeCourse) return;
    setSubmitting(true);
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
        await fetchDashboard();
      } else {
        setCourseFeedback(res.error || 'No se pudo registrar el avance.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitExam = async () => {
    if (!authUser.workerId || !activeCourse) return;
    setSubmitting(true);
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
        await fetchDashboard();
      } else {
        setCourseFeedback(res.error || 'No se pudo enviar la evaluación.');
      }
    } finally {
      setSubmitting(false);
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
        className: 'bg-sky-50 text-sky-700 border border-sky-200',
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
        className={`bg-white rounded-2xl border p-6 transition-all flex flex-col justify-between gap-5 ${
          isCompleted
            ? 'border-emerald-200/80 shadow-2xs'
            : isLocked
            ? 'border-slate-200 bg-slate-50/70 opacity-75'
            : 'border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              {isPresential ? (
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-sky-500" />
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
            <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Curso completado
            </div>
          ) : isLocked ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Completa la Etapa 1 para continuar
            </div>
          ) : isPresential ? (
            <div className="w-full py-2.5 px-4 rounded-xl bg-amber-50/70 text-amber-800 text-xs font-medium flex items-center justify-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              Sesión presencial programada por SSOMA
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setActiveCourse(item);
                setQuizAnswers({});
                setCourseFeedback(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {isInProgress ? 'Continuar' : 'Iniciar'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const worker = dashboard?.workerInfo;
  const isEnabled = Boolean(worker?.isEnabled);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Barra superior limpia sin sidebar administrativo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center text-base">
              B
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Portal del Trabajador</h1>
              <p className="text-xs text-slate-500">Minera Bateas · Capacitación y Habilitación</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {accessDeniedMessage && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 text-xs text-amber-900">
            <span>{accessDeniedMessage}</span>
            <button
              type="button"
              onClick={onDismissAccessDenied}
              className="font-semibold text-amber-800 hover:underline cursor-pointer"
            >
              Entendido
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-sm text-slate-400">
            Cargando tu ruta de capacitación...
          </div>
        ) : !dashboard || !worker ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-500">
            No se encontró un perfil de trabajador asociado a esta cuenta.
          </div>
        ) : (
          <>
            {/* 1. ENCABEZADO RESUMIDO + ESTADO DE HABILITACIÓN (SIN QR) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Tarjeta principal del trabajador y barra de progreso */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {worker.contractorName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-semibold">
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
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${dashboard.overallProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tarjeta simple: Estado de Habilitación (Habilitado / Pendiente) por DNI y Área — SIN QR */}
              <div
                className={`lg:col-span-4 rounded-2xl border p-6 shadow-2xs flex flex-col justify-between gap-4 ${
                  isEnabled
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estado de Habilitación
                    </span>
                    <ShieldCheck
                      className={`w-5 h-5 ${isEnabled ? 'text-emerald-600' : 'text-amber-500'}`}
                    />
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-bold ${
                        isEnabled
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-100 text-amber-800'
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
                  <div className="flex justify-between text-slate-600">
                    <span>DNI</span>
                    <strong className="text-slate-900">{worker.dni}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Área de ingreso</span>
                    <strong className="text-slate-900 text-right">{worker.areaLabel}</strong>
                  </div>
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
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
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
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm text-slate-500">
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
              <div className="bg-white rounded-2xl border border-emerald-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Constancia de Capacitación Disponible</p>
                    <p className="text-xs text-slate-500">
                      Código: {dashboard.certificate.verificationCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    downloadOfficialCertificatePdf({
                      workerName: worker.fullName,
                      workerDni: worker.dni,
                      jobPosition: worker.jobPosition,
                      contractorName: worker.contractorName,
                      areaLabel: worker.areaLabel,
                      verificationCode: dashboard.certificate!.verificationCode,
                      issuedAt: dashboard.certificate!.issuedAt,
                      issuedBy: dashboard.certificate!.issuedBy,
                      totalHours: dashboard.totalCompletedHours,
                      virtualHours: dashboard.daySummary
                        .filter((d) => d.modality === 'VIRTUAL')
                        .reduce((acc, d) => acc + d.completedHours, 0),
                      presentialHours: dashboard.daySummary
                        .filter((d) => d.modality === 'PRESENCIAL')
                        .reduce((acc, d) => acc + d.completedHours, 0),
                      averageScore: dashboard.certificate!.averageScore ?? null,
                      dayBreakdown: dashboard.daySummary
                        .filter((d) => d.requiredHours > 0)
                        .map((d) => ({
                          dayNumber: d.dayNumber,
                          title: d.title,
                          modality: d.modality,
                          hours: d.requiredHours,
                          status: d.allCompleted ? 'COMPLETADO' : 'PENDIENTE',
                        })),
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Descargar Constancia PDF
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* MODAL ENFOCADO PARA CURSAR UN MÓDULO E-LEARNING */}
      {activeCourse && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
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
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Recursos del curso */}
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
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline"
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

              {/* Control de progreso */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={demoFastMode}
                    onChange={(e) => setDemoFastMode(e.target.checked)}
                  />
                  <FastForward className="w-3.5 h-3.5 text-amber-500" />
                  Modo Demo Acelerado
                </label>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleRecordWatch}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {activeCourse.progressPercent >= 100
                    ? 'Contenido revisado (100%)'
                    : 'Marcar avance de estudio'}
                </button>
              </div>

              {/* Evaluación del curso */}
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

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSubmitExam}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    Enviar Evaluación
                  </button>
                </div>
              )}

              {courseFeedback && (
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-xs font-semibold text-indigo-900">
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
