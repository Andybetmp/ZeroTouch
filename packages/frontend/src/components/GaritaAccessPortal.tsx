import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  LogOut,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { AuthUser } from '../types/bateas';
import { formatJobProfile, formatPvcStatus, pluralize } from '../utils/formatters';
import { LoadingButton, SkeletonCard, TopProgressBar } from './ui/LoadingStates';

export interface GaritaWorkerItem {
  id: string;
  dni: string;
  fullName: string;
  jobPosition: string;
  accessZone: string;
  trafficLight: 'VERDE' | 'AMBAR' | 'ROJO';
  statusSummary: string;
  isBlacklisted: boolean;
  contractor: {
    ruc: string;
    companyName: string;
  };
  digitalBadge?: {
    id: string;
    pvcPrintStatus: 'QUEUED_GARITA' | 'PRINTED' | 'DELIVERED';
    validUntil: string;
  } | null;
}

interface GaritaAccessPortalProps {
  authUser: AuthUser;
  workers: GaritaWorkerItem[];
  isInitialLoading: boolean;
  standalone?: boolean;
  onBackToAdmin?: () => void;
  onRefresh: () => Promise<void> | void;
  onUpdatePvcStatus: (badgeId: string, status: 'PRINTED' | 'DELIVERED') => Promise<void>;
  onLogout: () => void;
}

const AREA_LABELS: Record<string, string> = {
  SOCAVON: 'Interior Mina / Socavón',
  PLANTA_CONCENTRADORA: 'Planta Concentradora',
  SUPERFICIE: 'Superficie / Talleres',
  OFICINAS_ADMINISTRATIVAS: 'Oficinas Administrativas',
};

const getAreaLabel = (zone?: string) => (zone ? AREA_LABELS[zone] || zone : 'Superficie / Talleres');

export const GaritaAccessPortal: React.FC<GaritaAccessPortalProps> = ({
  authUser,
  workers,
  isInitialLoading,
  standalone = true,
  onBackToAdmin,
  onRefresh,
  onUpdatePvcStatus,
  onLogout,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dniQuery, setDniQuery] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ENABLED' | 'PENDING'>('ALL');
  const [printingBadgeId, setPrintingBadgeId] = useState<string | null>(null);
  const [printedBadgeId, setPrintedBadgeId] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerifyDni = async (overrideDni?: string) => {
    const clean = (overrideDni ?? dniQuery).replace(/\D/g, '').trim();
    if (!clean) {
      setVerifyError('Ingresa un DNI de 8 dígitos para consultar el estado de habilitación.');
      inputRef.current?.focus();
      return;
    }

    if (overrideDni) setDniQuery(clean);
    setVerifyError(null);
    setVerifying(true);
    try {
      const resp = await fetch(`/api/v1/badges/verify/${encodeURIComponent(clean)}`, {
        headers: authUser.token ? { Authorization: `Bearer ${authUser.token}` } : undefined,
      });
      const json = await resp.json();
      if (json.success && json.data) {
        setVerifyResult(json.data);
      } else {
        setVerifyResult(null);
        setVerifyError(json.error || 'No se encontró un trabajador con ese DNI.');
      }
    } catch {
      setVerifyError('No se pudo conectar con el servidor de verificación.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePrintPvc = async (badgeId: string) => {
    setPrintingBadgeId(badgeId);
    try {
      await onUpdatePvcStatus(badgeId, 'PRINTED');
      setPrintedBadgeId(badgeId);
      window.setTimeout(() => setPrintedBadgeId(null), 2200);
    } finally {
      setPrintingBadgeId(null);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const isEnabled = w.trafficLight === 'VERDE' && !w.isBlacklisted;
    if (statusFilter === 'ENABLED') return isEnabled;
    if (statusFilter === 'PENDING') return !isEnabled;
    return true;
  });

  const enabledCount = workers.filter((w) => w.trafficLight === 'VERDE' && !w.isBlacklisted).length;
  const pendingCount = workers.length - enabledCount;

  const content = (
    <main className={`${standalone ? 'max-w-5xl mx-auto px-6 py-8' : ''} space-y-8`}>
      {/* 1. BUSCADOR PROMINENTE DE DNI CON FOCO AUTOMÁTICO */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              Control de Acceso · Validación por DNI
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Consultar Estado de Habilitación
            </h2>
            <p className="text-xs text-slate-500">
              Ingresa el número de DNI del trabajador para verificar si se encuentra habilitado para ingresar a su área asignada.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              {pluralize(enabledCount, 'Habilitado')}
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              {pluralize(pendingCount, 'Pendiente')}
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerifyDni();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              maxLength={12}
              value={dniQuery}
              onChange={(e) => setDniQuery(e.target.value)}
              placeholder="DNI de 8 dígitos (ej. 72702372)"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 outline-none text-sm sm:text-base font-semibold tracking-wide text-slate-900 bg-slate-50/40 focus:bg-white transition-all duration-200"
            />
          </div>

          <LoadingButton
            type="submit"
            variant="primary"
            isLoading={verifying}
            loadingText="Consultando DNI..."
            icon={<UserCheck className="w-4 h-4" />}
            className="px-6 py-3.5 min-h-[44px] text-sm rounded-xl sm:min-w-[190px]"
          >
            Consultar DNI
          </LoadingButton>
        </form>

        {verifyError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-medium text-rose-700 flex items-center gap-2 bateas-fade-in">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {/* TARJETA RESULTADO DE ALTA LEGIBILIDAD */}
        {verifyResult && (() => {
          const notFound = !verifyResult.worker;
          const isDanger =
            notFound || verifyResult.worker?.isBlacklisted || verifyResult.worker?.trafficLight === 'ROJO';
          const rawReason = String(verifyResult.reason || '')
            .replace(/Firma HMAC-SHA256 válida,?\s*/gi, '')
            .replace(/\b(QUEUED_GARITA|PRINTED|DELIVERED)\b/g, (m) => formatPvcStatus(m));

          return (
            <div
              className={`rounded-xl border p-6 bateas-fade-in ${
                verifyResult.accessGranted
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : isDanger
                  ? 'bg-rose-50/80 border-rose-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border ${
                        verifyResult.accessGranted
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : isDanger
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {verifyResult.accessGranted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : notFound ? (
                        <XCircle className="w-4 h-4" />
                      ) : verifyResult.worker?.isBlacklisted ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : verifyResult.worker?.trafficLight === 'ROJO' ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      {verifyResult.accessGranted
                        ? 'HABILITADO PARA INGRESO'
                        : notFound
                        ? 'NO REGISTRADO / ACCESO DENEGADO'
                        : verifyResult.worker?.isBlacklisted
                        ? 'BLOQUEADO EN LISTA NEGRA'
                        : verifyResult.worker?.trafficLight === 'ROJO'
                        ? 'ACCESO BLOQUEADO'
                        : 'PENDIENTE DE HABILITACIÓN'}
                    </span>
                    {verifyResult.worker?.dni && (
                      <span className="text-xs font-semibold text-slate-700 bg-white px-3 py-1 rounded-full border border-slate-200">
                        DNI: {verifyResult.worker.dni}
                      </span>
                    )}
                  </div>

                  {verifyResult.worker && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {verifyResult.worker.fullName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-600">
                        {verifyResult.worker.contractor?.companyName && (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {verifyResult.worker.contractor.companyName}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                          Área: {getAreaLabel(verifyResult.worker.accessZone)}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className={`text-xs pt-1 ${notFound ? 'text-rose-800 font-medium' : 'text-slate-600'}`}>
                    {rawReason}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVerifyResult(null);
                    setDniQuery('');
                    inputRef.current?.focus();
                  }}
                  className="px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold self-start md:self-center whitespace-nowrap transition cursor-pointer"
                >
                  Nueva consulta
                </button>
              </div>
            </div>
          );
        })()}
      </section>

      {/* 2. PADRÓN DE ESTADO DE HABILITACIÓN POR PERSONAL */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Padrón de Estado de Habilitación ({filteredWorkers.length})
            </h3>
            <p className="text-xs text-slate-500">
              Selecciona cualquier trabajador para validar su estado en tiempo real.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs w-full sm:w-auto">
            {(
              [
                { id: 'ALL', label: `Todos (${workers.length})` },
                { id: 'ENABLED', label: `Habilitados (${enabledCount})` },
                { id: 'PENDING', label: `Pendientes (${pendingCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex-1 sm:flex-none px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isInitialLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} variant="worker" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWorkers.map((w) => {
              const isEnabled = w.trafficLight === 'VERDE' && !w.isBlacklisted;
              const isBlocked = w.isBlacklisted || w.trafficLight === 'ROJO';
              const badge = w.digitalBadge;

              return (
                <div
                  key={w.id}
                  className={`bg-white rounded-xl border p-5 transition-all duration-200 flex flex-col justify-between gap-4 hover:shadow-sm ${
                    isEnabled ? 'border-emerald-200' : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isBlocked
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {isEnabled ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isBlocked ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        {isEnabled ? 'Habilitado' : isBlocked ? 'Bloqueado' : 'Pendiente'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">DNI: {w.dni}</span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {w.fullName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {w.contractor.companyName}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span>Área de ingreso</span>
                        <strong className="text-slate-900 text-right">
                          {getAreaLabel(w.accessZone)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span>Puesto</span>
                        <span className="font-medium text-slate-700">{formatJobProfile(w.jobPosition)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-2">
                    <LoadingButton
                      type="button"
                      variant={isEnabled ? 'primary' : 'secondary'}
                      onClick={() => handleVerifyDni(w.dni)}
                      className="flex-1 min-h-[44px] sm:min-h-0"
                    >
                      Verificar DNI
                    </LoadingButton>

                    {badge && badge.pvcPrintStatus === 'QUEUED_GARITA' && (
                      <LoadingButton
                        type="button"
                        variant="secondary"
                        isLoading={printingBadgeId === badge.id}
                        loadingText="Imprimiendo..."
                        isSuccess={printedBadgeId === badge.id}
                        successText="Impreso"
                        icon={<Printer className="w-3.5 h-3.5" />}
                        onClick={() => handlePrintPvc(badge.id)}
                        title="Registrar impresión de Fotocheck físico PVC"
                        className="min-h-[44px] sm:min-h-0"
                      >
                        PVC
                      </LoadingButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );

  if (!standalone) {
    return content;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
      <TopProgressBar active={verifying || isInitialLoading} />

      {/* Header limpio sin sidebar administrativo */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-black flex items-center justify-center text-base shrink-0">
              B
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">Control de Acceso · Garita</h1>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Minera Bateas · Habilitación por DNI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onBackToAdmin && (
              <button
                type="button"
                onClick={onBackToAdmin}
                className="px-3 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al Panel
              </button>
            )}
            <button
              type="button"
              onClick={() => onRefresh()}
              className="p-2.5 sm:p-2 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 inline-flex items-center justify-center transition cursor-pointer"
              title="Actualizar padrón"
              aria-label="Actualizar padrón"
            >
              <RefreshCw className={`w-4 h-4 ${isInitialLoading ? 'animate-spin text-emerald-700' : ''}`} />
            </button>
            <span className="hidden sm:inline text-xs font-semibold text-slate-700 px-2">
              {authUser.fullName}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="px-3 sm:px-3.5 py-2 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:text-rose-700 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Salir</span>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {content}
    </div>
  );
};
