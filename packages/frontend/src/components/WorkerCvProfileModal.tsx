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
      onNotify('Características estructuradas del CV guardadas correctamente.');
    } catch (err: any) {
      onNotify(`Error al guardar CV: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
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
    }
  };

  const handleAutofill = async () => {
    setAutofilling(true);
    try {
      const res = await apiFetch(`/workers/${worker.id}/cv-profile/autofill`, {
        method: 'POST',
      });
      setData(res.data);
      onNotify('Campos autocompletados desde el PDF con Inteligencia Artificial.');
    } catch (err: any) {
      onNotify(`Error en autocompletado: ${err.message}`);
    } finally {
      setAutofilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#222d32] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">
              Perfil CV Estructurado — {worker.fullName} (DNI: {worker.dni})
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Puesto: {worker.jobPosition}
              {data.updatedAt && (
                <>
                  {' · '}Última actualización: {new Date(data.updatedAt).toLocaleString('es-PE')} por{' '}
                  {data.updatedBy || 'Sistema'}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Split: Left Form / Right PDF Preview */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Cargando perfil CV...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
            {/* Formulario Estructurado (7 cols) */}
            <div className="lg:col-span-7 p-5 overflow-y-auto space-y-5 border-r border-slate-200">
              {/* 1. Formación académica */}
              <section className="border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Formación Académica
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        education: [...p.education, { institution: '', degree: '', year: '' }],
                      }))
                    }
                    className="text-xs text-indigo-600 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {data.education.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Institución"
                        value={item.institution}
                        onChange={(e) => {
                          const next = [...data.education];
                          next[i] = { ...next[i], institution: e.target.value };
                          setData({ ...data, education: next });
                        }}
                        className="col-span-5 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Título / Grado"
                        value={item.degree}
                        onChange={(e) => {
                          const next = [...data.education];
                          next[i] = { ...next[i], degree: e.target.value };
                          setData({ ...data, education: next });
                        }}
                        className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Año"
                        value={item.year}
                        onChange={(e) => {
                          const next = [...data.education];
                          next[i] = { ...next[i], year: e.target.value };
                          setData({ ...data, education: next });
                        }}
                        className="col-span-2 px-2 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <button
                        onClick={() =>
                          setData({ ...data, education: data.education.filter((_, idx) => idx !== i) })
                        }
                        className="col-span-1 text-rose-500 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 2. Experiencia en Minería */}
              <section className="border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-amber-600" />
                    Experiencia en Minería
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
                    className="text-xs text-amber-600 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {data.miningExperience.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Unidad Minera"
                        value={item.mineOrUnit}
                        onChange={(e) => {
                          const next = [...data.miningExperience];
                          next[i] = { ...next[i], mineOrUnit: e.target.value };
                          setData({ ...data, miningExperience: next });
                        }}
                        className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Cargo"
                        value={item.role}
                        onChange={(e) => {
                          const next = [...data.miningExperience];
                          next[i] = { ...next[i], role: e.target.value };
                          setData({ ...data, miningExperience: next });
                        }}
                        className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Años"
                        value={item.years}
                        onChange={(e) => {
                          const next = [...data.miningExperience];
                          next[i] = { ...next[i], years: e.target.value };
                          setData({ ...data, miningExperience: next });
                        }}
                        className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <button
                        onClick={() =>
                          setData({
                            ...data,
                            miningExperience: data.miningExperience.filter((_, idx) => idx !== i),
                          })
                        }
                        className="col-span-1 text-rose-500 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. Experiencia Laboral General */}
              <section className="border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-sky-600" />
                    Experiencia Laboral General
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        generalExperience: [...p.generalExperience, { company: '', role: '', period: '' }],
                      }))
                    }
                    className="text-xs text-sky-600 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {data.generalExperience.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Empresa"
                        value={item.company}
                        onChange={(e) => {
                          const next = [...data.generalExperience];
                          next[i] = { ...next[i], company: e.target.value };
                          setData({ ...data, generalExperience: next });
                        }}
                        className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Puesto"
                        value={item.role}
                        onChange={(e) => {
                          const next = [...data.generalExperience];
                          next[i] = { ...next[i], role: e.target.value };
                          setData({ ...data, generalExperience: next });
                        }}
                        className="col-span-4 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Periodo"
                        value={item.period}
                        onChange={(e) => {
                          const next = [...data.generalExperience];
                          next[i] = { ...next[i], period: e.target.value };
                          setData({ ...data, generalExperience: next });
                        }}
                        className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <button
                        onClick={() =>
                          setData({
                            ...data,
                            generalExperience: data.generalExperience.filter((_, idx) => idx !== i),
                          })
                        }
                        className="col-span-1 text-rose-500 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Especializaciones */}
              <section className="border border-slate-200 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Especializaciones
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setData((p) => ({
                        ...p,
                        specializations: [...p.specializations, { name: '', level: 'Avanzado' }],
                      }))
                    }
                    className="text-xs text-emerald-600 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {data.specializations.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        placeholder="Especialidad"
                        value={item.name}
                        onChange={(e) => {
                          const next = [...data.specializations];
                          next[i] = { ...next[i], name: e.target.value };
                          setData({ ...data, specializations: next });
                        }}
                        className="col-span-8 px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <input
                        placeholder="Nivel"
                        value={item.level || ''}
                        onChange={(e) => {
                          const next = [...data.specializations];
                          next[i] = { ...next[i], level: e.target.value };
                          setData({ ...data, specializations: next });
                        }}
                        className="col-span-3 px-2 py-1.5 text-xs border border-slate-300 rounded"
                      />
                      <button
                        onClick={() =>
                          setData({
                            ...data,
                            specializations: data.specializations.filter((_, idx) => idx !== i),
                          })
                        }
                        className="col-span-1 text-rose-500 flex justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Certificaciones y 6. Cursos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="border border-slate-200 rounded-lg p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-rose-600" />
                      Certificaciones
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setData((p) => ({
                          ...p,
                          certifications: [...p.certifications, { name: '', issuer: '', validUntil: '' }],
                        }))
                      }
                      className="text-xs text-rose-600 font-semibold"
                    >
                      + Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {data.certifications.map((item, i) => (
                      <div key={i} className="space-y-1 border-b border-slate-100 pb-2">
                        <div className="flex gap-1">
                          <input
                            placeholder="Certificación"
                            value={item.name}
                            onChange={(e) => {
                              const next = [...data.certifications];
                              next[i] = { ...next[i], name: e.target.value };
                              setData({ ...data, certifications: next });
                            }}
                            className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              setData({
                                ...data,
                                certifications: data.certifications.filter((_, idx) => idx !== i),
                              })
                            }
                            className="text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            placeholder="Emisor"
                            value={item.issuer}
                            onChange={(e) => {
                              const next = [...data.certifications];
                              next[i] = { ...next[i], issuer: e.target.value };
                              setData({ ...data, certifications: next });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                          <input
                            placeholder="Vigencia"
                            value={item.validUntil || ''}
                            onChange={(e) => {
                              const next = [...data.certifications];
                              next[i] = { ...next[i], validUntil: e.target.value };
                              setData({ ...data, certifications: next });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border border-slate-200 rounded-lg p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-teal-600" />
                      Cursos Realizados
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setData((p) => ({
                          ...p,
                          courses: [...p.courses, { name: '', hours: '', year: '' }],
                        }))
                      }
                      className="text-xs text-teal-600 font-semibold"
                    >
                      + Agregar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {data.courses.map((item, i) => (
                      <div key={i} className="space-y-1 border-b border-slate-100 pb-2">
                        <div className="flex gap-1">
                          <input
                            placeholder="Curso"
                            value={item.name}
                            onChange={(e) => {
                              const next = [...data.courses];
                              next[i] = { ...next[i], name: e.target.value };
                              setData({ ...data, courses: next });
                            }}
                            className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                          <button
                            onClick={() =>
                              setData({
                                ...data,
                                courses: data.courses.filter((_, idx) => idx !== i),
                              })
                            }
                            className="text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            placeholder="Horas"
                            value={item.hours || ''}
                            onChange={(e) => {
                              const next = [...data.courses];
                              next[i] = { ...next[i], hours: e.target.value };
                              setData({ ...data, courses: next });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                          <input
                            placeholder="Año"
                            value={item.year || ''}
                            onChange={(e) => {
                              const next = [...data.courses];
                              next[i] = { ...next[i], year: e.target.value };
                              setData({ ...data, courses: next });
                            }}
                            className="px-2 py-1 text-xs border border-slate-300 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* Columna Derecha: PDF Upload + Preview + Autocompletado IA (5 cols) */}
            <div className="lg:col-span-5 p-5 bg-slate-50 flex flex-col gap-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-rose-600" />
                  Documento CV en PDF
                </h4>
                <label className="cursor-pointer px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  {data.cvPdfFileName ? 'Reemplazar PDF' : 'Subir PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePdfUpload(f);
                    }}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleAutofill}
                disabled={autofilling}
                className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                {autofilling ? 'Analizando PDF con Gemini IA...' : 'Autocompletar desde PDF (Opcional)'}
              </button>

              {data.cvPdfFileName ? (
                <div className="flex-1 flex flex-col border border-slate-300 rounded-lg bg-white overflow-hidden min-h-[380px]">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-xs font-medium text-slate-700 truncate">
                    Archivo: {data.cvPdfFileName}
                  </div>
                  {data.cvPdfDataUrl && (
                    <iframe
                      src={data.cvPdfDataUrl}
                      title="Vista previa CV PDF"
                      className="w-full flex-1 min-h-[350px]"
                    />
                  )}
                </div>
              ) : (
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 min-h-[320px]">
                  <FileText className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No hay PDF adjunto aún</p>
                  <p className="mt-1">
                    Puedes editar manualmente las 6 secciones de la izquierda o subir un PDF para previsualizarlo aquí.
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
