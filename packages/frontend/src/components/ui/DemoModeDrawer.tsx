import React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  UserCog,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { LoadingButton, SmartProcessLoader } from './LoadingStates';

export type DemoScenarioType =
  | 'ZERO_TOUCH_GREEN'
  | 'EXCEPTION_AMBER'
  | 'EXPIRED_RED'
  | 'BLACKLISTED_RED';

interface DemoModeDrawerProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  activeRoleLabel: 'ADMIN_ECM' | 'SSOMA_DHO' | 'GARITA';
  onSwitchRoleView: (role: 'ADMIN_ECM' | 'SSOMA_DHO' | 'GARITA') => void;
  onCreateDemoScenario: (scenario: DemoScenarioType) => Promise<void> | void;
  showRowSimulators?: boolean;
  onToggleRowSimulators?: () => void;
}

export const DemoModeDrawer: React.FC<DemoModeDrawerProps> = ({
  open,
  onClose,
  loading,
  activeRoleLabel,
  onSwitchRoleView,
  onCreateDemoScenario,
  showRowSimulators = false,
  onToggleRowSimulators,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Modo Demo y Presentación">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <aside className="relative z-10 w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col bateas-slide-in-right">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Modo Demo y Presentación</h3>
              <p className="text-[11px] text-slate-500">
                Herramientas auxiliares ocultas del flujo operativo diario
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Cerrar panel de Modo Demo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Bloque 1: Cambio rápido de vista de rol */}
          <section className="space-y-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Simulador de Vista por Rol
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Cambia rápidamente entre las vistas administrativas durante una demostración.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  onSwitchRoleView('ADMIN_ECM');
                  onClose();
                }}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 cursor-pointer ${
                  activeRoleLabel === 'ADMIN_ECM'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Users className="w-4 h-4 shrink-0 text-emerald-700" />
                <div className="flex-1">
                  <div className="text-xs font-bold">Admin ECM / Contratista</div>
                  <div className="text-[11px] text-slate-500">
                    Afiliados, carga OCR en 2 etapas y Perfil CV
                  </div>
                </div>
                {activeRoleLabel === 'ADMIN_ECM' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Activa
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSwitchRoleView('SSOMA_DHO');
                  onClose();
                }}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 cursor-pointer ${
                  activeRoleLabel === 'SSOMA_DHO'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <UserCog className="w-4 h-4 shrink-0 text-emerald-700" />
                <div className="flex-1">
                  <div className="text-xs font-bold">Revisor SSOMA / Médico / DHO</div>
                  <div className="text-[11px] text-slate-500">
                    Panel KPIs, Excepciones IA, Capacitaciones y Reportes
                  </div>
                </div>
                {activeRoleLabel === 'SSOMA_DHO' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Activa
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSwitchRoleView('GARITA');
                  onClose();
                }}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 cursor-pointer ${
                  activeRoleLabel === 'GARITA'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
                <div className="flex-1">
                  <div className="text-xs font-bold">Control de Acceso (Garita DNI)</div>
                  <div className="text-[11px] text-slate-500">
                    Consulta directa por DNI y Estado de Habilitación
                  </div>
                </div>
                {activeRoleLabel === 'GARITA' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Activa
                  </span>
                )}
              </button>
            </div>
          </section>

          {/* Bloque 2: Generador de escenarios OCR */}
          <section className="space-y-3 pt-4 border-t border-slate-200">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Generar Expediente Demo (Motor OCR)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Crea expedientes sintéticos reales en PostgreSQL para probar cada estado del semáforo.
              </p>
            </div>

            {loading && <SmartProcessLoader active={loading} mode="ocr" />}

            <div className="grid grid-cols-1 gap-2.5">
              <LoadingButton
                type="button"
                variant="primary"
                isLoading={loading}
                loadingText="Generando expediente..."
                onClick={() => onCreateDemoScenario('ZERO_TOUCH_GREEN')}
                icon={<CheckCircle2 className="w-4 h-4" />}
                className="w-full justify-start py-2.5 px-3.5"
              >
                100% Zero-Touch (Habilitado)
              </LoadingButton>

              <LoadingButton
                type="button"
                variant="secondary"
                isLoading={loading}
                loadingText="Generando excepción..."
                onClick={() => onCreateDemoScenario('EXCEPTION_AMBER')}
                icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                className="w-full justify-start py-2.5 px-3.5"
              >
                Excepción EMO (Observado / Ámbar)
              </LoadingButton>

              <LoadingButton
                type="button"
                variant="secondary"
                isLoading={loading}
                loadingText="Generando vencido..."
                onClick={() => onCreateDemoScenario('EXPIRED_RED')}
                icon={<XCircle className="w-4 h-4 text-rose-600" />}
                className="w-full justify-start py-2.5 px-3.5"
              >
                SCTR Vencido (Bloqueado / Rojo)
              </LoadingButton>

              <LoadingButton
                type="button"
                variant="danger"
                isLoading={loading}
                loadingText="Verificando Lista Negra..."
                onClick={() => onCreateDemoScenario('BLACKLISTED_RED')}
                icon={<Ban className="w-4 h-4" />}
                className="w-full justify-start py-2.5 px-3.5"
              >
                Caso Lista Negra (Bloqueo Preventivo)
              </LoadingButton>
            </div>
          </section>

          {onToggleRowSimulators && (
            <section className="space-y-2.5 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Simulación por Fila (Afiliados)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Muestra botones rápidos de simulación OCR (Vigente / Observado / Vencido) en cada requisito.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showRowSimulators}
                  aria-label="Mostrar controles de simulación OCR en filas"
                  onClick={onToggleRowSimulators}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    showRowSimulators ? 'bg-emerald-700' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      showRowSimulators ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
          Para probar el <strong>Portal Aislado del Trabajador</strong>, cierra sesión e ingresa con{' '}
          <code className="text-slate-700 font-semibold">trabajador@bateas.pe</code>.
        </div>
      </aside>
    </div>
  );
};
