import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  FileText,
  GraduationCap,
  HardHat,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  LoadingButton,
  SkeletonCard,
  SmartProcessLoader,
} from './ui/LoadingStates';

interface CvProfileData {
  education: Array<{ institution: string; degree: string; year: string }>;
  generalExperience: Array<{ company: string; role: string; period: string; summary?: string }>;
  miningExperience: Array<{ mineOrUnit: string; role: string; years: string; undergroundOrSurface?: string }>;
  specializations: Array<{ name: string; level?: string }>;
  certifications: Array<{ name: string; issuer: string; validUntil?: string }>;
  courses: Array<{ name: string; hours?: string; year?: string }>;
  cvPdfFileName?: string | null;
  cvPdfDataUrl?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

interface Props {
  worker: { id: string; fullName: string; dni: string; jobPosition: string };
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const INPUT_CLASS =
  'w-full px-3 py-2 text-xs text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all duration-200';
const LABEL_CLASS = 'block text-[11px] font-semibold text-slate-600 mb-1';

export const WorkerCvProfileModal: React.FC<Props> = ({
  worker,
  apiFetch,
  onClose,
  onNotify,
}) => {
  const [data, setData] = useState<CvProfileData>({
    education: [],
    generalExperience: [],
    miningExperience: [],
    specializations: [],
    certifications: [],
    courses: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [autofilling, setAutofilling] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/workers/${worker.id}/cv-profile`);
      setData(res.data);
    } catch (err: any) {
      onNotify(`Error cargando perfil CV: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [worker.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/workers/${worker.id}/cv-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          education: data.education,
          generalExperience: data.generalExperience,
          miningExperience: data.miningExperience,
          specializations: data.specializations,
          certifications: data.certifications,
          courses: data.courses,
        }),
      });
      setData(res.data);
      setSavedOk(true);
      window.setTimeout(() => setSavedOk(false), 2000);
      onNotify('Características estructuradas del CV guardadas correctamente.');
    } catch (err: any) {
      onNotify(`Error al guardar CV: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch(`/workers/${worker.id}/cv-profile/pdf`, {
        method: 'POST',
        body: form,
      });
      setData(res.data);
      onNotify('Archivo PDF del CV adjuntado sin sobrescribir tus campos manuales.');
    } catch (err: any) {
      onNotify(`Error subiendo PDF: ${err.message}`);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleAutofill = async () => {
    setAutofilling(true);
    try {
      const res = await apiFetch(`/workers/${worker.id}/cv-profile/autofill`, {
        method: 'POST',
      });
      setData(res.data);
      onNotify('Campos autocompletados desde el PDF con Google Gemini IA.');
    } catch (err: any) {
      onNotify(`Error en autocompletado: ${err.message}`);
    } finally {
      setAutofilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden bateas-fade-in">
        {/* Header limpio y minimalista */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Perfil CV Estructurado — {worker.fullName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              DNI: {worker.dni} · Puesto: {worker.jobPosition}
              {data.updatedAt && (
                <>
                  {' · '}Actualizado el {new Date(data.updatedAt).toLocaleString('es-PE')} por{' '}
                  {data.updatedBy || 'Sistema'}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <LoadingButton
              type="button"
              variant="primary"
              isLoading={saving}
              loadingText="Guardando..."
              isSuccess={savedOk}
              successText="Guardado"
              icon={<Save className="w-3.5 h-3.5" />}
              onClick={handleSave}
            >
              Guardar Cambios
            </LoadingButton>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split: Izquierda Formulario con Labels / Derecha Visor PDF + IA */}
        {loading ? (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#F8FAFC]">
            <div className="lg:col-span-7 space-y-4">
              <SkeletonCard variant="summary" />
              <SkeletonCard variant="summary" />
            </div>
            <div className="lg:col-span-5">
              <SkeletonCard variant="summary" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden bg-[#F8FAFC]">
            {/* Formulario Estructurado (7 cols) */}
            <div className="lg:col-span-7 p-6 overflow-y-auto space-y-5 border-r border-slate-200">
              {/* 1. Formación académica */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-700" />
                    1. Formación Académica
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        education: [...p.education, { institution: '', degree: '', year: '' }],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>

                {data.education.length === 0 && (
                  <p className="text-xs text-slate-400">Sin registros de formación aún.</p>
                )}

                <div className="space-y-3">
                  {data.education.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                    >
                      <div className="col-span-5">
                        <label className={LABEL_CLASS}>Institución</label>
                        <input
                          placeholder="Ej. TECSUP Arequipa"
                          value={item.institution}
                          onChange={(e) => {
                            const next = [...data.education];
                            next[i] = { ...next[i], institution: e.target.value };
                            setData({ ...data, education: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className={LABEL_CLASS}>Título / Grado</label>
                        <input
                          placeholder="Ej. Técnico Operador"
                          value={item.degree}
                          onChange={(e) => {
                            const next = [...data.education];
                            next[i] = { ...next[i], degree: e.target.value };
                            setData({ ...data, education: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={LABEL_CLASS}>Año</label>
                        <input
                          placeholder="2020"
                          value={item.year}
                          onChange={(e) => {
                            const next = [...data.education];
                            next[i] = { ...next[i], year: e.target.value };
                            setData({ ...data, education: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pb-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setData({ ...data, education: data.education.filter((_, idx) => idx !== i) })
                          }
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar fila"
                          aria-label="Eliminar fila de formación"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 2. Experiencia en Minería */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-emerald-700" />
                    2. Experiencia en Minería
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        miningExperience: [
                          ...p.miningExperience,
                          { mineOrUnit: '', role: '', years: '', undergroundOrSurface: 'Socavón' },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>

                {data.miningExperience.length === 0 && (
                  <p className="text-xs text-slate-400">Sin experiencia minera registrada aún.</p>
                )}

                <div className="space-y-3">
                  {data.miningExperience.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                    >
                      <div className="col-span-4">
                        <label className={LABEL_CLASS}>Unidad Minera</label>
                        <input
                          placeholder="Ej. U.M. San Cristóbal"
                          value={item.mineOrUnit}
                          onChange={(e) => {
                            const next = [...data.miningExperience];
                            next[i] = { ...next[i], mineOrUnit: e.target.value };
                            setData({ ...data, miningExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className={LABEL_CLASS}>Cargo / Puesto</label>
                        <input
                          placeholder="Ej. Operador Socavón"
                          value={item.role}
                          onChange={(e) => {
                            const next = [...data.miningExperience];
                            next[i] = { ...next[i], role: e.target.value };
                            setData({ ...data, miningExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className={LABEL_CLASS}>Tiempo / Años</label>
                        <input
                          placeholder="Ej. 4 años"
                          value={item.years}
                          onChange={(e) => {
                            const next = [...data.miningExperience];
                            next[i] = { ...next[i], years: e.target.value };
                            setData({ ...data, miningExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pb-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setData({
                              ...data,
                              miningExperience: data.miningExperience.filter((_, idx) => idx !== i),
                            })
                          }
                          aria-label="Eliminar fila de experiencia en minería"
                          title="Eliminar fila"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Experiencia Laboral General */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-700" />
                    3. Experiencia Laboral General
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        generalExperience: [...p.generalExperience, { company: '', role: '', period: '' }],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>

                {data.generalExperience.length === 0 && (
                  <p className="text-xs text-slate-400">Sin experiencia laboral general registrada.</p>
                )}

                <div className="space-y-3">
                  {data.generalExperience.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                    >
                      <div className="col-span-4">
                        <label className={LABEL_CLASS}>Empresa</label>
                        <input
                          placeholder="Ej. Transportes del Sur"
                          value={item.company}
                          onChange={(e) => {
                            const next = [...data.generalExperience];
                            next[i] = { ...next[i], company: e.target.value };
                            setData({ ...data, generalExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className={LABEL_CLASS}>Puesto</label>
                        <input
                          placeholder="Ej. Operador Logístico"
                          value={item.role}
                          onChange={(e) => {
                            const next = [...data.generalExperience];
                            next[i] = { ...next[i], role: e.target.value };
                            setData({ ...data, generalExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className={LABEL_CLASS}>Periodo</label>
                        <input
                          placeholder="Ej. 2019 - 2021"
                          value={item.period}
                          onChange={(e) => {
                            const next = [...data.generalExperience];
                            next[i] = { ...next[i], period: e.target.value };
                            setData({ ...data, generalExperience: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pb-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setData({
                              ...data,
                              generalExperience: data.generalExperience.filter((_, idx) => idx !== i),
                            })
                          }
                          aria-label="Eliminar fila de experiencia general"
                          title="Eliminar fila"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Especializaciones */}
              <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-700" />
                    4. Especializaciones
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        specializations: [...p.specializations, { name: '', level: 'Avanzado' }],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>

                {data.specializations.length === 0 && (
                  <p className="text-xs text-slate-400">Sin especializaciones registradas aún.</p>
                )}

                <div className="space-y-3">
                  {data.specializations.map((item, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-3 items-end p-3 rounded-xl bg-slate-50/70 border border-slate-100"
                    >
                      <div className="col-span-8">
                        <label className={LABEL_CLASS}>Especialidad / Competencia</label>
                        <input
                          placeholder="Ej. IPERC Continuo y Desate de Rocas"
                          value={item.name}
                          onChange={(e) => {
                            const next = [...data.specializations];
                            next[i] = { ...next[i], name: e.target.value };
                            setData({ ...data, specializations: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-3">
                        <label className={LABEL_CLASS}>Nivel</label>
                        <input
                          placeholder="Avanzado"
                          value={item.level || ''}
                          onChange={(e) => {
                            const next = [...data.specializations];
                            next[i] = { ...next[i], level: e.target.value };
                            setData({ ...data, specializations: next });
                          }}
                          className={INPUT_CLASS}
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pb-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setData({
                              ...data,
                              specializations: data.specializations.filter((_, idx) => idx !== i),
                            })
                          }
                          aria-label="Eliminar fila de especialización"
                          title="Eliminar fila"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Certificaciones y 6. Cursos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-700" />
                      5. Certificaciones
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setData((p) => ({
                          ...p,
                          certifications: [...p.certifications, { name: '', issuer: '', validUntil: '' }],
                        }))
                      }
                      className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                  {data.certifications.length === 0 && (
                    <p className="text-xs text-slate-400">Sin certificaciones registradas aún.</p>
                  )}
                  <div className="space-y-3">
                    {data.certifications.map((item, i) => (
                      <div key={i} className="space-y-2 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className={LABEL_CLASS}>Certificación / Licencia</label>
                            <input
                              placeholder="Ej. Licencia MTC A-IIb"
                              value={item.name}
                              onChange={(e) => {
                                const next = [...data.certifications];
                                next[i] = { ...next[i], name: e.target.value };
                                setData({ ...data, certifications: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setData({
                                ...data,
                                certifications: data.certifications.filter((_, idx) => idx !== i),
                              })
                            }
                            aria-label="Eliminar fila de certificación"
                            title="Eliminar fila"
                            className="p-1.5 mb-0.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={LABEL_CLASS}>Entidad Emisora</label>
                            <input
                              placeholder="Ej. MTC Perú"
                              value={item.issuer}
                              onChange={(e) => {
                                const next = [...data.certifications];
                                next[i] = { ...next[i], issuer: e.target.value };
                                setData({ ...data, certifications: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Vigencia</label>
                            <input
                              placeholder="YYYY-MM-DD"
                              value={item.validUntil || ''}
                              onChange={(e) => {
                                const next = [...data.certifications];
                                next[i] = { ...next[i], validUntil: e.target.value };
                                setData({ ...data, certifications: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-700" />
                      6. Cursos Realizados
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setData((p) => ({
                          ...p,
                          courses: [...p.courses, { name: '', hours: '', year: '' }],
                        }))
                      }
                      className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      + Agregar
                    </button>
                  </div>
                  {data.courses.length === 0 && (
                    <p className="text-xs text-slate-400">Sin cursos adicionales registrados aún.</p>
                  )}
                  <div className="space-y-3">
                    {data.courses.map((item, i) => (
                      <div key={i} className="space-y-2 p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className={LABEL_CLASS}>Nombre del Curso</label>
                            <input
                              placeholder="Ej. Primeros Auxilios"
                              value={item.name}
                              onChange={(e) => {
                                const next = [...data.courses];
                                next[i] = { ...next[i], name: e.target.value };
                                setData({ ...data, courses: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setData({
                                ...data,
                                courses: data.courses.filter((_, idx) => idx !== i),
                              })
                            }
                            aria-label="Eliminar fila de curso"
                            title="Eliminar fila"
                            className="p-1.5 mb-0.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={LABEL_CLASS}>Duración (horas)</label>
                            <input
                              placeholder="Ej. 16h"
                              value={item.hours || ''}
                              onChange={(e) => {
                                const next = [...data.courses];
                                next[i] = { ...next[i], hours: e.target.value };
                                setData({ ...data, courses: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label className={LABEL_CLASS}>Año</label>
                            <input
                              placeholder="2025"
                              value={item.year || ''}
                              onChange={(e) => {
                                const next = [...data.courses];
                                next[i] = { ...next[i], year: e.target.value };
                                setData({ ...data, courses: next });
                              }}
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Columna Derecha: PDF Upload + Preview + Autocompletado IA (5 cols) */}
            <div className="lg:col-span-5 p-6 bg-white flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Documento CV en PDF
                </h4>
                <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition">
                  <Upload className="w-3.5 h-3.5" />
                  {data.cvPdfFileName ? 'Reemplazar PDF' : 'Subir PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <LoadingButton
                type="button"
                variant="ai"
                isLoading={autofilling}
                loadingText="Analizando PDF con Gemini IA..."
                icon={<Sparkles className="w-4 h-4" />}
                onClick={handleAutofill}
                className="w-full py-2.5"
              >
                Autocompletar desde PDF con Gemini IA (Opcional)
              </LoadingButton>

              {autofilling && <SmartProcessLoader active mode="cv_autofill" />}
              {uploadingPdf && <SmartProcessLoader active mode="ocr" title="Cargando documento PDF" />}

              {data.cvPdfFileName ? (
                <div className="flex-1 flex flex-col border border-slate-200 rounded-xl bg-slate-50 overflow-hidden min-h-[380px]">
                  <div className="px-3.5 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-medium text-slate-700 truncate">
                    Archivo: {data.cvPdfFileName}
                  </div>
                  {data.cvPdfDataUrl && (
                    <iframe
                      src={data.cvPdfDataUrl}
                      title="Vista previa CV PDF"
                      className="w-full flex-1 min-h-[350px] bg-white"
                    />
                  )}
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 min-h-[320px] bg-slate-50/50">
                  <FileText className="w-10 h-10 text-slate-300 mb-2.5" />
                  <p className="font-semibold text-slate-700">No hay PDF adjunto aún</p>
                  <p className="mt-1 max-w-xs">
                    Puedes completar manualmente las 6 secciones de la izquierda o adjuntar un PDF para previsualizarlo aquí sin sobrescribir tus campos.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
