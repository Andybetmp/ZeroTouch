import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Glasses, ShieldAlert, X, XCircle } from 'lucide-react';

interface VrSimulatorModalProps {
  workerId: string;
  workerName: string;
  token: string;
  passedScenarios: string[];
  onCompleted: () => void;
  onClose: () => void;
}

interface ScenarioStep {
  question: string;
  options: { label: string; isCorrect: boolean; criticalError?: string }[];
}

const SCENARIO_DEFINITIONS: Record<
  'SCALING_ROCK' | 'GAS_VENTILATION' | 'HEAVY_MACHINERY' | 'LOTO_LOCKOUT',
  { title: string; subtitle: string; steps: ScenarioStep[] }
> = {
  SCALING_ROCK: {
    title: '1. Desate de Rocas Sueltas (SCALING_ROCK)',
    subtitle: 'Simulación de galería subterránea: inspección de techo, hastiales y uso de barretilla.',
    steps: [
      {
        question: 'Al ingresar al frente de avance en socavón, observas planchones fisurados en el techo. ¿Cuál es tu primera acción?',
        options: [
          {
            label: 'Colocarse bajo techo sostenido, iluminar la corona y usar barretilla de longitud adecuada a 45°.',
            isCorrect: true,
          },
          {
            label: 'Ingresar directamente debajo de la roca suelta para perforar rápido.',
            isCorrect: false,
            criticalError: 'Ingresar a labor sin desatar ubicándose bajo roca suelta (Riesgo Mortal de caída de rocas).',
          },
        ],
      },
      {
        question: '¿Cómo verificas que el macizo rocoso quedó estable tras el desate?',
        options: [
          {
            label: 'Golpear suavemente con la barretilla escuchando sonido metálico/compacto (no hueco) de afuera hacia adentro.',
            isCorrect: true,
          },
          {
            label: 'Asumir que está seguro si no cayó nada en 5 segundos.',
            isCorrect: false,
            criticalError: 'Omitir prueba de sonido y avance progresivo de afuera hacia adentro.',
          },
        ],
      },
    ],
  },
  GAS_VENTILATION: {
    title: '2. Monitoreo de Gases y Ventilación (GAS_VENTILATION)',
    subtitle: 'Verificación de atmósfera subterránea con detector multigás y manga de ventilación.',
    steps: [
      {
        question: 'El detector multigás marca O₂ = 18.2% y CO = 45 ppm en la galería. ¿Qué debes hacer?',
        options: [
          {
            label: 'Detener el ingreso de inmediato, evacuar a zona ventilada y reportar a supervisión/SSOMA.',
            isCorrect: true,
          },
          {
            label: 'Ingresar igual porque el trabajo dura menos de 10 minutos.',
            isCorrect: false,
            criticalError: 'Ingreso a labor con O2 < 19.5% y CO > 25 ppm (Riesgo de asfixia/intoxicación).',
          },
        ],
      },
      {
        question: '¿A qué distancia máxima del frente debe llegar la manga de ventilación auxiliar?',
        options: [
          { label: 'Máximo a 15 metros del frente de trabajo, sin estrangulamientos ni roturas.', isCorrect: true },
          {
            label: 'A 60 metros es suficiente mientras haya aire en el crucero.',
            isCorrect: false,
            criticalError: 'Ventilación deficiente: manga de ventilación fuera de estándar (> 15 m).',
          },
        ],
      },
    ],
  },
  HEAVY_MACHINERY: {
    title: '3. Interacción con Maquinaria Pesada (HEAVY_MACHINERY)',
    subtitle: 'Tránsito seguro frente a Scooptram y Dumper en galerías subterráneas.',
    steps: [
      {
        question: 'Un Scooptram cargado se aproxima por la galería donde caminas. ¿Qué protocolo aplicas?',
        options: [
          {
            label: 'Ingresar al refugio peatonal más cercano, hacer señal de detención con la lámpara y esperar confirmación.',
            isCorrect: true,
          },
          {
            label: 'Pegarse a la pared del hastial y seguir caminando mientras pasa el equipo.',
            isCorrect: false,
            criticalError: 'No utilizar refugio peatonal ante tránsito de Scooptram (Riesgo de atropello/aplastamiento).',
          },
        ],
      },
    ],
  },
  LOTO_LOCKOUT: {
    title: '4. Bloqueo y Etiquetado LOTO (LOTO_LOCKOUT)',
    subtitle: 'Aplicación de las 5 Reglas de Oro en tablero eléctrico de bomba sumergible.',
    steps: [
      {
        question: 'Antes de intervenir el tablero eléctrico en cámara de bombeo, ¿qué secuencia es obligatoria?',
        options: [
          {
            label: 'Cortar energía, colocar candado y tarjeta personal, verificar energía cero con revelador y probar arranque.',
            isCorrect: true,
          },
          {
            label: 'Solo bajar la llave térmica y avisar por radio que nadie la suba.',
            isCorrect: false,
            criticalError: 'Omitir bloqueo físico personal (candado+tarjeta) y prueba de energía cero.',
          },
        ],
      },
    ],
  },
};

export const VrSimulatorModal: React.FC<VrSimulatorModalProps> = ({
  workerId,
  workerName,
  token,
  passedScenarios,
  onCompleted,
  onClose,
}) => {
  const [selectedCode, setSelectedCode] = useState<keyof typeof SCENARIO_DEFINITIONS>('SCALING_ROCK');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [stepAnswers, setStepAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const scenario = SCENARIO_DEFINITIONS[selectedCode];

  const handleGeneratePairing = async () => {
    const res = await fetch('/api/v1/vr/sessions/pair', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workerId }),
    }).then((r) => r.json());
    if (res.success) {
      setPairingCode(res.data.pairingCode);
    }
  };

  const handleSubmitSimulation = async (forceCriticalFail = false) => {
    setSubmitting(true);
    setLastResult(null);
    try {
      const criticalErrors: string[] = [];
      let correctCount = 0;

      scenario.steps.forEach((st, idx) => {
        const chosenIdx = stepAnswers[idx] ?? 0;
        const opt = st.options[chosenIdx];
        if (opt?.isCorrect) {
          correctCount += 1;
        } else if (opt?.criticalError) {
          criticalErrors.push(opt.criticalError);
        }
      });

      if (forceCriticalFail) {
        criticalErrors.push('Falla crítica simulada: Ingreso a labor sin verificar gases (O2 < 19.5%).');
      }

      const score = forceCriticalFail
        ? 85 // Demuestra que aunque el puntaje sea >= 80, un error crítico reprueba el escenario
        : Math.round((correctCount / scenario.steps.length) * 100);

      const res = await fetch('/api/v1/vr/sessions/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workerId,
          pairingCode: pairingCode || 'WEBXR-SIM',
          scenarioCode: selectedCode,
          score,
          durationSeconds: 360,
          criticalErrors,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setLastResult(res.data);
        onCompleted();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-[#1e282c] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Glasses className="w-6 h-6 text-sky-400" />
            <div>
              <h3 className="text-sm font-black">Pasarela & Simulador WebXR de Entrenamiento RV — Socavón</h3>
              <p className="text-[11px] text-slate-300">
                Trabajador: {workerName} · Aprobados: {passedScenarios.length}/4 escenarios obligatorios
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Pasarela de emparejamiento físico Quest/Pico */}
          <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-bold text-sky-900 block">
                🔌 Emparejamiento con Visor RV Físico (Unity / Unreal / Meta Quest)
              </span>
              <span className="text-[11px] text-sky-700">
                Genere un PIN de 6 dígitos para vincular un casco físico al expediente o ejecute el simulador WebXR abajo.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pairingCode && (
                <span className="px-3 py-1.5 rounded bg-slate-900 text-emerald-400 font-mono font-black text-sm tracking-widest">
                  PIN: {pairingCode}
                </span>
              )}
              <button
                type="button"
                onClick={handleGeneratePairing}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded cursor-pointer flex items-center gap-1"
              >
                <Cpu className="w-3.5 h-3.5" /> Generar Código Visor
              </button>
            </div>
          </div>

          {/* Selector de los 4 Escenarios Obligatorios */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(SCENARIO_DEFINITIONS) as Array<keyof typeof SCENARIO_DEFINITIONS>).map((code) => {
              const isPassed = passedScenarios.includes(code);
              const isActive = selectedCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(code);
                    setStepAnswers({});
                    setLastResult(null);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900'
                      : isPassed
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase">{code.split('_')[0]}</span>
                    {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <p className="font-bold text-[11px] line-clamp-2">{SCENARIO_DEFINITIONS[code].title}</p>
                </button>
              );
            })}
          </div>

          {/* Escenario Activo Interactivo */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3">
            <div>
              <h4 className="font-black text-sm text-slate-900">{scenario.title}</h4>
              <p className="text-slate-600">{scenario.subtitle}</p>
            </div>

            {scenario.steps.map((st, idx) => (
              <div key={idx} className="p-3 rounded bg-white border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800">
                  Situación {idx + 1}: {st.question}
                </p>
                <div className="space-y-1.5">
                  {st.options.map((opt, optIdx) => (
                    <label key={optIdx} className="flex items-start gap-2 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name={`vr_step_${idx}`}
                        checked={(stepAnswers[idx] ?? 0) === optIdx}
                        onChange={() => setStepAnswers({ ...stepAnswers, [idx]: optIdx })}
                        className="mt-0.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {lastResult && (
            <div
              className={`p-3.5 rounded-lg border-2 font-semibold flex items-start gap-2 ${
                lastResult.passed
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-rose-50 border-rose-400 text-rose-950'
              }`}
            >
              {lastResult.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <p className="font-black">
                  {lastResult.passed
                    ? `ESCENARIO APROBADO (${lastResult.session.score}/100) — Sincronizado con Días 3-4`
                    : `ESCENARIO REPROBADO (${lastResult.session.score}/100) — Requiere Repetición`}
                </p>
                {lastResult.hasCriticalErrors && (
                  <p className="text-[11px] mt-0.5">
                    Errores críticos detectados: {lastResult.session.criticalErrorsJson}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitSimulation(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold rounded cursor-pointer flex items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Simular Error Crítico (Reprueba aunque puntaje = 85)
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitSimulation(false)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow cursor-pointer"
            >
              {submitting ? 'Enviando telemetría RV...' : 'Finalizar Escenario y Sincronizar Telemetría RV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
