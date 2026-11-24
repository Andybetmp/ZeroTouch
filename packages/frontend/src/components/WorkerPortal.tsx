import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  EyeOff,
  FastForward,
  Glasses,
  Lock,
  LogOut,
  Pause,
  Play,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Video,
  XCircle,
} from 'lucide-react';
import { AuthUser, TrainingModuleProgressItem, TrainingRoadmap } from '../types/bateas';
import { VrSimulatorModal } from './VrSimulatorModal';
import { downloadOfficialCertificatePdf } from '../utils/certificatePdf';

interface WorkerPortalProps {
  authUser: AuthUser;
  accessDeniedMessage: string | null;
  onDismissAccessDenied: () => void;
  onLogout: () => void;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  authUser,
  accessDeniedMessage,
  onDismissAccessDenied,
  onLogout,
}) => {
  const [roadmap, setRoadmap] = useState<TrainingRoadmap | null>(null);
  const [workerDetail, setWorkerDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<TrainingModuleProgressItem | null>(null);

  // Reproductor de Video + Proctoring IA Continuo (Módulo 3)
  const [isPlaying, setIsPlaying] = useState(false);
  const [demoFastMode, setDemoFastMode] = useState<boolean>(
    import.meta.env.VITE_DEMO_TIME_SCALE !== 'false'
  );
  const [proctoringAlert, setProctoringAlert] = useState<string | null>(null);
  const [proctoringOkText, setProctoringOkText] = useState<string>('Cámara Activa · Titular Verificado');
  const webcamRef = useRef<HTMLVideoElement | null>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Examen Teórico Día 2
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examNotice, setExamNotice] = useState<string | null>(null);

  // Simulador RV Socavón
  const [showVrModal, setShowVrModal] = useState(false);

  // Aula CMS (Capacitaciones Pendientes y Completadas + Recursos + Quiz + Constancia)
  const [cmsDashboard, setCmsDashboard] = useState<any>(null);
  const [activeCmsAssignment, setActiveCmsAssignment] = useState<any>(null);
  const [cmsQuizAnswers, setCmsQuizAnswers] = useState<Record<string, number>>({});
  const [cmsNotice, setCmsNotice] = useState<string | null>(null);

  const fetchWorkerData = async () => {
    if (!authUser.workerId) {
      setLoading(false);
      return;
    }
    try {
      const [rmRes, wRes, cmsRes] = await Promise.all([
        fetch(`/api/v1/training/roadmap/${authUser.workerId}`, {
          headers: { Authorization: `Bearer ${authUser.token}` },
        }).then((r) => r.json()),
        fetch(`/api/v1/workers/${authUser.workerId}`, {
          headers: { Authorization: `Bearer ${authUser.token}` },
        }).then((r) => r.json()),
        fetch(`/api/v1/courses/worker/${authUser.workerId}/dashboard`, {
          headers: { Authorization: `Bearer ${authUser.token}` },
        }).then((r) => r.json()),
      ]);
      if (rmRes.success) {
        setRoadmap(rmRes.data);
        if (activeModule) {
          const updatedMod = rmRes.data.modules.find(
            (m: TrainingModuleProgressItem) => m.moduleId === activeModule.moduleId
          );
          if (updatedMod) setActiveModule(updatedMod);
        }
      }
      if (wRes.success) {
        setWorkerDetail(wRes.data);
      }
      if (cmsRes.success) {
        setCmsDashboard(cmsRes.data);
        if (activeCmsAssignment) {
          const allCms = [
            ...(cmsRes.data.pendingCourses || []),
            ...(cmsRes.data.completedCourses || []),
          ];
          const refreshed = allCms.find((a: any) => a.id === activeCmsAssignment.id);
          if (refreshed) setActiveCmsAssignment(refreshed);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerData();
  }, [authUser.workerId]);

  // Encender webcam discreta al abrir un módulo E-Learning (Días 1 y 2)
  useEffect(() => {
    let localStream: MediaStream | null = null;
    async function startProctoringCam() {
      if (!activeModule || activeModule.modality !== 'ELEARNING') return;
      try {
        if (navigator.mediaDevices?.getUserMedia) {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 320, height: 240 },
            audio: false,
          });
          setWebcamStream(localStream);
          if (webcamRef.current) {
            webcamRef.current.srcObject = localStream;
          }
        }
      } catch {
        setProctoringOkText('Modo Proctoring Simulado (Sin cámara física)');
      }
    }
    startProctoringCam();
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      setWebcamStream(null);
    };
  }, [activeModule?.moduleId]);

  // Contador de horas efectivas mientras el reproductor está reproduciendo sin alertas
  useEffect(() => {
    if (!isPlaying || !activeModule || proctoringAlert || !authUser.workerId) return;

    const timer = setInterval(async () => {
      // En modo acelerador: 1 segundo real = 1 hora (3600s) de capacitación; modo normal: 5s
      const addedSeconds = demoFastMode ? 3600 : 5;
      const res = await fetch('/api/v1/training/progress/watch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authUser.token}`,
        },
        body: JSON.stringify({
          workerId: authUser.workerId,
          moduleId: activeModule.moduleId,
          addedSeconds,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setRoadmap(res.data);
        const updatedMod = res.data.modules.find(
          (m: TrainingModuleProgressItem) => m.moduleId === activeModule.moduleId
        );
        if (updatedMod) {
          setActiveModule(updatedMod);
          if (updatedMod.completedSeconds >= updatedMod.requiredSeconds) {
            setIsPlaying(false);
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, activeModule?.moduleId, proctoringAlert, demoFastMode]);

  // Chequeo periódico de Proctoring IA cada 12 segundos mientras está reproduciendo
  useEffect(() => {
    if (!isPlaying || !activeModule || proctoringAlert || !authUser.workerId) return;

    const proctorInterval = setInterval(async () => {
      await triggerProctoringCheck();
    }, 12000);

    return () => clearInterval(proctorInterval);
  }, [isPlaying, activeModule?.moduleId, proctoringAlert]);

  const triggerProctoringCheck = async (
    forcedIncident?: 'NO_FACE_DETECTED' | 'MULTIPLE_FACES' | 'IDENTITY_MISMATCH' | 'CAMERA_BLOCKED_OR_DENIED' | 'VERIFIED_OK'
  ) => {
    if (!authUser.workerId || !activeModule) return;

    let imageBase64: string | null = null;
    if (!forcedIncident && webcamRef.current && webcamCanvasRef.current && webcamStream) {
      const ctx = webcamCanvasRef.current.getContext('2d');
      if (ctx) {
        webcamCanvasRef.current.width = 240;
        webcamCanvasRef.current.height = 180;
        ctx.drawImage(webcamRef.current, 0, 0, 240, 180);
        imageBase64 = webcamCanvasRef.current.toDataURL('image/jpeg', 0.7);
      }
    }

    const res = await fetch('/api/v1/biometrics/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authUser.token}`,
      },
      body: JSON.stringify({
        workerId: authUser.workerId,
        sessionType: 'PROCTORING',
        moduleId: activeModule.moduleId,
        imageBase64,
        simulatedEvent: forcedIncident || (imageBase64 ? undefined : 'VERIFIED_OK'),
      }),
    }).then((r) => r.json());

    if (res.success) {
      if (res.data.shouldPauseVideo) {
        // Pausa obligatoria del video y detención del reloj ante cualquier incidente
        setIsPlaying(false);
        setProctoringAlert(res.data.message);
      } else {
        setProctoringAlert(null);
        setProctoringOkText(res.data.message);
      }
      fetchWorkerData();
    }
  };

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule || !authUser.workerId) return;
    const answersArr = activeModule.questions.map((_, i) => examAnswers[i] ?? 0);

    const res = await fetch('/api/v1/training/progress/exam', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authUser.token}`,
      },
      body: JSON.stringify({
        workerId: authUser.workerId,
        moduleId: activeModule.moduleId,
        answers: answersArr,
      }),
    }).then((r) => r.json());

    if (res.success) {
      setRoadmap(res.data);
      const updatedMod = res.data.modules.find(
        (m: TrainingModuleProgressItem) => m.moduleId === activeModule.moduleId
      );
      if (updatedMod) {
        setActiveModule(updatedMod);
        setExamNotice(
          (updatedMod.examScore ?? 0) >= 75
            ? `✅ ¡Evaluación aprobada con ${updatedMod.examScore}%! Días 3 y 4 desbloqueados.`
            : `❌ Obtuviste ${updatedMod.examScore}%. Se requiere mínimo 75% para aprobar.`
        );
      }
    } else {
      setExamNotice(res.error);
    }
  };

  const handleDownloadCertificate = () => {
    if (!roadmap) return;
    const lines = [
      '========================================================================',
      'MINERA BATEAS S.A.C. — CONSTANCIA DE CAPACITACIÓN NORMATIVA (D.S. 024-2016-EM)',
      '========================================================================',
      `Trabajador          : ${roadmap.fullName}`,
      `DNI                 : ${roadmap.dni}`,
      `Empresa Contratista : ${roadmap.companyName}`,
      `Especialidad        : ${roadmap.jobPosition}`,
      `Horas Completadas   : ${roadmap.totalCompletedHours} / ${roadmap.totalRequiredHours} horas`,
      `Estado Semáforo     : ${roadmap.trafficLight}`,
      `Simulación RV       : ${roadmap.vrSummary.passedScenarios.length}/4 escenarios aprobados`,
      `Fecha de Emisión    : ${new Date().toLocaleString('es-PE')}`,
      '========================================================================',
    ].join('\n');
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Certificado_32H_${roadmap.dni}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
        Cargando Portal Exclusivo del Trabajador...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f3f7] text-slate-800 flex flex-col">
      {/* HEADER AISLADO DEL TRABAJADOR (SIN SIDEBAR ADMINISTRATIVO) */}
      <header className="bg-[#222d32] text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 font-black text-lg flex items-center justify-center">
            B
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide">
              Portal del Trabajador · Bateas Zero-Touch (D.S. 024-2016-EM)
            </h1>
            <p className="text-[11px] text-emerald-400 font-semibold">
              Sesión Biométrica Verificada · Ruta de Capacitación 4 Días / 32 Horas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="px-3 py-1.5 rounded bg-slate-800 border border-slate-700 font-semibold flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            {roadmap?.fullName || authUser.fullName} (DNI: {roadmap?.dni || authUser.workerDni})
          </span>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-6 space-y-6 flex-1">
        {accessDeniedMessage && (
          <div className="p-4 rounded-lg bg-rose-50 border-2 border-rose-400 text-rose-900 text-xs font-bold flex items-center justify-between">
            <span>⛔ {accessDeniedMessage}</span>
            <button onClick={onDismissAccessDenied} className="underline ml-4 cursor-pointer">
              Entendido
            </button>
          </div>
        )}

        {roadmap && (
          <>
            {/* TARJETA DE PERFIL, SEMÁFORO DE HABILITACIÓN Y CARNÉ QR (SOLO SI ESTÁ VERDE) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-slate-500">
                      Mi Perfil y Estado de Habilitación Minera
                    </span>
                    <h2 className="text-xl font-black text-slate-900">{roadmap.fullName}</h2>
                    <p className="text-xs text-slate-600">
                      DNI: <strong>{roadmap.dni}</strong> · Especialidad: <strong>{roadmap.jobPosition}</strong> ·
                      Contrata: <strong>{roadmap.companyName}</strong>
                    </p>
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-black text-white shadow-2xs ${
                      roadmap.trafficLight === 'VERDE'
                        ? 'bg-emerald-600'
                        : roadmap.trafficLight === 'ROJO'
                        ? 'bg-rose-600'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    SEMÁFORO: {roadmap.trafficLight}
                  </span>
                </div>

                <div
                  className={`p-3 rounded-lg border text-xs font-semibold ${
                    roadmap.trafficLight === 'VERDE'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : roadmap.trafficLight === 'ROJO'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  {roadmap.statusSummary}
                </div>

                {/* Barra / Contador de Horas 32h */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Progreso Ruta Obligatoria (D.S. 024-2016-EM):</span>
                    <span className="text-indigo-700">
                      {roadmap.totalCompletedHours}h / {roadmap.totalRequiredHours}h ({roadmap.overallPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all"
                      style={{ width: `${roadmap.overallPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleDownloadCertificate}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Descargar Constancia de Avance / Certificado
                  </button>
                  <button
                    onClick={() => setShowVrModal(true)}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Glasses className="w-4 h-4" /> Simulador RV Socavón ({roadmap.vrSummary.passedScenarios.length}/4)
                  </button>
                </div>
              </div>

              {/* TARJETA CARNÉ DIGITAL QR (SOLO VISIBLE SI ESTÁ EN VERDE) */}
              <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col items-center justify-center text-center">
                {roadmap.trafficLight === 'VERDE' && workerDetail?.digitalBadge ? (
                  <div className="space-y-2.5">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CARNÉ QR HABILITADO
                    </span>
                    <div className="p-2.5 bg-white border-2 border-emerald-400 rounded-lg inline-block">
                      <QRCodeSVG value={workerDetail.digitalBadge.qrPayloadJson} size={130} />
                    </div>
                    <p className="text-xs font-black text-slate-900">{workerDetail.digitalBadge.badgeCode}</p>
                    <p className="text-[11px] text-slate-500">
                      Fotocheck PVC: <strong>{workerDetail.digitalBadge.pvcPrintStatus}</strong>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-slate-500">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">Carné Digital QR Bloqueado</h4>
                    <p className="text-[11px]">
                      Su código QR de ingreso a mina se generará automáticamente solo cuando su Semáforo alcance{' '}
                      <strong className="text-emerald-700">VERDE</strong> (Documentos + 32h + RV).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RUTA SECUENCIAL DE CAPACITACIÓN HÍBRIDA (4 DÍAS / 32 HORAS) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-3.5 bg-[#222d32] text-white flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">
                    Ruta Secuencial Obligatoria de 4 Días (32 Horas · D.S. 024-2016-EM / D.S. 023-2017-EM)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Día 1 (8h) → desbloquea Día 2 (8h + Examen ≥ 75%) → desbloquea Días 3 y 4 Presencial (16h) + RV.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded border border-slate-700 cursor-pointer">
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  <input
                    type="checkbox"
                    checked={demoFastMode}
                    onChange={(e) => setDemoFastMode(e.target.checked)}
                  />
                  <span className="font-bold text-amber-300">Acelerador Demo (1s = 1h)</span>
                </label>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                {roadmap.modules.map((mod) => (
                  <div
                    key={mod.moduleId}
                    className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 ${
                      mod.status === 'COMPLETED'
                        ? 'bg-emerald-50/60 border-emerald-400'
                        : mod.isUnlocked
                        ? 'bg-white border-indigo-400'
                        : 'bg-slate-100 border-slate-300 opacity-75'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white">
                          DÍA {mod.dayNumber} · {mod.modality} · {mod.requiredHours}H
                        </span>
                        {mod.status === 'COMPLETED' ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Completado
                          </span>
                        ) : mod.isUnlocked ? (
                          <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                            <Clock className="w-4 h-4" /> Habilitado
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Bloqueado (Secuencial)
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-sm text-slate-900">{mod.title}</h4>
                      <p className="text-xs text-slate-600">{mod.description}</p>

                      {/* Barra del módulo */}
                      <div className="pt-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                          <span>Avance: {mod.completedHours}h / {mod.requiredHours}h</span>
                          <span>{mod.percent}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${mod.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                            style={{ width: `${mod.percent}%` }}
                          />
                        </div>
                      </div>

                      {mod.examScore !== null && (
                        <p className="text-[11px] font-bold text-indigo-800">
                          Nota Evaluación Teórica: {mod.examScore}% (Mínimo 75%)
                        </p>
                      )}
                      {mod.modality !== 'ELEARNING' && (
                        <p className="text-[11px] text-slate-600">
                          {mod.scheduledDate
                            ? `Programado: ${mod.scheduledDate} (${mod.scheduledShift || ''}) · Nota práctica: ${
                                mod.practicalScore ?? 'Pendiente'
                              }/20`
                            : 'Validación presencial registrada por instructor SSOMA en campo.'}
                        </p>
                      )}
                    </div>

                    <div>
                      {mod.modality === 'ELEARNING' ? (
                        <button
                          disabled={!mod.isUnlocked}
                          onClick={() => {
                            setActiveModule(mod);
                            setIsPlaying(false);
                            setProctoringAlert(null);
                            setExamNotice(null);
                          }}
                          className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-300 disabled:text-slate-500 cursor-pointer"
                        >
                          {mod.isUnlocked ? 'Abrir Reproductor con Proctoring IA' : `Completa Día ${mod.dayNumber - 1} para desbloquear`}
                        </button>
                      ) : mod.modality === 'VR' ? (
                        <button
                          disabled={!mod.isUnlocked}
                          onClick={() => setShowVrModal(true)}
                          className="w-full py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:bg-slate-300 disabled:text-slate-500 cursor-pointer"
                        >
                          {mod.isUnlocked ? 'Iniciar Escenarios RV Socavón' : 'Completa Días 1 y 2 para desbloquear'}
                        </button>
                      ) : (
                        <div className="text-center text-[11px] font-semibold text-slate-500 py-1.5 bg-slate-100 rounded">
                          {mod.isUnlocked
                            ? 'Asistencia y nota registradas por SSOMA en Campo'
                            : 'Bloqueado hasta aprobar Días 1 y 2'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* REPRODUCTOR DE VIDEO CON PROCTORING IA CONTINUO + EXAMEN TEÓRICO */}
            {activeModule && activeModule.modality === 'ELEARNING' && (
              <div className="bg-white rounded-xl border-2 border-indigo-500 shadow-lg p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[11px] font-black uppercase text-indigo-600">
                      Aula E-Learning Monitoreada por Biometría IA · Día {activeModule.dayNumber}
                    </span>
                    <h3 className="text-base font-black text-slate-900">{activeModule.title}</h3>
                  </div>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-800 px-3 py-1 rounded border border-indigo-200">
                    {activeModule.completedHours}h / {activeModule.requiredHours}h ({activeModule.percent}%)
                  </span>
                </div>

                {proctoringAlert && (
                  <div className="p-4 rounded-lg bg-rose-50 border-2 border-rose-500 text-rose-950 text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <div>
                        <p className="font-black">VIDEO Y RELOJ PAUSADOS POR INCIDENTE BIOMÉTRICO</p>
                        <p>{proctoringAlert}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => triggerProctoringCheck('VERIFIED_OK')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Re-validar Rostro y Reanudar
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Reproductor Simulado / Video */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="bg-slate-950 rounded-xl aspect-video flex flex-col items-center justify-center text-white p-6 relative border border-slate-800">
                      <Video className={`w-14 h-14 mb-2 ${isPlaying ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                      <p className="text-sm font-bold text-center">{activeModule.title}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {isPlaying
                          ? `Reproduciendo y sumando horas (${demoFastMode ? '1s = 1h Acelerado' : 'Tiempo Real'})...`
                          : 'Reproductor pausado'}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          disabled={activeModule.completedSeconds >= activeModule.requiredSeconds}
                          onClick={() => {
                            if (proctoringAlert) return;
                            setIsPlaying(!isPlaying);
                          }}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {isPlaying ? 'Pausar Clase' : 'Iniciar / Reanudar Clase'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Panel Discreto de Proctoring IA Activo */}
                  <div className="lg:col-span-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-800 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-emerald-600" /> Proctoring IA Activo
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Chequeo c/12s
                      </span>
                    </div>

                    <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video relative border border-slate-700 flex items-center justify-center">
                      <video ref={webcamRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      {!webcamStream && (
                        <span className="text-[11px] text-slate-400 px-3 text-center">
                          Vista previa webcam (use controles inferiores si no hay cámara)
                        </span>
                      )}
                    </div>
                    <canvas ref={webcamCanvasRef} className="hidden" />

                    <p className="text-[11px] text-slate-600 font-medium">{proctoringOkText}</p>

                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Simular Incidentes de Proctoring (Demo):
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => triggerProctoringCheck('NO_FACE_DETECTED')}
                          className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px] cursor-pointer"
                        >
                          👤 Ausente (No Face)
                        </button>
                        <button
                          onClick={() => triggerProctoringCheck('MULTIPLE_FACES')}
                          className="px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px] cursor-pointer"
                        >
                          👥 Múltiples Rostros
                        </button>
                        <button
                          onClick={() => triggerProctoringCheck('IDENTITY_MISMATCH')}
                          className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded font-bold text-[10px] cursor-pointer"
                        >
                          🎭 Suplantación
                        </button>
                        <button
                          onClick={() => triggerProctoringCheck('CAMERA_BLOCKED_OR_DENIED')}
                          className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300 rounded font-bold text-[10px] cursor-pointer flex items-center justify-center gap-1"
                        >
                          <EyeOff className="w-3 h-3" /> Cámara Tapada
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evaluación Teórica si el módulo tiene preguntas */}
                {activeModule.questions.length > 0 && (
                  <form onSubmit={handleSubmitExam} className="pt-4 border-t border-slate-200 space-y-3 text-xs">
                    <h4 className="font-black text-sm text-slate-900">
                      Evaluación Teórica Obligatoria (Mínimo 75% para desbloquear Días 3 y 4)
                    </h4>
                    {activeModule.completedSeconds < activeModule.requiredSeconds ? (
                      <p className="text-amber-700 font-semibold">
                        ⏳ Completa el 100% de las horas del módulo ({activeModule.requiredHours}h) para habilitar el examen.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {activeModule.questions.map((q, qIdx) => (
                            <div key={q.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                              <p className="font-bold text-slate-800">
                                {qIdx + 1}. {q.questionText}
                              </p>
                              {q.options.map((opt, optIdx) => (
                                <label key={optIdx} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`mod_q_${q.id}`}
                                    checked={(examAnswers[qIdx] ?? 0) === optIdx}
                                    onChange={() => setExamAnswers({ ...examAnswers, [qIdx]: optIdx })}
                                    className="mt-0.5"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          ))}
                        </div>
                        {examNotice && (
                          <div className="p-3 rounded bg-indigo-50 border border-indigo-300 font-bold text-indigo-950">
                            {examNotice}
                          </div>
                        )}
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow cursor-pointer"
                        >
                          Enviar Evaluación Teórica
                        </button>
                      </>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* AULA CMS: CAPACITACIONES PENDIENTES Y COMPLETADAS + CONSTANCIA PDF */}
            {cmsDashboard && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">
                      Mis Capacitaciones Asignadas (Pendientes vs. Completadas)
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      Progreso acumulado: {cmsDashboard.totalCompletedHours}h / {cmsDashboard.totalRequiredHours}h ({cmsDashboard.overallProgressPercent}%)
                    </p>
                  </div>
                  {cmsDashboard.certificate && workerDetail && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadOfficialCertificatePdf({
                          workerName: workerDetail.fullName,
                          workerDni: workerDetail.dni,
                          jobPosition: workerDetail.jobPosition,
                          contractorName: workerDetail.contractor?.companyName || 'Contratista ECM',
                          verificationCode: cmsDashboard.certificate.verificationCode,
                          issuedAt: cmsDashboard.certificate.issuedAt,
                          issuedBy: cmsDashboard.certificate.issuedBy,
                          totalHours: cmsDashboard.totalCompletedHours,
                          virtualHours: cmsDashboard.daySummary
                            .filter((d: any) => d.modality === 'VIRTUAL')
                            .reduce((acc: number, d: any) => acc + d.completedHours, 0),
                          presentialHours: cmsDashboard.daySummary
                            .filter((d: any) => d.modality === 'PRESENCIAL')
                            .reduce((acc: number, d: any) => acc + d.completedHours, 0),
                          averageScore: cmsDashboard.certificate.averageScore ?? null,
                          dayBreakdown: cmsDashboard.daySummary.map((d: any) => ({
                            dayNumber: d.dayNumber,
                            title: d.title,
                            modality: d.modality,
                            hours: d.requiredHours,
                            status: d.allCompleted ? 'COMPLETADO' : 'PENDIENTE',
                          })),
                        })
                      }
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Award className="w-4 h-4" />
                      Descargar Constancia PDF
                    </button>
                  )}
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Pendientes */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase text-amber-700 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Capacitaciones Pendientes ({cmsDashboard.pendingCourses.length})
                    </h4>
                    {cmsDashboard.pendingCourses.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                        No tienes capacitaciones pendientes.
                      </p>
                    ) : (
                      cmsDashboard.pendingCourses.map((a: any) => (
                        <div key={a.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-bold text-slate-700">
                              Día {a.course.dayNumber} · {a.course.modality} · {a.course.durationHours}h
                            </div>
                            <div className="font-bold text-xs text-slate-900">{a.course.title}</div>
                            <div className="text-[11px] text-slate-500">
                              Avance: {a.progressPercent}% {a.examScore !== null ? `· Última nota: ${a.examScore}%` : ''}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!a.isDayUnlocked || a.course.modality === 'PRESENCIAL'}
                            onClick={() => {
                              setActiveCmsAssignment(a);
                              setCmsNotice(null);
                              setCmsQuizAnswers({});
                            }}
                            className={`px-3 py-1.5 rounded text-xs font-bold ${
                              !a.isDayUnlocked
                                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                : a.course.modality === 'PRESENCIAL'
                                ? 'bg-amber-100 text-amber-800 cursor-default'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                            }`}
                          >
                            {!a.isDayUnlocked
                              ? 'Bloqueado'
                              : a.course.modality === 'PRESENCIAL'
                              ? 'Presencial SSOMA'
                              : a.progressPercent > 0
                              ? 'Continuar'
                              : 'Iniciar'}
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Completadas */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Capacitaciones Completadas ({cmsDashboard.completedCourses.length})
                    </h4>
                    {cmsDashboard.completedCourses.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-200">
                        Aún no completas ninguna capacitación.
                      </p>
                    ) : (
                      cmsDashboard.completedCourses.map((a: any) => (
                        <div key={a.id} className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-bold text-emerald-800">
                              Día {a.course.dayNumber} · {a.course.modality} · {a.course.durationHours}h
                            </div>
                            <div className="font-bold text-xs text-slate-900">{a.course.title}</div>
                            <div className="text-[11px] text-emerald-700 font-semibold">
                              100% Completado {a.examScore !== null ? `· Nota: ${a.examScore}%` : ''}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                            APROBADO
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Visor de Recursos + Quiz del Curso CMS seleccionado */}
                {activeCmsAssignment && (
                  <div className="border-t border-slate-200 p-5 bg-slate-50 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {activeCmsAssignment.course.title}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Avance actual: {activeCmsAssignment.progressPercent}% ({activeCmsAssignment.hoursCompleted}/{activeCmsAssignment.course.durationHours}h)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/v1/courses/worker/${authUser.workerId}/watch`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authUser.token}`,
                              },
                              body: JSON.stringify({
                                courseId: activeCmsAssignment.courseId,
                                deltaSeconds: demoFastMode ? 36000 : 120,
                                demoAccelerated: demoFastMode,
                              }),
                            }).then((r) => r.json());
                            if (res.success) {
                              setCmsNotice('Tiempo de visualización registrado correctamente.');
                              await fetchWorkerData();
                            }
                          }}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          {demoFastMode ? 'Completar Visualización (Modo Demo)' : 'Registrar Visualización'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCmsAssignment(null)}
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>

                    {/* Recursos */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeCmsAssignment.course.resources || []).map((r: any) => (
                        <div key={r.id} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                          <div className="font-bold text-slate-800">
                            [{r.type}] {r.title} ({r.durationMinutes} min)
                          </div>
                          {r.type === 'VIDEO' && r.contentUrl && (
                            <video src={r.contentUrl} controls className="w-full rounded max-h-48 bg-black" />
                          )}
                          {(r.type === 'PDF' || r.type === 'PRESENTATION') && r.contentUrl && (
                            <a
                              href={r.contentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-indigo-600 font-semibold hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Abrir / Descargar {r.fileName || r.type}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Evaluación del curso */}
                    {activeCmsAssignment.course.questions?.length > 0 && (
                      <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
                        <h5 className="text-xs font-bold uppercase text-slate-700">
                          Evaluación del Curso (Mínimo {activeCmsAssignment.course.minPassScore}% · Intentos: {activeCmsAssignment.attemptsUsed}/{activeCmsAssignment.course.maxAttempts})
                        </h5>
                        {activeCmsAssignment.course.questions.map((q: any, idx: number) => (
                          <div key={q.id} className="text-xs space-y-1.5 border-b border-slate-100 pb-2">
                            <p className="font-semibold text-slate-800">
                              {idx + 1}. {q.prompt}
                            </p>
                            {q.options.map((opt: string, oIdx: number) => (
                              <label key={oIdx} className="flex items-center gap-2 cursor-pointer text-slate-700">
                                <input
                                  type="radio"
                                  name={`cms_q_${q.id}`}
                                  checked={cmsQuizAnswers[q.id] === oIdx}
                                  onChange={() => setCmsQuizAnswers({ ...cmsQuizAnswers, [q.id]: oIdx })}
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ))}
                        {cmsNotice && (
                          <div className="p-2.5 rounded bg-indigo-50 text-indigo-900 text-xs font-semibold">
                            {cmsNotice}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/v1/courses/worker/${authUser.workerId}/exam`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authUser.token}`,
                              },
                              body: JSON.stringify({
                                courseId: activeCmsAssignment.courseId,
                                answers: cmsQuizAnswers,
                              }),
                            }).then((r) => r.json());
                            if (res.success) {
                              setCmsNotice(
                                `Resultado: ${res.data.score}% (${res.data.passed ? 'APROBADO' : 'NO APROBADO'})`
                              );
                              await fetchWorkerData();
                            } else {
                              setCmsNotice(res.error || 'Error enviando evaluación.');
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer"
                        >
                          Enviar Evaluación
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {showVrModal && roadmap && (
        <VrSimulatorModal
          workerId={roadmap.workerId}
          workerName={roadmap.fullName}
          token={authUser.token}
          passedScenarios={roadmap.vrSummary.passedScenarios}
          onCompleted={fetchWorkerData}
          onClose={() => setShowVrModal(false)}
        />
      )}
    </div>
  );
};
