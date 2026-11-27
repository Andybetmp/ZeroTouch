import React, { useEffect, useState } from 'react';
import {
  Check,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  ScanLine,
  Sparkles,
} from 'lucide-react';

/* ==========================================================================
   1. TopProgressBar — Barra sutil de 2px en la parte superior del viewport
   ========================================================================== */
export interface TopProgressBarProps {
  active: boolean;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({ active }) => {
  if (!active) return null;
  return (
    <div
      role="progressbar"
      aria-label="Cargando contenido"
      aria-busy="true"
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[60] bg-emerald-100/70 overflow-hidden pointer-events-none"
    >
      <div className="h-full w-full bg-emerald-600 bateas-top-progress origin-left rounded-full" />
    </div>
  );
};

/* ==========================================================================
   2. SkeletonCard — Esqueletos con shimmer suave para tarjetas KPI / cursos
   ========================================================================== */
export interface SkeletonCardProps {
  variant?: 'kpi' | 'course' | 'summary' | 'worker';
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  variant = 'kpi',
  className = '',
}) => {
  if (variant === 'kpi') {
    return (
      <div
        className={`bg-white rounded-xl border border-slate-200 p-5 space-y-3 ${className}`}
        aria-hidden="true"
      >
        <div className="h-3 w-24 rounded-md bateas-shimmer" />
        <div className="h-7 w-16 rounded-md bateas-shimmer" />
        <div className="h-2.5 w-32 rounded-md bateas-shimmer" />
      </div>
    );
  }

  if (variant === 'summary') {
    return (
      <div
        className={`bg-white rounded-xl border border-slate-200 p-6 space-y-5 ${className}`}
        aria-hidden="true"
      >
        <div className="flex gap-2">
          <div className="h-6 w-36 rounded-full bateas-shimmer" />
          <div className="h-6 w-32 rounded-full bateas-shimmer" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-64 rounded-md bateas-shimmer" />
          <div className="h-3.5 w-28 rounded-md bateas-shimmer" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3.5 w-40 rounded-md bateas-shimmer" />
            <div className="h-3.5 w-10 rounded-md bateas-shimmer" />
          </div>
          <div className="h-2.5 w-full rounded-full bateas-shimmer" />
        </div>
      </div>
    );
  }

  if (variant === 'worker') {
    return (
      <div
        className={`bg-white rounded-xl border border-slate-200 p-5 space-y-4 ${className}`}
        aria-hidden="true"
      >
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 rounded-full bateas-shimmer" />
          <div className="h-4 w-20 rounded-md bateas-shimmer" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-48 rounded-md bateas-shimmer" />
          <div className="h-3 w-36 rounded-md bateas-shimmer" />
        </div>
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="h-3 w-full rounded-md bateas-shimmer" />
          <div className="h-3 w-3/4 rounded-md bateas-shimmer" />
        </div>
        <div className="h-9 w-full rounded-lg bateas-shimmer" />
      </div>
    );
  }

  // variant === 'course'
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 p-6 space-y-5 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 rounded-full bateas-shimmer" />
        <div className="h-4 w-20 rounded-md bateas-shimmer" />
      </div>
      <div className="space-y-2">
        <div className="h-5 w-4/5 rounded-md bateas-shimmer" />
        <div className="h-3.5 w-16 rounded-md bateas-shimmer" />
      </div>
      <div className="h-10 w-full rounded-xl bateas-shimmer" />
    </div>
  );
};

/* ==========================================================================
   3. SkeletonTable — Esqueleto limpio para tablas de reportes / afiliados
   ========================================================================== */
export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 5,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div
        className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: columns }).map((_, idx) => (
          <div key={idx} className="h-3 w-20 rounded bateas-shimmer" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            className="px-5 py-4 grid gap-4 items-center"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((__, cIdx) => (
              <div
                key={cIdx}
                className={`h-3.5 rounded bateas-shimmer ${
                  cIdx === 0 ? 'w-3/4' : cIdx === columns - 1 ? 'w-16 ml-auto' : 'w-2/3'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ==========================================================================
   4. SmartProcessLoader — Loader amigable con progreso fluido y mensajes
   ========================================================================== */
export type SmartLoaderMode = 'ocr' | 'gemini' | 'cv_autofill' | 'sync' | 'pdf' | 'default';

const LOADER_CONFIG: Record<
  SmartLoaderMode,
  {
    title: string;
    messages: string[];
    accentBg: string;
    accentText: string;
    barColor: string;
  }
> = {
  ocr: {
    title: 'Procesando documento con OCR',
    messages: [
      'Leyendo documento...',
      'Extrayendo DNI y fechas clave...',
      'Validando vigencia y legibilidad...',
      'Aplicando reglas operativas SSOMA...',
    ],
    accentBg: 'bg-emerald-50 border-emerald-200',
    accentText: 'text-emerald-700',
    barColor: 'bg-emerald-600',
  },
  gemini: {
    title: 'Analizando con Gemini IA',
    messages: [
      'Conectando con Google Gemini IA...',
      'Evaluando consistencia documental...',
      'Verificando competencias y vigencia...',
      'Preparando recomendación asistida...',
    ],
    accentBg: 'bg-indigo-50 border-indigo-200',
    accentText: 'text-indigo-700',
    barColor: 'bg-indigo-600',
  },
  cv_autofill: {
    title: 'Autocompletando Perfil CV con IA',
    messages: [
      'Leyendo hoja de vida en PDF...',
      'Identificando formación y experiencia minera...',
      'Clasificando certificaciones y cursos...',
      'Completando las 6 secciones estructuradas...',
    ],
    accentBg: 'bg-indigo-50 border-indigo-200',
    accentText: 'text-indigo-700',
    barColor: 'bg-indigo-600',
  },
  sync: {
    title: 'Sincronizando cursos por área',
    messages: [
      'Verificando áreas de ingreso...',
      'Asignando Inducción General y cursos del área...',
      'Recalculando estados de habilitación...',
    ],
    accentBg: 'bg-emerald-50 border-emerald-200',
    accentText: 'text-emerald-700',
    barColor: 'bg-emerald-600',
  },
  pdf: {
    title: 'Generando documento oficial',
    messages: [
      'Compilando historial de capacitación...',
      'Formateando documento corporativo...',
      'Preparando descarga...',
    ],
    accentBg: 'bg-slate-100 border-slate-200',
    accentText: 'text-slate-700',
    barColor: 'bg-emerald-600',
  },
  default: {
    title: 'Procesando solicitud',
    messages: [
      'Consultando registros en tiempo real...',
      'Validando información...',
      'Finalizando actualización...',
    ],
    accentBg: 'bg-emerald-50 border-emerald-200',
    accentText: 'text-emerald-700',
    barColor: 'bg-emerald-600',
  },
};

export interface SmartProcessLoaderProps {
  active: boolean;
  mode?: SmartLoaderMode;
  title?: string;
  customMessages?: string[];
  variant?: 'inline' | 'overlay';
  className?: string;
}

export const SmartProcessLoader: React.FC<SmartProcessLoaderProps> = ({
  active,
  mode = 'default',
  title,
  customMessages,
  variant = 'inline',
  className = '',
}) => {
  const cfg = LOADER_CONFIG[mode];
  const messages = customMessages && customMessages.length > 0 ? customMessages : cfg.messages;
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(14);

  useEffect(() => {
    if (!active) {
      setMsgIndex(0);
      setProgress(14);
      return;
    }

    const msgTimer = window.setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 1700);

    const progTimer = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return Math.min(92, prev + Math.max(2, Math.round((94 - prev) * 0.14)));
      });
    }, 350);

    return () => {
      window.clearInterval(msgTimer);
      window.clearInterval(progTimer);
    };
  }, [active, messages.length]);

  if (!active) return null;

  const renderIcon = () => {
    if (mode === 'ocr') {
      return (
        <div className="relative w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center overflow-hidden shrink-0">
          <FileSearch className="w-5 h-5 text-emerald-700" />
          <div className="absolute left-1 right-1 h-0.5 bg-emerald-500/80 rounded-full bateas-scan-beam" />
        </div>
      );
    }
    if (mode === 'gemini' || mode === 'cv_autofill') {
      return (
        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
        </div>
      );
    }
    if (mode === 'sync') {
      return (
        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-emerald-700 animate-spin" />
        </div>
      );
    }
    if (mode === 'pdf') {
      return (
        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-slate-700 animate-pulse" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
        <ScanLine className="w-5 h-5 text-emerald-700 animate-pulse" />
      </div>
    );
  };

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm bateas-fade-in ${className}`}
    >
      <div className="flex items-center gap-3.5">
        {renderIcon()}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-900 truncate">{title || cfg.title}</p>
            <span className={`text-[11px] font-semibold ${cfg.accentText}`}>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${cfg.barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 transition-opacity duration-200">
            {messages[msgIndex]}
          </p>
        </div>
      </div>
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center p-4">
        <div className="w-full max-w-md">{content}</div>
      </div>
    );
  }

  return content;
};

/* ==========================================================================
   5. LoadingButton — Botón que preserva ancho, muestra spinner y check verde
   ========================================================================== */
export type LoadingButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'danger';

const VARIANT_CLASSES: Record<LoadingButtonVariant, string> = {
  primary: 'bg-emerald-700 hover:bg-emerald-800 text-white border border-transparent shadow-2xs',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border border-transparent',
  ai: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200',
  danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200',
};

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  isSuccess?: boolean;
  successText?: string;
  variant?: LoadingButtonVariant;
  icon?: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading = false,
  loadingText,
  isSuccess = false,
  successText,
  variant = 'primary',
  icon,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  return (
    <button
      {...rest}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ease-out cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{loadingText || children}</span>
        </>
      ) : isSuccess ? (
        <>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 bateas-check-pop">
            <Check className="w-3 h-3 stroke-[3]" />
          </span>
          <span>{successText || 'Listo'}</span>
        </>
      ) : (
        <>
          {icon}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

/* ==========================================================================
   6. BrandLoadingScreen — Pantalla de carga interactiva de arranque / sesión
   ========================================================================== */
export type BrandLoadingRole = 'BOOT' | 'SSOMA' | 'ECM' | 'GARITA' | 'TRABAJADOR';

const ROLE_LOADING_COPY: Record<
  BrandLoadingRole,
  {
    headline: string;
    subtitle: string;
    steps: string[];
  }
> = {
  BOOT: {
    headline: 'Iniciando App Bateas v3.0',
    subtitle: 'Minera Bateas S.A.C. · Plataforma Zero-Touch',
    steps: [
      'Conectando servicios de habilitación',
      'Verificando módulos y seguridad RBAC',
      'Preparando experiencia de acceso',
    ],
  },
  SSOMA: {
    headline: 'Preparando Torre SSOMA / DHO',
    subtitle: 'Indicadores, Excepciones IA y Capacitación por Área',
    steps: [
      'Validando permisos de auditoría SSOMA',
      'Sincronizando expedientes y semáforo operativo',
      'Cargando panel de control en tiempo real',
    ],
  },
  ECM: {
    headline: 'Cargando Portal Contratista ECM',
    subtitle: 'Gestión de Afiliados, Motor OCR y Perfil CV',
    steps: [
      'Verificando credenciales de empresa contratista',
      'Sincronizando padrón y requisitos en 2 etapas',
      'Habilitando gestión documental por área',
    ],
  },
  GARITA: {
    headline: 'Activando Control de Acceso · Garita',
    subtitle: 'Validación instantánea de Estado de Habilitación por DNI',
    steps: [
      'Conectando con el padrón de personal vigente',
      'Sincronizando alertas y bloqueos preventivos',
      'Listo para consulta rápida por DNI',
    ],
  },
  TRABAJADOR: {
    headline: 'Preparando tu Portal del Trabajador',
    subtitle: 'Cursos asignados automáticamente según tu área de ingreso',
    steps: [
      'Verificando tu identidad y área asignada',
      'Cargando Inducción General y cursos del área',
      'Actualizando tu Estado de Habilitación',
    ],
  },
};

export interface BrandLoadingScreenProps {
  role?: BrandLoadingRole;
  userName?: string;
}

export const BrandLoadingScreen: React.FC<BrandLoadingScreenProps> = ({
  role = 'BOOT',
  userName,
}) => {
  const cfg = ROLE_LOADING_COPY[role];
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(22);

  useEffect(() => {
    setStepIdx(0);
    setProgress(22);

    const stepTimer = window.setInterval(() => {
      setStepIdx((prev) => (prev < cfg.steps.length - 1 ? prev + 1 : prev));
    }, 320);

    const progTimer = window.setInterval(() => {
      setProgress((prev) => (prev >= 96 ? 96 : Math.min(96, prev + 14)));
    }, 140);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progTimer);
    };
  }, [role, cfg.steps.length]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={cfg.headline}
      className="fixed inset-0 z-[70] bg-[#F8FAFC] flex items-center justify-center p-6 font-sans bateas-fade-in"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6 overflow-hidden">
        {/* Top emerald accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
          <div
            className="h-full bg-emerald-700 transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Emblema animado corporativo */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-16 h-16 rounded-2xl bg-emerald-500/15 animate-ping" />
            <div className="relative w-14 h-14 rounded-2xl bg-emerald-700 text-white font-black text-2xl flex items-center justify-center shadow-sm">
              B
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              App Bateas v3.0 · Zero-Touch
            </p>
            <h2 className="text-base font-bold text-slate-900">{cfg.headline}</h2>
            <p className="text-xs text-slate-500">
              {userName ? `Bienvenido, ${userName}` : cfg.subtitle}
            </p>
          </div>
        </div>

        {/* Checklist interactiva progresiva */}
        <div className="space-y-2.5 bg-slate-50/80 rounded-xl border border-slate-200/80 p-4">
          {cfg.steps.map((label, idx) => {
            const isDone = idx < stepIdx;
            const isCurrent = idx === stepIdx;
            return (
              <div
                key={label}
                className={`flex items-center gap-2.5 text-xs transition-all duration-200 ${
                  isDone
                    ? 'text-emerald-800 font-medium'
                    : isCurrent
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {isDone ? (
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center shrink-0 bateas-check-pop">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-300 bg-white shrink-0" />
                )}
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {/* Barra de progreso con porcentaje */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">{cfg.steps[stepIdx]}...</span>
            <span className="font-semibold text-emerald-700">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-700 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
