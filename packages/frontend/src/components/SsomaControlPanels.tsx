import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Cpu,
  Edit3,
  Glasses,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Webhook,
  XCircle,
} from 'lucide-react';
import { VrSimulatorModal } from './VrSimulatorModal';

interface SsomaPanelsProps {
  mode: 'CMS' | 'CONTROL_TOWER' | 'INTEGRATIONS';
  workers: any[];
  token: string;
  onRefreshAll: (keepWorkerId?: string) => Promise<void>;
  onNotice: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const SsomaControlPanels: React.FC<SsomaPanelsProps> = ({
  mode,
  workers,
  token,
  onRefreshAll,
  onNotice,
}) => {
  // CMS State
  const [cmsModules, setCmsModules] = useState<any[]>([]);
  const [cmsForm, setCmsForm] = useState({
    code: '',
    title: '',
    description: '',
    videoUrl: '',
    dayNumber: 2,
    modality: 'ELEARNING',
    requiredHours: 8,
    jobSpecialty: '',
    isActive: true,
  });

  // Torre de Control State
  const [biometricLogs, setBiometricLogs] = useState<any[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(workers[0]?.id || '');
  const [presentialForm, setPresentialForm] = useState({
    moduleId: '',
    scheduledDate: '2026-11-26',
    scheduledShift: 'Turno Día (07:00 - 15:00)',
    practicalScore: 17,
    attendanceVerifiedBy: 'Ing. Víctor Cayata (SSOMA)',
    observations: 'Aprobado en maniobras de campo y uso de detector multigás.',
  });
  const [overrideReason, setOverrideReason] = useState('Validación extraordinaria en Torre de Control SSOMA');
  const [showVrTester, setShowVrTester] = useState(false);

  // Integraciones API State
  const [integrationRecords, setIntegrationRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0] || null;

  const loadPanelData = async () => {
    try {
      if (mode === 'CMS') {
        const res = await fetch('/api/v1/training/cms/modules', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
        if (res.success) setCmsModules(res.data);
      } else if (mode === 'CONTROL_TOWER') {
        const [bioRes, cmsRes] = await Promise.all([
          fetch('/api/v1/biometrics/logs', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
          fetch('/api/v1/training/cms/modules', {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.json()),
        ]);
        if (bioRes.success) setBiometricLogs(bioRes.data);
        if (cmsRes.success) {
          setCmsModules(cmsRes.data);
          const firstPres = cmsRes.data.find((m: any) => m.dayNumber >= 3);
          if (firstPres && !presentialForm.moduleId) {
            setPresentialForm((p) => ({ ...p, moduleId: firstPres.id }));
          }
        }
      } else if (mode === 'INTEGRATIONS' && selectedWorker) {
        const res = await fetch(`/api/v1/integrations/worker/${selectedWorker.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json());
        if (res.success) setIntegrationRecords(res.data);
      }
    } catch {
      // handled gracefully
    }
  };

  useEffect(() => {
    if (!selectedWorkerId && workers.length > 0) {
      setSelectedWorkerId(workers[0].id);
    }
  }, [workers]);

  useEffect(() => {
    loadPanelData();
  }, [mode, selectedWorker?.id]);

  // MÓDULO 1 & 2: Guardar Módulo en CMS
  const handleSaveCmsModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/training/cms/modules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...cmsForm,
          dayNumber: Number(cmsForm.dayNumber),
          requiredHours: Number(cmsForm.requiredHours),
          jobSpecialty: cmsForm.jobSpecialty || null,
        }),
      }).then((r) => r.json());
      if (res.success) {
        onNotice('success', `Módulo CMS "${res.data.title}" guardado en Supabase.`);
        setCmsForm({
          code: '',
          title: '',
          description: '',
          videoUrl: '',
          dayNumber: 2,
          modality: 'ELEARNING',
          requiredHours: 8,
          jobSpecialty: '',
          isActive: true,
        });
        await loadPanelData();
      } else {
        onNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModuleActive = async (mod: any) => {
    await fetch('/api/v1/training/cms/modules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: mod.code,
        title: mod.title,
        description: mod.description,
        videoUrl: mod.videoUrl,
        dayNumber: mod.dayNumber,
        modality: mod.modality,
        requiredHours: mod.requiredHours,
        jobSpecialty: mod.jobSpecialty,
        isActive: !mod.isActive,
      }),
    });
    await loadPanelData();
    onNotice('info', `Módulo ${mod.code} ${!mod.isActive ? 'activado' : 'desactivado'}.`);
  };

  // MÓDULO 2: Registrar Asistencia y Nota Práctica Presencial Días 3 y 4
  const handleRecordPresential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker || !presentialForm.moduleId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/training/presential/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId: selectedWorker.id,
          ...presentialForm,
          attendanceCompleted: true,
          practicalScore: Number(presentialForm.practicalScore),
        }),
      }).then((r) => r.json());
      if (res.success) {
        onNotice('success', `Asistencia y nota práctica registrada para ${selectedWorker.fullName}.`);
        await onRefreshAll(selectedWorker.id);
        await loadPanelData();
      } else {
        onNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // MÓDULO 1: Emisión / Revocación Manual QR desde Torre de Control
  const handleManualOverride = async (workerId: string, action: 'GRANT_GREEN' | 'REVOKE_RED') => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/training/control-tower/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId,
          action,
          reviewerName: 'Esp. Víctor Cayata (Torre SSOMA)',
          reason: overrideReason,
        }),
      }).then((r) => r.json());
      if (res.success) {
        onNotice(
          action === 'GRANT_GREEN' ? 'success' : 'error',
          `Torre de Control: Estado de Habilitación ${action === 'GRANT_GREEN' ? 'HABILITADO' : 'REVOCADO'} para ${res.data.fullName}.`
        );
        await onRefreshAll(workerId);
      } else {
        onNotice('error', res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // MÓDULO 4: Simulador de Webhooks Clínicas EMO y Aseguradoras
  const triggerClinicWebhook = async (status: 'APTO' | 'APTO_CON_RESTRICCIONES' | 'NO_APTO') => {
    if (!selectedWorker) return;
    setLoading(true);
    try {
      const expiresAtStr = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch('/api/v1/webhooks/clinic-emo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dni: selectedWorker.dni,
          clinicName: 'Clínica Ocupacional Pulso Salud Arequipa (Webhook)',
          status,
          restrictions: status === 'NO_APTO' ? 'Alteración cardiovascular incompatible con altura/socavón.' : null,
          expiresAtStr,
        }),
      }).then((r) => r.json());
      if (res.success) {
        onNotice(
          status === 'NO_APTO' ? 'error' : 'success',
          `Webhook EMO (${status}) procesado -> Semáforo: ${res.data.worker?.trafficLight}`
        );
        await onRefreshAll(selectedWorker.id);
        await loadPanelData();
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerInsurerWebhook = async (
    providerType: 'SCTR_SALUD' | 'SCTR_PENSION' | 'VIDA_LEY',
    status: 'ACTIVA' | 'VENCIDA' | 'SUSPENDIDA',
    expiredDate = false
  ) => {
    if (!selectedWorker) return;
    setLoading(true);
    try {
      const expiresAtStr = expiredDate
        ? '2025-01-10'
        : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch('/api/v1/webhooks/insurer-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          dni: selectedWorker.dni,
          providerType,
          status,
          expiresAtStr,
        }),
      }).then((r) => r.json());
      if (res.success) {
        onNotice(
          status !== 'ACTIVA' || expiredDate ? 'error' : 'success',
          `Webhook ${providerType} (${status}) procesado -> Semáforo: ${res.data.worker?.trafficLight}`
        );
        await onRefreshAll(selectedWorker.id);
        await loadPanelData();
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // VISTA A: GESTOR CMS DE CAPACITACIÓN (DÍAS 1–4 / ESPECIALIDADES)
  // ============================================================================
  if (mode === 'CMS') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        <div className="lg:col-span-7 bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Gestor CMS de Capacitación Normativa (D.S. 024-2016-EM — 4 Días / 32 Horas)
              </h2>
              <p className="text-[11px] text-slate-500">
                Administra módulos E-Learning, Presenciales y RV, duración en horas y especialidad requerida.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {cmsModules.map((m) => (
              <div key={m.id} className="py-3 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-black text-[10px]">
                      DÍA {m.dayNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                      {m.modality} · {m.requiredHours}h
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      {m.jobSpecialty || 'TRANSVERSAL (TODOS)'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{m.code}</span>
                  </div>
                  <h4 className="font-bold text-slate-900">{m.title}</h4>
                  <p className="text-[11px] text-slate-600">{m.description}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      setCmsForm({
                        code: m.code,
                        title: m.title,
                        description: m.description,
                        videoUrl: m.videoUrl || '',
                        dayNumber: m.dayNumber,
                        modality: m.modality,
                        requiredHours: m.requiredHours,
                        jobSpecialty: m.jobSpecialty || '',
                        isActive: m.isActive,
                      })
                    }
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleModuleActive(m)}
                    className={`px-2.5 py-1 rounded font-bold text-white cursor-pointer ${
                      m.isActive ? 'bg-emerald-600' : 'bg-slate-400'
                    }`}
                  >
                    {m.isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-600" /> Crear / Actualizar Módulo de Capacitación
          </h3>
          <form onSubmit={handleSaveCmsModule} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Código Único</label>
                <input
                  type="text"
                  value={cmsForm.code}
                  onChange={(e) => setCmsForm({ ...cmsForm, code: e.target.value })}
                  placeholder="Ej. D2-ESP-ING"
                  className="w-full border border-slate-300 rounded px-3 py-1.5"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Día Asignado (1–4)</label>
                <select
                  value={cmsForm.dayNumber}
                  onChange={(e) => setCmsForm({ ...cmsForm, dayNumber: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded px-3 py-1.5"
                >
                  <option value={1}>Día 1 — Inducción General</option>
                  <option value={2}>Día 2 — Específica por Puesto</option>
                  <option value={3}>Día 3 — Práctica Campo</option>
                  <option value={4}>Día 4 — Práctica + RV</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Título del Módulo</label>
              <input
                type="text"
                value={cmsForm.title}
                onChange={(e) => setCmsForm({ ...cmsForm, title: e.target.value })}
                placeholder="Ej. Control de Ventilación y Gases en Socavón"
                className="w-full border border-slate-300 rounded px-3 py-1.5"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Descripción / Sílabo</label>
              <textarea
                rows={2}
                value={cmsForm.description}
                onChange={(e) => setCmsForm({ ...cmsForm, description: e.target.value })}
                className="w-full border border-slate-300 rounded px-3 py-1.5"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Modalidad</label>
                <select
                  value={cmsForm.modality}
                  onChange={(e) => setCmsForm({ ...cmsForm, modality: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="ELEARNING">ELEARNING</option>
                  <option value="PRESENTIAL">PRESENTIAL</option>
                  <option value="VR">VR</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Horas</label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={cmsForm.requiredHours}
                  onChange={(e) => setCmsForm({ ...cmsForm, requiredHours: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Especialidad</label>
                <select
                  value={cmsForm.jobSpecialty}
                  onChange={(e) => setCmsForm({ ...cmsForm, jobSpecialty: e.target.value })}
                  className="w-full border border-slate-300 rounded px-2 py-1.5"
                >
                  <option value="">Todos</option>
                  <option value="OPERARIO">OPERARIO</option>
                  <option value="TECNICO">TECNICO</option>
                  <option value="INGENIERO">INGENIERO</option>
                  <option value="CONDUCTOR">CONDUCTOR</option>
                  <option value="PERSONAL_COCINA">PERSONAL_COCINA</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#007bff] hover:bg-blue-600 text-white font-bold rounded cursor-pointer"
            >
              Guardar en CMS de Capacitación
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VISTA B: TORRE DE CONTROL SSOMA (AVANCE 32H, PRÁCTICA PRESENCIAL, BIOMETRÍA, OVERRIDE QR)
  // ============================================================================
  if (mode === 'CONTROL_TOWER') {
    return (
      <div className="space-y-6 text-xs">
        {/* Tabla Torre de Control de Capacitación y Biometría por Trabajador */}
        <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 bg-[#222d32] text-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">
                Torre de Control SSOMA — Avance Híbrido (32 Horas), RV Socavón y Biometría IA
              </h2>
              <p className="text-[11px] text-slate-300">
                Supervisa el cumplimiento por día, valida asistencia presencial y habilita o revoca el acceso del trabajador.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Motivo auditoría..."
                className="px-2.5 py-1 rounded bg-slate-800 border border-slate-600 text-white text-[11px] w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="p-3 font-bold">Trabajador / Especialidad</th>
                  <th className="p-3 font-bold text-center">Día 1 (8h)</th>
                  <th className="p-3 font-bold text-center">Día 2 (8h+Ex)</th>
                  <th className="p-3 font-bold text-center">Días 3–4 (16h)</th>
                  <th className="p-3 font-bold text-center">RV Socavón</th>
                  <th className="p-3 font-bold text-center">Alertas Bio</th>
                  <th className="p-3 font-bold text-center">Semáforo</th>
                  <th className="p-3 font-bold text-right">Estado Habilitación (SSOMA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {workers.map((w) => {
                  const prog = w.trainingProgress || [];
                  const d1 = prog.find((p: any) => p.module?.dayNumber === 1);
                  const d2 = prog.find((p: any) => p.module?.dayNumber === 2);
                  const d34 = prog.filter((p: any) => p.module?.dayNumber >= 3);
                  const d34Done = d34.length > 0 && d34.every((p: any) => p.status === 'COMPLETED');
                  const vrPassed = new Set((w.vrSessions || []).filter((s: any) => s.passed).map((s: any) => s.scenarioCode));
                  const bioIncidents = (w.biometricLogs || []).filter((l: any) => l.eventType !== 'VERIFIED_OK').length;

                  return (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{w.fullName}</p>
                        <p className="text-[11px] text-slate-500">
                          DNI: {w.dni} · {w.jobPosition}
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            d1?.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {d1 ? `${(d1.completedSeconds / 3600).toFixed(1)}h / 8h` : '0h / 8h'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            d2?.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {d2 ? `${(d2.completedSeconds / 3600).toFixed(1)}h · Ex:${d2.examScore ?? '—'}%` : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            d34Done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {d34Done ? '16h OK' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">{vrPassed.size}/4</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            bioIncidents > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {bioIncidents} alerta(s)
                        </span>
                      </td>
                      <td className="p-3 text-center font-black">{w.trafficLight}</td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleManualOverride(w.id, 'GRANT_GREEN')}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          Habilitar
                        </button>
                        <button
                          onClick={() => handleManualOverride(w.id, 'REVOKE_RED')}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          Revocar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Registro Presencial en Campo (Días 3 y 4) + Acceso Simulador RV */}
          <div className="lg:col-span-6 bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" /> Registro Presencial Días 3–4 (Campo) & Simulador RV
              </h3>
              {selectedWorker && (
                <button
                  type="button"
                  onClick={() => setShowVrTester(true)}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Glasses className="w-3.5 h-3.5" /> Probar RV Socavón
                </button>
              )}
            </div>

            <form onSubmit={handleRecordPresential} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trabajador</label>
                <select
                  value={selectedWorker?.id || ''}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-1.5 font-semibold"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.dni} — {w.fullName} ({w.jobPosition})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Módulo Presencial (Días 3–4)</label>
                  <select
                    value={presentialForm.moduleId}
                    onChange={(e) => setPresentialForm({ ...presentialForm, moduleId: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5"
                  >
                    {cmsModules
                      .filter((m) => m.dayNumber >= 3)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          Día {m.dayNumber}: {m.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nota Práctica Campo (0–20, mín 14)</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={presentialForm.practicalScore}
                    onChange={(e) => setPresentialForm({ ...presentialForm, practicalScore: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5 font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fecha Programada</label>
                  <input
                    type="date"
                    value={presentialForm.scheduledDate}
                    onChange={(e) => setPresentialForm({ ...presentialForm, scheduledDate: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Instructor SSOMA</label>
                  <input
                    type="text"
                    value={presentialForm.attendanceVerifiedBy}
                    onChange={(e) => setPresentialForm({ ...presentialForm, attendanceVerifiedBy: e.target.value })}
                    className="w-full border border-slate-300 rounded px-3 py-1.5"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded cursor-pointer"
              >
                Registrar Asistencia (8h) y Nota Práctica
              </button>
            </form>
          </div>

          {/* Log de Auditoría Biométrica (Proctoring IA) */}
          <div className="lg:col-span-6 bg-white rounded border border-slate-200 shadow-2xs p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Log de Alertas Biométricas (Proctoring IA & Login)
            </h3>
            <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto">
              {biometricLogs.length === 0 ? (
                <p className="text-slate-500 py-4 text-center">Sin eventos biométricos registrados aún.</p>
              ) : (
                biometricLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black mr-1.5 ${
                          log.eventType === 'VERIFIED_OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {log.eventType}
                      </span>
                      <strong className="text-slate-800">{log.worker?.fullName}</strong>
                      <p className="text-[11px] text-slate-600 mt-0.5">{log.details}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString('es-PE')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {showVrTester && selectedWorker && (
          <VrSimulatorModal
            workerId={selectedWorker.id}
            workerName={selectedWorker.fullName}
            token={token}
            passedScenarios={(selectedWorker.vrSessions || []).filter((s: any) => s.passed).map((s: any) => s.scenarioCode)}
            onCompleted={() => onRefreshAll(selectedWorker.id)}
            onClose={() => setShowVrTester(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // VISTA C: INTEGRACIONES API EN TIEMPO REAL (CLÍNICAS EMO & ASEGURADORAS)
  // ============================================================================
  return (
    <div className="space-y-5 text-xs">
      <div className="bg-white p-5 rounded border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase text-sky-700">
            Módulo 4 · Integraciones API REST & Webhooks en Tiempo Real (Modo Híbrido)
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Sincronización Automática con Clínicas Ocupacionales (EMO) y Aseguradoras (SCTR / Vida Ley)
          </h2>
          <p className="text-slate-500">
            Si un webhook reporta EMO <strong>NO_APTO</strong> o vencimiento de <strong>SCTR Salud / Pensión / Vida Ley</strong>, el sistema revoca automáticamente el Semáforo a 🔴 ROJO y cambia el Estado de Habilitación a Pendiente / Bloqueado.
          </p>
        </div>
        <select
          value={selectedWorker?.id || ''}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 font-bold bg-slate-50"
        >
          {workers.map((w) => (
            <option key={w.id} value={w.id}>
              [{w.trafficLight}] {w.dni} — {w.fullName}
            </option>
          ))}
        </select>
      </div>

      {selectedWorker && (
        <>
          {/* Tarjetas de las 4 Integraciones Externas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrationRecords.map((rec) => {
              const isOk = rec.status === 'APTO' || rec.status === 'APTO_CON_RESTRICCIONES' || rec.status === 'ACTIVA';
              const isExpired = new Date(rec.expiresAt).getTime() < Date.now();
              return (
                <div
                  key={rec.id}
                  className={`p-4 rounded-xl border-2 bg-white shadow-2xs space-y-2 ${
                    isOk && !isExpired ? 'border-emerald-400' : 'border-rose-500 bg-rose-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[11px] text-slate-700">{rec.providerType}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${
                        isOk && !isExpired ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900">{rec.providerName}</p>
                  <p className="text-[11px] text-slate-600">Póliza/Cert: {rec.policyNumber}</p>
                  <p className="text-[11px] font-semibold text-slate-700">
                    Vigencia: {String(rec.expiresAt).split('T')[0]} {isExpired ? '(VENCIDA)' : ''}
                  </p>
                  {rec.restrictions && (
                    <p className="text-[11px] text-rose-700 font-semibold">{rec.restrictions}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel Sandbox para Simular Webhooks en Vivo */}
          <div className="bg-slate-900 text-white p-5 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold">
                Simulador / Sandbox de Webhooks Externos (Revocación Automática en Tiempo Real)
              </h3>
            </div>
            <p className="text-slate-300 text-[11px]">
              Dispare eventos hacia <code>POST /api/v1/webhooks/clinic-emo</code> y{' '}
              <code>POST /api/v1/webhooks/insurer-policy</code> para el trabajador{' '}
              <strong>{selectedWorker.fullName}</strong> (Semáforo actual:{' '}
              <strong>{selectedWorker.trafficLight}</strong>):
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                disabled={loading}
                onClick={() => triggerClinicWebhook('NO_APTO')}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 rounded font-bold cursor-pointer"
              >
                🏥 Simular Webhook EMO NO_APTO (Revoca a 🔴 ROJO)
              </button>
              <button
                disabled={loading}
                onClick={() => triggerInsurerWebhook('SCTR_PENSION', 'VENCIDA', true)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 rounded font-bold cursor-pointer"
              >
                🛡️ Simular Vencimiento SCTR Pensión (Revoca Habilitación)
              </button>
              <button
                disabled={loading}
                onClick={() => triggerInsurerWebhook('VIDA_LEY', 'SUSPENDIDA', false)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold cursor-pointer"
              >
                📄 Simular Suspensión Vida Ley
              </button>
              <button
                disabled={loading}
                onClick={async () => {
                  await triggerClinicWebhook('APTO');
                  await triggerInsurerWebhook('SCTR_SALUD', 'ACTIVA', false);
                  await triggerInsurerWebhook('SCTR_PENSION', 'ACTIVA', false);
                  await triggerInsurerWebhook('VIDA_LEY', 'ACTIVA', false);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold cursor-pointer"
              >
                ✅ Restaurar Todas las Vigencias y Aptitud (APTO / ACTIVA)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
