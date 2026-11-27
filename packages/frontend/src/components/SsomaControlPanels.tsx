import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Edit3,
  Glasses,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import { VrSimulatorModal } from './VrSimulatorModal';
import { LoadingButton, SkeletonCard } from './ui/LoadingStates';
import { formatProviderType } from '../utils/formatters';

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
  const [towerTab, setTowerTab] = useState<'TABLE' | 'PRESENTIAL' | 'BIOMETRICS'>('TABLE');
  const [pendingOverride, setPendingOverride] = useState<{
    workerId: string;
    workerName: string;
    workerDni: string;
    action: 'GRANT_GREEN' | 'REVOKE_RED';
  } | null>(null);
  const [presentialSaved, setPresentialSaved] = useState(false);

  // Integraciones API State
  const [integrationRecords, setIntegrationRecords] = useState<any[]>([]);
  const [showSandbox, setShowSandbox] = useState(false);
  const [activeWebhookAction, setActiveWebhookAction] = useState<string | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) || workers[0] || null;

  const loadPanelData = async () => {
    setPanelLoading(true);
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
    } finally {
      setPanelLoading(false);
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
        setPresentialSaved(true);
        window.setTimeout(() => setPresentialSaved(false), 1800);
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
        setPendingOverride(null);
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
  // VISTA B: TORRE DE CONTROL SSOMA (PESTAÑAS LIMPIAS + CONFIRMACIÓN HABILITAR/REVOCAR)
  // ============================================================================
  if (mode === 'CONTROL_TOWER') {
    const bioAlertsCount = biometricLogs.filter((l) => l.eventType !== 'VERIFIED_OK').length;

    const renderSoftTrafficPill = (status: string) => {
      if (status === 'VERDE') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Habilitado
          </span>
        );
      }
      if (status === 'AMBAR') {
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Observado
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Bloqueado
        </span>
      );
    };

    return (
      <div className="space-y-6 text-xs">
        {/* Cabecera + Navegación por Pestañas Limpias */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Torre de Control SSOMA
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Supervisa el cumplimiento de capacitación, registra jornadas presenciales / RV y gestiona el estado de
                habilitación con confirmación auditada.
              </p>
            </div>
            {selectedWorker && (
              <LoadingButton
                type="button"
                variant="secondary"
                onClick={() => setShowVrTester(true)}
                icon={<Glasses className="w-3.5 h-3.5 text-slate-600" />}
              >
                Probar Simulador RV
              </LoadingButton>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setTowerTab('TABLE')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                towerTab === 'TABLE'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Avance y Habilitación
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  towerTab === 'TABLE' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {workers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTowerTab('PRESENTIAL')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                towerTab === 'PRESENTIAL'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Registro Presencial y RV
            </button>

            <button
              type="button"
              onClick={() => setTowerTab('BIOMETRICS')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                towerTab === 'BIOMETRICS'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Log Biométrico
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  towerTab === 'BIOMETRICS'
                    ? 'bg-white/20 text-white'
                    : bioAlertsCount > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {bioAlertsCount} alerta(s)
              </span>
            </button>
          </div>
        </div>

        {/* PESTAÑA 1: TABLA DE AVANCE Y HABILITACIÓN */}
        {towerTab === 'TABLE' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden bateas-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200">
                    <th className="py-3.5 px-4">Trabajador / Especialidad</th>
                    <th className="py-3.5 px-3 text-center">Día 1 (8h)</th>
                    <th className="py-3.5 px-3 text-center">Día 2 (8h+Ex)</th>
                    <th className="py-3.5 px-3 text-center">Días 3–4 (16h)</th>
                    <th className="py-3.5 px-3 text-center">RV Socavón</th>
                    <th className="py-3.5 px-3 text-center">Alertas Bio</th>
                    <th className="py-3.5 px-3 text-center">Estado</th>
                    <th className="py-3.5 px-4 text-right">Habilitación SSOMA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((w) => {
                    const prog = w.trainingProgress || [];
                    const d1 = prog.find((p: any) => p.module?.dayNumber === 1);
                    const d2 = prog.find((p: any) => p.module?.dayNumber === 2);
                    const d34 = prog.filter((p: any) => p.module?.dayNumber >= 3);
                    const d34Done = d34.length > 0 && d34.every((p: any) => p.status === 'COMPLETED');
                    const vrPassed = new Set(
                      (w.vrSessions || []).filter((s: any) => s.passed).map((s: any) => s.scenarioCode)
                    );
                    const bioIncidents = (w.biometricLogs || []).filter(
                      (l: any) => l.eventType !== 'VERIFIED_OK'
                    ).length;

                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{w.fullName}</p>
                          <p className="text-[11px] text-slate-500">
                            DNI: {w.dni} · {w.jobPosition}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border ${
                              d1?.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {d1 ? `${(d1.completedSeconds / 3600).toFixed(1)}h / 8h` : '0h / 8h'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border ${
                              d2?.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {d2 ? `${(d2.completedSeconds / 3600).toFixed(1)}h · Ex:${d2.examScore ?? '—'}%` : 'Pendiente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border ${
                              d34Done
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {d34Done ? '16h OK' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                          {vrPassed.size}/4
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-semibold text-[10px] border ${
                              bioIncidents > 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {bioIncidents} alerta(s)
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {renderSoftTrafficPill(w.trafficLight)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPendingOverride({
                                  workerId: w.id,
                                  workerName: w.fullName,
                                  workerDni: w.dni,
                                  action: 'GRANT_GREEN',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 font-semibold text-[11px] transition cursor-pointer"
                            >
                              Habilitar
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingOverride({
                                  workerId: w.id,
                                  workerName: w.fullName,
                                  workerDni: w.dni,
                                  action: 'REVOKE_RED',
                                })
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition cursor-pointer"
                            >
                              Revocar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: REGISTRO PRESENCIAL DÍAS 3-4 Y SIMULADOR RV */}
        {towerTab === 'PRESENTIAL' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 max-w-3xl bateas-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  Registro Presencial en Campo (Días 3–4)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registra la asistencia y nota práctica de campo para completar la malla híbrida de 32 horas.
                </p>
              </div>
              {selectedWorker && (
                <LoadingButton
                  type="button"
                  variant="secondary"
                  onClick={() => setShowVrTester(true)}
                  icon={<Glasses className="w-3.5 h-3.5 text-slate-600" />}
                >
                  Abrir RV Socavón
                </LoadingButton>
              )}
            </div>

            <form onSubmit={handleRecordPresential} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Trabajador</label>
                <select
                  value={selectedWorker?.id || ''}
                  onChange={(e) => setSelectedWorkerId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.dni} — {w.fullName} ({w.jobPosition})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Módulo Presencial (Días 3–4)
                  </label>
                  <select
                    value={presentialForm.moduleId}
                    onChange={(e) => setPresentialForm({ ...presentialForm, moduleId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nota Práctica Campo (0–20, mín. 14)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={presentialForm.practicalScore}
                    onChange={(e) => setPresentialForm({ ...presentialForm, practicalScore: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fecha Programada</label>
                  <input
                    type="date"
                    value={presentialForm.scheduledDate}
                    onChange={(e) => setPresentialForm({ ...presentialForm, scheduledDate: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Instructor SSOMA</label>
                  <input
                    type="text"
                    value={presentialForm.attendanceVerifiedBy}
                    onChange={(e) => setPresentialForm({ ...presentialForm, attendanceVerifiedBy: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white"
                  />
                </div>
              </div>
              <div className="pt-2">
                <LoadingButton
                  type="submit"
                  variant="primary"
                  isLoading={loading}
                  loadingText="Guardando registro..."
                  isSuccess={presentialSaved}
                  successText="Asistencia registrada"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Registrar Asistencia (8h) y Nota Práctica
                </LoadingButton>
              </div>
            </form>
          </div>
        )}

        {/* PESTAÑA 3: LOG BIOMÉTRICO */}
        {towerTab === 'BIOMETRICS' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 bateas-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Log de Auditoría Biométrica (Proctoring y Login)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Historial de verificaciones faciales y alertas detectadas durante las sesiones de evaluación.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {biometricLogs.length} evento(s)
              </span>
            </div>

            {biometricLogs.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                Sin eventos biométricos registrados aún.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {biometricLogs.map((log) => (
                  <div key={log.id} className="py-3.5 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            log.eventType === 'VERIFIED_OK'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {log.eventType}
                        </span>
                        <strong className="text-slate-900">{log.worker?.fullName}</strong>
                      </div>
                      <p className="text-xs text-slate-600">{log.details}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString('es-PE')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN ANTES DE HABILITAR O REVOCAR */}
        {pendingOverride && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={() => !loading && setPendingOverride(null)}
          >
            <div
              className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 bateas-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      pendingOverride.action === 'GRANT_GREEN'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {pendingOverride.action === 'GRANT_GREEN' ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {pendingOverride.action === 'GRANT_GREEN'
                        ? 'Confirmar Habilitación de Acceso'
                        : 'Confirmar Revocación de Acceso'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pendingOverride.workerName} · DNI {pendingOverride.workerDni}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setPendingOverride(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {pendingOverride.action === 'GRANT_GREEN'
                  ? 'Esta acción establecerá el Estado de Habilitación en HABILITADO (VERDE) y autorizará el ingreso del trabajador en Garita.'
                  : 'Esta acción revocará el Estado de Habilitación a BLOQUEADO (ROJO) e impedirá el ingreso del trabajador en Garita de forma inmediata.'}
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Motivo de auditoría SSOMA *
                </label>
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Describe la justificación operativa..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <LoadingButton
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setPendingOverride(null)}
                >
                  Cancelar
                </LoadingButton>
                <LoadingButton
                  type="button"
                  variant={pendingOverride.action === 'GRANT_GREEN' ? 'primary' : 'danger'}
                  isLoading={loading}
                  loadingText={pendingOverride.action === 'GRANT_GREEN' ? 'Habilitando...' : 'Revocando...'}
                  disabled={!overrideReason.trim()}
                  onClick={() => handleManualOverride(pendingOverride.workerId, pendingOverride.action)}
                >
                  {pendingOverride.action === 'GRANT_GREEN'
                    ? 'Sí, habilitar trabajador'
                    : 'Sí, revocar acceso'}
                </LoadingButton>
              </div>
            </div>
          </div>
        )}

        {showVrTester && selectedWorker && (
          <VrSimulatorModal
            workerId={selectedWorker.id}
            workerName={selectedWorker.fullName}
            token={token}
            passedScenarios={(selectedWorker.vrSessions || [])
              .filter((s: any) => s.passed)
              .map((s: any) => s.scenarioCode)}
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
    <div className="space-y-6 text-xs">
      <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Integraciones API REST y Webhooks en Tiempo Real
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Clínicas Ocupacionales (EMO) y Aseguradoras (SCTR / Vida Ley)
          </h2>
          <p className="text-xs text-slate-500">
            Si un proveedor externo reporta EMO <strong>NO APTO</strong> o vencimiento de póliza{' '}
            <strong>SCTR / Vida Ley</strong>, el sistema bloquea automáticamente la habilitación del trabajador en
            Garita.
          </p>
        </div>

        <div className="min-w-[260px]">
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
            Trabajador consultado
          </label>
          <select
            value={selectedWorker?.id || ''}
            onChange={(e) => setSelectedWorkerId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          >
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                [{w.trafficLight}] {w.dni} — {w.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedWorker && (
        <>
          {/* Tarjetas de las 4 Integraciones Externas */}
          {panelLoading && integrationRecords.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <SkeletonCard key={n} variant="kpi" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {integrationRecords.map((rec) => {
                const isOk =
                  rec.status === 'APTO' || rec.status === 'APTO_CON_RESTRICCIONES' || rec.status === 'ACTIVA';
                const isExpired = new Date(rec.expiresAt).getTime() < Date.now();
                const healthy = isOk && !isExpired;
                const isRestrictionAlert =
                  rec.status === 'NO_APTO' || rec.status === 'APTO_CON_RESTRICCIONES' || isExpired;
                return (
                  <div
                    key={rec.id}
                    className={`p-5 rounded-xl border bg-white space-y-2.5 transition-all ${
                      healthy ? 'border-slate-200' : 'border-rose-200 bg-rose-50/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[11px] uppercase tracking-wide text-slate-500">
                        {formatProviderType(rec.providerType)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          healthy
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isExpired ? 'VENCIDA' : rec.status}
                      </span>
                    </div>
                    <p className="font-bold text-sm text-slate-900">{rec.providerName}</p>
                    <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                      <p className="text-slate-500">
                        Póliza / Cert:{' '}
                        <span className="font-semibold text-slate-700">{rec.policyNumber}</span>
                      </p>
                      <p className="text-slate-500">
                        Vigencia:{' '}
                        <span className={`font-semibold ${isExpired ? 'text-rose-700' : 'text-slate-700'}`}>
                          {String(rec.expiresAt).split('T')[0]} {isExpired ? '(Vencida)' : ''}
                        </span>
                      </p>
                    </div>
                    {rec.restrictions && (
                      <p
                        className={`text-[11px] rounded-lg p-2 font-medium border ${
                          isRestrictionAlert
                            ? 'text-rose-700 bg-rose-50 border-rose-200'
                            : 'text-slate-600 bg-slate-50 border-slate-200'
                        }`}
                      >
                        {rec.restrictions}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Acordeón Colapsado por Defecto: Simulador / Sandbox de Webhooks */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSandbox((prev) => !prev)}
              className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  <Webhook className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Simulador / Sandbox de Webhooks Externos
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      Pruebas técnicas
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dispara eventos simulados de Clínica EMO y Aseguradoras para probar revocaciones automáticas.
                  </p>
                </div>
              </div>
              {showSandbox ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {showSandbox && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4 bg-slate-50/50 bateas-fade-in">
                <p className="text-xs text-slate-600">
                  Endpoints destino: <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">POST /api/v1/webhooks/clinic-emo</code> y{' '}
                  <code className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">POST /api/v1/webhooks/insurer-policy</code>{' '}
                  para <strong>{selectedWorker.fullName}</strong> (Estado actual:{' '}
                  <strong>{selectedWorker.trafficLight}</strong>).
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <LoadingButton
                    type="button"
                    variant="danger"
                    isLoading={activeWebhookAction === 'EMO_NO_APTO'}
                    loadingText="Enviando..."
                    disabled={loading}
                    onClick={async () => {
                      setActiveWebhookAction('EMO_NO_APTO');
                      try {
                        await triggerClinicWebhook('NO_APTO');
                      } finally {
                        setActiveWebhookAction(null);
                      }
                    }}
                  >
                    Simular EMO NO APTO (Revocar)
                  </LoadingButton>

                  <LoadingButton
                    type="button"
                    variant="danger"
                    isLoading={activeWebhookAction === 'SCTR_VENCIDA'}
                    loadingText="Enviando..."
                    disabled={loading}
                    onClick={async () => {
                      setActiveWebhookAction('SCTR_VENCIDA');
                      try {
                        await triggerInsurerWebhook('SCTR_PENSION', 'VENCIDA', true);
                      } finally {
                        setActiveWebhookAction(null);
                      }
                    }}
                  >
                    Simular Vencimiento SCTR Pensión
                  </LoadingButton>

                  <LoadingButton
                    type="button"
                    variant="secondary"
                    isLoading={activeWebhookAction === 'VIDA_LEY'}
                    loadingText="Enviando..."
                    disabled={loading}
                    onClick={async () => {
                      setActiveWebhookAction('VIDA_LEY');
                      try {
                        await triggerInsurerWebhook('VIDA_LEY', 'SUSPENDIDA', false);
                      } finally {
                        setActiveWebhookAction(null);
                      }
                    }}
                  >
                    Simular Suspensión Vida Ley
                  </LoadingButton>

                  <LoadingButton
                    type="button"
                    variant="primary"
                    isLoading={activeWebhookAction === 'RESTORE_ALL'}
                    loadingText="Restaurando..."
                    disabled={loading}
                    onClick={async () => {
                      setActiveWebhookAction('RESTORE_ALL');
                      try {
                        await triggerClinicWebhook('APTO');
                        await triggerInsurerWebhook('SCTR_SALUD', 'ACTIVA', false);
                        await triggerInsurerWebhook('SCTR_PENSION', 'ACTIVA', false);
                        await triggerInsurerWebhook('VIDA_LEY', 'ACTIVA', false);
                      } finally {
                        setActiveWebhookAction(null);
                      }
                    }}
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    Restaurar Vigencias (APTO / ACTIVA)
                  </LoadingButton>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
